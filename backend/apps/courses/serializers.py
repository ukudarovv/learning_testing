from django.db import transaction
from rest_framework import serializers
from .models import Category, Course, Module, Lesson, CourseEnrollment, LessonProgress, CourseCompletionVerification, CourseEnrollmentRequest
from apps.accounts.serializers import UserSerializer
from apps.accounts.models import User
from .utils import PDEK_ROLES


class CategorySerializer(serializers.ModelSerializer):
    """Category serializer"""
    courses_count = serializers.IntegerField(read_only=True, source='courses.count')
    ec_reviewers = UserSerializer(many=True, read_only=True)
    ec_reviewer_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    
    class Meta:
        model = Category
        fields = [
            'id', 'name', 'name_kz', 'name_en', 'description', 'icon',
            'order', 'is_active', 'courses_count', 'ec_reviewers', 'ec_reviewer_ids',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'courses_count', 'ec_reviewers']

    def validate_ec_reviewer_ids(self, value):
        if not value:
            return value
        unique_ids = list({int(x) for x in value})
        users = User.objects.filter(pk__in=unique_ids)
        found = set(users.values_list('pk', flat=True))
        missing = set(unique_ids) - found
        if missing:
            raise serializers.ValidationError(f'Unknown user id(s): {sorted(missing)}')
        for u in users:
            if u.role not in PDEK_ROLES:
                raise serializers.ValidationError(
                    f'User {u.pk} must have role pdek_member or pdek_chairman.'
                )
        return unique_ids

    def create(self, validated_data):
        ec_reviewer_ids = validated_data.pop('ec_reviewer_ids', None)
        instance = Category.objects.create(**validated_data)
        if ec_reviewer_ids is not None:
            instance.ec_reviewers.set(ec_reviewer_ids)
        return instance

    def update(self, instance, validated_data):
        ec_reviewer_ids = validated_data.pop('ec_reviewer_ids', serializers.empty)
        instance = super().update(instance, validated_data)
        if ec_reviewer_ids is not serializers.empty:
            instance.ec_reviewers.set(ec_reviewer_ids)
        return instance


class LessonSerializer(serializers.ModelSerializer):
    """Lesson serializer"""
    completed = serializers.BooleanField(read_only=True, required=False)
    
    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'title_kz', 'title_en', 'description', 'description_kz', 'description_en',
            'type', 'content', 'content_kz', 'content_en',
            'video_url', 'thumbnail_url', 'pdf_url', 'ppt_url', 'test_id',
            'duration', 'order', 'required', 'allow_download',
            'track_progress', 'passing_score', 'max_attempts',
            'language', 'completed', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'completed']


