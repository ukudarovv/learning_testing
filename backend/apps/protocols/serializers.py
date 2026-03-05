from rest_framework import serializers
from .models import Protocol, ProtocolSignature
from apps.courses.serializers import CourseSerializer
from apps.accounts.serializers import UserSerializer
from apps.exams.serializers import TestAttemptSerializer
from apps.tests.serializers import TestSerializer


class ProtocolSignatureSerializer(serializers.ModelSerializer):
    """Protocol signature serializer"""
    signer = UserSerializer(read_only=True)
    
    class Meta:
        model = ProtocolSignature
        fields = [
            'id', 'signer', 'role', 'signed_at',
            'otp_verified', 'otp_expires_at', 'sign_type', 'eds_certificate_info'
        ]
        read_only_fields = ['id', 'signed_at', 'otp_verified', 'otp_expires_at', 'sign_type', 'eds_certificate_info']


class ProtocolSerializer(serializers.ModelSerializer):
    """Protocol serializer"""
    student = UserSerializer(read_only=True)
    course = CourseSerializer(read_only=True)
    test = TestSerializer(read_only=True)
    attempt = TestAttemptSerializer(read_only=True, allow_null=True)
    signatures = ProtocolSignatureSerializer(many=True, read_only=True)
    uploaded_by = UserSerializer(read_only=True)
    file = serializers.FileField(read_only=True)
    
    class Meta:
        model = Protocol
        fields = [
            'id', 'number', 'student', 'course', 'test', 'attempt', 'enrollment',
            'exam_date', 'score', 'passing_score', 'result',
            'status', 'rejection_reason', 'signatures',
            'file', 'uploaded_by', 'uploaded_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'number', 'created_at', 'updated_at']


class ProtocolUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating protocol (file upload)"""
    file = serializers.FileField(required=False, allow_null=True)
    
    class Meta:
        model = Protocol
        fields = ['file']
    
    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'FILES') and 'file' in request.FILES:
            validated_data['file'] = request.FILES['file']
        
        if request and hasattr(request, 'user'):
            if 'file' in validated_data:
                instance.uploaded_by = request.user
                from django.utils import timezone
                instance.uploaded_at = timezone.now()
        
        return super().update(instance, validated_data)


class ProtocolCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating protocol"""
    
    class Meta:
        model = Protocol
        fields = ['student', 'course', 'test', 'attempt', 'enrollment', 'exam_date', 'score', 'passing_score', 'result']


class OTPRequestSerializer(serializers.Serializer):
    """Serializer for OTP request"""
    pass


class OTPSignSerializer(serializers.Serializer):
    """Serializer for OTP signing"""
    otp = serializers.CharField(max_length=6)


class EDSSignSerializer(serializers.Serializer):
    """Serializer for EDS (ЭЦП) signing via NCALayer"""
    signature_base64 = serializers.CharField(help_text='Base64 CMS detached signature from NCALayer')

