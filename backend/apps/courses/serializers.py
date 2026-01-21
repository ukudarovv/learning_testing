from rest_framework import serializers
from .models import Category, Course, Module, Lesson, CourseEnrollment, LessonProgress, CourseCompletionVerification
from apps.accounts.serializers import UserSerializer


class CategorySerializer(serializers.ModelSerializer):
    """Category serializer"""
    courses_count = serializers.IntegerField(read_only=True, source='courses.count')
    
    class Meta:
        model = Category
        fields = [
            'id', 'name', 'name_kz', 'name_en', 'description', 'icon',
            'order', 'is_active', 'courses_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'courses_count']


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
            # Delete existing modules (or update if ID provided)
            existing_module_ids = [m.id for m in instance.modules.all()]
            new_module_ids = [m.get('id') for m in modules_data if m.get('id')]
            
            # Delete modules not in new data
            for module in instance.modules.all():
                if module.id not in new_module_ids:
                    module.delete()
            
            # Update or create modules
            for module_index, module_data in enumerate(modules_data):
                module_id = module_data.pop('id', None)
                lessons_data = module_data.pop('lessons', [])
                # Remove order from module_data to avoid duplicate keyword argument
                module_data.pop('order', None)
                
                if module_id and Module.objects.filter(id=module_id, course=instance).exists():
                    module = Module.objects.get(id=module_id)
                    for attr, value in module_data.items():
                        setattr(module, attr, value)
                    module.order = module_index + 1
                    module.save()
                else:
                    module = Module.objects.create(course=instance, order=module_index + 1, **module_data)
                
                # Update or create lessons
                existing_lesson_ids = [l.id for l in module.lessons.all()]
                new_lesson_ids = [l.get('id') for l in lessons_data if l.get('id')]
                
                for lesson in module.lessons.all():
                    if lesson.id not in new_lesson_ids:
                        lesson.delete()
                
                for lesson_index, lesson_data in enumerate(lessons_data):
                    lesson_id = lesson_data.pop('id', None)
                    # Remove order from lesson_data to avoid duplicate keyword argument
                    lesson_data.pop('order', None)
                    
                    if lesson_id and Lesson.objects.filter(id=lesson_id, module=module).exists():
                        lesson = Lesson.objects.get(id=lesson_id)
                        for attr, value in lesson_data.items():
                            setattr(lesson, attr, value)
                        lesson.order = lesson_index + 1
                        lesson.save()
                    else:
                        Lesson.objects.create(module=module, order=lesson_index + 1, **lesson_data)
        
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