class ModuleSerializer(serializers.ModelSerializer):
    """Module serializer with nested lessons"""
    lessons = LessonSerializer(many=True, read_only=True)
    
    class Meta:
        model = Module
        fields = [
            'id', 'title', 'title_kz', 'title_en', 'description', 'description_kz', 'description_en',
            'language', 'order', 'lessons', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CourseSerializer(serializers.ModelSerializer):
    """Course serializer with nested modules"""
    modules = ModuleSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category',
        write_only=True,
        required=False,
        allow_null=True
    )
    final_test_id = serializers.IntegerField(source='final_test.id', read_only=True, allow_null=True)
    
    class Meta:
        model = Course
        fields = [
            'id', 'title', 'title_kz', 'title_en', 'description', 'description_kz', 'description_en',
            'category', 'category_id',
            'duration', 'format', 'passing_score', 'max_attempts',
            'has_timer', 'timer_minutes', 'pdek_commission', 'status',
            'language', 'final_test_id', 'is_standalone_test', 'modules', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CourseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating courses with nested modules and lessons"""
    modules = serializers.ListField(write_only=True, required=False, allow_null=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category',
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = Course
        fields = [
            'title', 'title_kz', 'title_en', 'description', 'description_kz', 'description_en',
            'category_id',
            'duration', 'format', 'passing_score', 'max_attempts',
            'has_timer', 'timer_minutes', 'pdek_commission', 'status',
            'language', 'final_test', 'is_standalone_test', 'modules'
        ]
    
    def create(self, validated_data):
        modules_data = validated_data.pop('modules', [])
        course = Course.objects.create(**validated_data)
        
        for module_index, module_data in enumerate(modules_data):
            lessons_data = module_data.pop('lessons', [])
            # Remove order from module_data to avoid duplicate keyword argument
            module_data.pop('order', None)
            module = Module.objects.create(course=course, order=module_index + 1, **module_data)
            
            for lesson_index, lesson_data in enumerate(lessons_data):
                # Remove order from lesson_data to avoid duplicate keyword argument
                lesson_data.pop('order', None)
                Lesson.objects.create(module=module, order=lesson_index + 1, **lesson_data)
        
        return course
    
    def update(self, instance, validated_data):
        modules_data = validated_data.pop('modules', None)
        
        # Update course fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if modules_data is not None:
            # unique_together (course, order) on Module and (module, order) on Lesson:
            # reordering in one pass causes IntegrityError (two rows swap onto same order).
            # Two-phase update: assign large temporary orders, then compact to 1..n.
            TEMP = 1_000_000
            new_module_ids = [m.get('id') for m in modules_data if m.get('id')]
            
            for module in instance.modules.all():
                if module.id not in new_module_ids:
                    module.delete()
            
            with transaction.atomic():
                module_refs = []
                
                for module_index, raw_module in enumerate(modules_data):
                    module_data = dict(raw_module)
                    module_id = module_data.pop('id', None)
                    lessons_data = module_data.pop('lessons', [])
                    module_data.pop('order', None)
                    
                    if module_id and Module.objects.filter(id=module_id, course=instance).exists():
                        module = Module.objects.get(id=module_id)
                        for attr, value in module_data.items():
                            setattr(module, attr, value)
                        module.order = TEMP + module_index
                        module.save()
                    else:
                        module = Module.objects.create(
                            course=instance, order=TEMP + module_index, **module_data
                        )
                    
                    new_lesson_ids = [l.get('id') for l in lessons_data if l.get('id')]
                    for lesson in list(module.lessons.all()):
                        if lesson.id not in new_lesson_ids:
                            lesson.delete()
                    
                    for lesson_index, raw_lesson in enumerate(lessons_data):
                        lesson_data = dict(raw_lesson)
                        lesson_id = lesson_data.pop('id', None)
                        lesson_data.pop('order', None)
                        
                        if lesson_id and Lesson.objects.filter(id=lesson_id, module=module).exists():
                            lesson = Lesson.objects.get(id=lesson_id)
                            for attr, value in lesson_data.items():
                                setattr(lesson, attr, value)
                            lesson.order = TEMP + lesson_index
                            lesson.save()
                        else:
                            Lesson.objects.create(
                                module=module, order=TEMP + lesson_index, **lesson_data
                            )
                    
                    module_refs.append(module)
                
                for module_index, module in enumerate(module_refs):
                    module.order = module_index + 1
                    module.save()
                
                for module in module_refs:
                    for j, lesson in enumerate(module.lessons.order_by('order')):
                        lesson.order = j + 1
                        lesson.save()
        
        return instance


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    """Course enrollment serializer"""
    user = UserSerializer(read_only=True)
    student = serializers.SerializerMethodField()  # Alias for user (for frontend compatibility)
    course = CourseSerializer(read_only=True)
    
    class Meta:
        model = CourseEnrollment
        fields = [
            'id', 'user', 'student', 'course', 'progress', 'status',
            'enrolled_at', 'completed_at'
        ]
        read_only_fields = ['id', 'enrolled_at', 'completed_at']
    
    def get_student(self, obj):
        """Return user as student for frontend compatibility"""
        return UserSerializer(obj.user).data if obj.user else None


class LessonProgressSerializer(serializers.ModelSerializer):
    """Lesson progress serializer"""
    lesson = LessonSerializer(read_only=True)
    
    class Meta:
        model = LessonProgress
        fields = ['id', 'lesson', 'completed', 'completed_at']
        read_only_fields = ['id', 'completed_at']


class CourseCompletionVerificationSerializer(serializers.ModelSerializer):
    """Course completion verification serializer"""
    
    class Meta:
        model = CourseCompletionVerification
        fields = [
            'id', 'enrollment', 'otp_code', 'otp_expires_at',
            'verified', 'verified_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'otp_code', 'otp_expires_at', 'verified', 'verified_at', 'created_at', 'updated_at']


class OTPRequestSerializer(serializers.Serializer):
    """Serializer for OTP request"""
    pass


class OTPVerifySerializer(serializers.Serializer):
    """Serializer for OTP verification"""
    otp_code = serializers.CharField(max_length=6, min_length=6)


class CourseEnrollmentRequestSerializer(serializers.ModelSerializer):
    """Course enrollment request serializer"""
    user = UserSerializer(read_only=True)
    course = serializers.SerializerMethodField()
    processed_by = UserSerializer(read_only=True)
    
    class Meta:
        model = CourseEnrollmentRequest
        fields = [
            'id', 'user', 'course', 'status', 'admin_response',
            'processed_by', 'processed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'processed_by', 'processed_at']
    
    def get_course(self, obj):
        """Return simplified course data"""
        course = obj.course
        return {
            'id': course.id,
            'title': course.title,
            'title_kz': course.title_kz,
            'title_en': course.title_en,
        }


class CourseEnrollmentRequestCreateSerializer(serializers.Serializer):
    """Serializer for creating course enrollment request"""
    course_id = serializers.IntegerField()


class CourseEnrollmentRequestProcessSerializer(serializers.Serializer):
    """Serializer for processing course enrollment request (approve/reject)"""
    admin_response = serializers.CharField(required=False, allow_blank=True)

