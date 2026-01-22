from rest_framework import serializers
from .models import Test, Question, TestCompletionVerification
from apps.courses.serializers import CategorySerializer
from apps.courses.models import Category
import uuid


class QuestionSerializer(serializers.ModelSerializer):
    """Question serializer"""
    
    class Meta:
        model = Question
        fields = [
            'id', 'type', 'text', 'text_kz', 'text_en', 'options', 'order', 'weight',
            'language', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TestSerializer(serializers.ModelSerializer):
    """Test serializer with nested questions"""
    questions = QuestionSerializer(many=True, read_only=True)
    questions_count = serializers.IntegerField(read_only=True)
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = Test
        fields = [
            'id', 'title', 'title_kz', 'title_en', 'passing_score',
            'time_limit', 'max_attempts', 'is_active', 'requires_video_recording', 
            'shuffle_questions', 'show_results', 'language',
            'category', 'category_id', 'is_standalone', 'questions', 'questions_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'questions_count', 'created_at', 'updated_at']


class QuestionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating questions"""
    
    class Meta:
        model = Question
        fields = ['type', 'text', 'text_kz', 'text_en', 'options', 'order', 'weight', 'language']
    
    def validate_options(self, value):
        """Validate options structure and ensure each option has an ID"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Options must be a list")
        
        # Для вопросов типа yes_no опции могут быть пустыми или не использоваться
        # Проверяем тип вопроса из initial_data, если доступен
        question_type = None
        if hasattr(self, 'initial_data'):
            question_type = self.initial_data.get('type')
        elif hasattr(self, 'instance') and self.instance:
            question_type = self.instance.type
        
        # Для yes_no вопросов опции не требуются (используются фиксированные "Да"/"Нет")
        if question_type == 'yes_no':
            return value  # Возвращаем как есть, так как опции не используются
        
        for opt in value:
            if not isinstance(opt, dict):
                raise serializers.ValidationError("Each option must be a dictionary")
            if 'text' not in opt:
                raise serializers.ValidationError("Each option must have 'text' field")
            
            # Генерируем ID для опции, если его нет (только для вопросов с опциями)
            if 'id' not in opt or not opt['id']:
                opt['id'] = str(uuid.uuid4())
        
        return value
    
    def create(self, validated_data):
        """Create question and ensure options have IDs"""
        options = validated_data.get('options', [])
        question_type = validated_data.get('type')
        # Убеждаемся, что все опции имеют ID (кроме yes_no вопросов)
        if question_type != 'yes_no' and options:
            for opt in options:
                if isinstance(opt, dict) and ('id' not in opt or not opt['id']):
                    opt['id'] = str(uuid.uuid4())
        validated_data['options'] = options
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update question and ensure options have IDs"""
        if 'options' in validated_data:
            options = validated_data['options']
            question_type = validated_data.get('type', instance.type)
            # Убеждаемся, что все опции имеют ID (кроме yes_no вопросов)
            if question_type != 'yes_no' and options:
                for opt in options:
                    if isinstance(opt, dict) and ('id' not in opt or not opt['id']):
                        opt['id'] = str(uuid.uuid4())
            validated_data['options'] = options
        return super().update(instance, validated_data)


class TestCompletionVerificationSerializer(serializers.ModelSerializer):
    """Test completion verification serializer"""
    
    class Meta:
        model = TestCompletionVerification
        fields = [
            'id', 'test_attempt', 'otp_code', 'otp_expires_at',
            'verified', 'verified_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'otp_code', 'otp_expires_at', 'verified', 'verified_at', 'created_at', 'updated_at']

