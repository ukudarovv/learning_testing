from rest_framework import serializers
from .models import TestAttempt, ExtraAttemptRequest
from apps.tests.serializers import TestSerializer
from apps.accounts.serializers import UserSerializer


class TestAttemptSerializer(serializers.ModelSerializer):
    """Test attempt serializer"""
    test = TestSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    answer_details = serializers.SerializerMethodField()
    
    video_recording = serializers.SerializerMethodField()
    attempts_count = serializers.SerializerMethodField()
    max_attempts = serializers.SerializerMethodField()
    approved_extra_attempts = serializers.SerializerMethodField()
    has_pending_request = serializers.SerializerMethodField()
    has_approved_request = serializers.SerializerMethodField()
    limit_reached = serializers.SerializerMethodField()
    
    class Meta:
        model = TestAttempt
        fields = [
            'id', 'test', 'user', 'started_at', 'completed_at',
            'score', 'passed', 'answers', 'answer_details', 'video_recording', 'ip_address', 'user_agent',
            'attempts_count', 'max_attempts', 'approved_extra_attempts', 
            'has_pending_request', 'has_approved_request', 'limit_reached'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at', 'score', 'passed', 'answer_details', 'video_recording',
                           'attempts_count', 'max_attempts', 'approved_extra_attempts', 
                           'has_pending_request', 'has_approved_request', 'limit_reached']
    
    def get_video_recording(self, obj):
        """Return video recording URL if available"""
        if obj.video_recording:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.video_recording.url)
            return obj.video_recording.url
        return None
    
    def get_answer_details(self, obj):
        """Get detailed information about each answer"""
        if not obj.completed_at:
            return []
        return obj.get_answer_details()
    
    def get_attempts_count(self, obj):
        """Get total attempts count for this user and test"""
        return TestAttempt.objects.filter(user=obj.user, test=obj.test).count()
    
    def get_max_attempts(self, obj):
        """Get max attempts from test"""
        return obj.test.max_attempts
    
    def get_approved_extra_attempts(self, obj):
        """Get approved extra attempts count"""
        return ExtraAttemptRequest.objects.filter(
            user=obj.user, 
            test=obj.test, 
            status='approved'
        ).count()
    
    def get_has_pending_request(self, obj):
        """Check if user has pending request"""
        return ExtraAttemptRequest.objects.filter(
            user=obj.user,
            test=obj.test,
            status='pending'
        ).exists()
    
    def get_has_approved_request(self, obj):
        """Check if user has approved request"""
        return ExtraAttemptRequest.objects.filter(
            user=obj.user,
            test=obj.test,
            status='approved'
        ).exists()
    
    def get_limit_reached(self, obj):
        """Check if limit is reached"""
        attempts_count = self.get_attempts_count(obj)
        max_attempts = self.get_max_attempts(obj)
        approved_extra = self.get_approved_extra_attempts(obj)
        return attempts_count >= (max_attempts + approved_extra)


class TestAttemptCreateSerializer(serializers.Serializer):
    """Serializer for creating test attempt"""
    test_id = serializers.IntegerField()


class TestAttemptSaveSerializer(serializers.Serializer):
    """Serializer for saving answers"""
    answers = serializers.DictField()


class ExtraAttemptRequestSerializer(serializers.ModelSerializer):
    """Extra attempt request serializer"""
    user = UserSerializer(read_only=True)
    test = TestSerializer(read_only=True)
    processed_by = UserSerializer(read_only=True)
    attempts_count = serializers.SerializerMethodField()
    max_attempts = serializers.SerializerMethodField()
    approved_extra_attempts = serializers.SerializerMethodField()
    limit_reached = serializers.SerializerMethodField()
    
    class Meta:
        model = ExtraAttemptRequest
        fields = [
            'id', 'user', 'test', 'reason', 'status', 'admin_response',
            'processed_by', 'processed_at', 'created_at', 'updated_at',
            'attempts_count', 'max_attempts', 'approved_extra_attempts', 'limit_reached'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'processed_by', 'processed_at',
                           'attempts_count', 'max_attempts', 'approved_extra_attempts', 'limit_reached']
    
    def get_attempts_count(self, obj):
        """Get total attempts count for this user and test"""
        return TestAttempt.objects.filter(user=obj.user, test=obj.test).count()
    
    def get_max_attempts(self, obj):
        """Get max attempts from test"""
        return obj.test.max_attempts
    
    def get_approved_extra_attempts(self, obj):
        """Get approved extra attempts count (excluding current request if approved)"""
        count = ExtraAttemptRequest.objects.filter(
            user=obj.user, 
            test=obj.test, 
            status='approved'
        ).count()
        # If current request is approved, it's already counted
        return count
    
    def get_limit_reached(self, obj):
        """Check if limit is reached"""
        attempts_count = self.get_attempts_count(obj)
        max_attempts = self.get_max_attempts(obj)
        approved_extra = self.get_approved_extra_attempts(obj)
        return attempts_count >= (max_attempts + approved_extra)


class ExtraAttemptRequestCreateSerializer(serializers.Serializer):
    """Serializer for creating extra attempt request"""
    test_id = serializers.IntegerField()
    reason = serializers.CharField()


class ExtraAttemptRequestProcessSerializer(serializers.Serializer):
    """Serializer for processing extra attempt request (approve/reject)"""
    admin_response = serializers.CharField(required=False, allow_blank=True)

