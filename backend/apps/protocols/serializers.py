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
            'otp_verified', 'otp_expires_at'
        ]
        read_only_fields = ['id', 'signed_at', 'otp_verified', 'otp_expires_at']


class ProtocolSerializer(serializers.ModelSerializer):
    """Protocol serializer"""
    student = UserSerializer(read_only=True)
    course = CourseSerializer(read_only=True)
    test = TestSerializer(read_only=True)
    attempt = TestAttemptSerializer(read_only=True, allow_null=True)
    signatures = ProtocolSignatureSerializer(many=True, read_only=True)
    
    class Meta:
        model = Protocol
        fields = [
            'id', 'number', 'student', 'course', 'test', 'attempt', 'enrollment',
            'exam_date', 'score', 'passing_score', 'result',
            'status', 'rejection_reason', 'signatures',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'number', 'created_at', 'updated_at']


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

