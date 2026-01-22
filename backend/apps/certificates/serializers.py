from rest_framework import serializers
from .models import Certificate, CertificateTemplate
from apps.courses.serializers import CourseSerializer
from apps.accounts.serializers import UserSerializer
from apps.protocols.serializers import ProtocolSerializer
from apps.tests.serializers import TestSerializer


class CertificateTemplateSerializer(serializers.ModelSerializer):
    """Certificate template serializer"""
    
    class Meta:
        model = CertificateTemplate
        fields = ['id', 'name', 'description', 'file', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CertificateSerializer(serializers.ModelSerializer):
    """Certificate serializer"""
    student = UserSerializer(read_only=True)
    course = CourseSerializer(read_only=True)
    test = TestSerializer(read_only=True)
    protocol = ProtocolSerializer(read_only=True)
    template = CertificateTemplateSerializer(read_only=True)
    uploaded_by = UserSerializer(read_only=True)
    file = serializers.FileField(read_only=True)
    
    class Meta:
        model = Certificate
        fields = [
            'id', 'number', 'student', 'course', 'test', 'protocol', 'template',
            'file', 'uploaded_by', 'uploaded_at',
            'issued_at', 'valid_until', 'qr_code', 'pdf_url'
        ]
        read_only_fields = ['id', 'number', 'issued_at', 'qr_code']


class CertificateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating certificate"""
    
    class Meta:
        model = Certificate
        fields = ['student', 'course', 'test', 'protocol', 'template', 'valid_until', 'file']
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['uploaded_by'] = request.user
            from django.utils import timezone
            validated_data['uploaded_at'] = timezone.now()
        return super().create(validated_data)


class CertificateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating certificate"""
    template = serializers.PrimaryKeyRelatedField(queryset=CertificateTemplate.objects.all(), required=False, allow_null=True)
    
    class Meta:
        model = Certificate
        fields = ['number', 'template', 'valid_until', 'file']
    
    def validate_number(self, value):
        """Validate that certificate number is unique"""
        if value:
            # Check if another certificate with this number exists (excluding current instance)
            qs = Certificate.objects.filter(number=value)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError('Сертификат с таким номером уже существует')
        return value
    
    def to_internal_value(self, data):
        """Handle empty strings for nullable fields"""
        if hasattr(data, 'get'):
            # Handle QueryDict from FormData
            mutable_data = {}
            for key in ['number', 'template', 'valid_until']:
                value = data.get(key)
                if value == '':
                    if key == 'number':
                        # Number cannot be empty, skip it
                        continue
                    mutable_data[key] = None
                elif value is not None:
                    mutable_data[key] = value
            # File is handled separately by DRF from request.FILES
            return super().to_internal_value(mutable_data)
        return super().to_internal_value(data)
    
    def update(self, instance, validated_data):
        request = self.context.get('request')
        old_number = instance.number
        number_changed = 'number' in validated_data and validated_data['number'] != old_number
        
        if request and hasattr(request, 'user'):
            # Если загружается новый файл, обновляем информацию о загрузке
            if 'file' in validated_data:
                instance.uploaded_by = request.user
                from django.utils import timezone
                instance.uploaded_at = timezone.now()
        
        updated_instance = super().update(instance, validated_data)
        
        # Регенерируем QR код если номер изменился
        if number_changed:
            updated_instance.generate_qr_code()
            updated_instance.save(update_fields=['qr_code'])
        
        return updated_instance

