from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Q

from .models import TestAttempt, ExtraAttemptRequest
from .serializers import (
    TestAttemptSerializer,
    TestAttemptCreateSerializer,
    TestAttemptSaveSerializer,
    ExtraAttemptRequestSerializer,
    ExtraAttemptRequestCreateSerializer,
    ExtraAttemptRequestProcessSerializer,
)
from apps.tests.models import Test
from apps.accounts.permissions import IsAdminOrReadOnly


class TestAttemptViewSet(viewsets.ModelViewSet):
    """Test attempt ViewSet"""
    queryset = TestAttempt.objects.select_related('test', 'user').all()
    serializer_class = TestAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = []
    
    def get_queryset(self):
        """Filter attempts by user unless admin or PDEK member"""
        queryset = super().get_queryset()
        user = self.request.user
        
        # Админы и члены ПДЭК могут видеть все попытки
        if user.is_admin or getattr(user, 'role', None) in ['pdek_member', 'pdek_chairman']:
            return queryset
        
        # Обычные пользователи видят только свои попытки
        queryset = queryset.filter(user=user)
        return queryset
    
    def _has_excellent_pass(self, user, test):
        """Check if user has passed test with 90% or higher"""
        return TestAttempt.objects.filter(
            user=user,
            test=test,
            completed_at__isnull=False,
            score__gte=90.0
        ).exists()
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        """Start a new test attempt"""
        serializer = TestAttemptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        test_id = serializer.validated_data['test_id']
        try:
            test = Test.objects.get(id=test_id)
        except Test.DoesNotExist:
            return Response(
                {'error': 'Test not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user has already passed excellently (90%+)
        if self._has_excellent_pass(request.user, test):
            return Response(
                {'error': 'Test already passed excellently (90%+). No additional attempts allowed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check max attempts (including approved extra attempts)
        user_attempts = TestAttempt.objects.filter(
            user=request.user,
            test=test
        ).count()
        
        # Count approved extra attempt requests
        approved_extra_attempts = ExtraAttemptRequest.objects.filter(
            user=request.user,
            test=test,
            status='approved'
        ).count()
        
        max_allowed = test.max_attempts + approved_extra_attempts
        
        if user_attempts >= max_allowed:
            return Response(
                {'error': f'Maximum attempts ({max_allowed}) reached'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new attempt
        attempt = TestAttempt.objects.create(
            test=test,
            user=request.user,
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return Response(
            TestAttemptSerializer(attempt, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'])
    def save(self, request, pk=None):
        """Save answers during test"""
        attempt = self.get_object()
        
        # Check if user owns this attempt
        if attempt.user != request.user and not request.user.is_admin:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already completed
        if attempt.completed_at:
            return Response(
                {'error': 'Test already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = TestAttemptSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Update answers - объединяем с существующими ответами
        if not attempt.answers:
            attempt.answers = {}
        attempt.answers.update(serializer.validated_data['answers'])
        attempt.save()
        
        return Response(
            TestAttemptSerializer(attempt, context={'request': request}).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit test attempt and calculate score"""
        attempt = self.get_object()
        
        # Check if user owns this attempt
        if attempt.user != request.user and not request.user.is_admin:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already completed
        if attempt.completed_at:
            return Response(
                TestAttemptSerializer(attempt, context={'request': request}).data,
                status=status.HTTP_200_OK
            )
        
        # Handle video recording upload if provided
        if 'video_recording' in request.FILES:
            video_file = request.FILES['video_recording']
            # Validate file size (max 500MB)
            max_size = 500 * 1024 * 1024  # 500MB in bytes
            if video_file.size > max_size:
                return Response(
                    {'error': 'Video file too large. Maximum size is 500MB'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Validate file type (should be video)
            if not video_file.content_type.startswith('video/'):
                return Response(
                    {'error': 'Invalid file type. Only video files are allowed'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            attempt.video_recording = video_file
        
        # Calculate score
        score, passed = attempt.calculate_score()
        attempt.score = score
        attempt.passed = passed
        attempt.completed_at = timezone.now()
        attempt.save()
        
        # Create notification if passed
        if passed:
            from apps.notifications.models import Notification
            Notification.objects.create(
                user=attempt.user,
                type='exam_passed',
                title='Тест пройден',
                message=f'Вы успешно прошли тест "{attempt.test.title}" с результатом {score:.1f}%'
            )
        else:
            from apps.notifications.models import Notification
            Notification.objects.create(
                user=attempt.user,
                type='exam_failed',
                title='Тест не пройден',
                message=f'Тест "{attempt.test.title}" не пройден. Ваш результат: {score:.1f}%'
            )
        
        return Response(
            TestAttemptSerializer(attempt).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """Terminate test attempt early due to violations"""
        attempt = self.get_object()
        
        # Check if user owns this attempt
        if attempt.user != request.user and not request.user.is_admin:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already completed
        if attempt.completed_at:
            return Response(
                TestAttemptSerializer(attempt, context={'request': request}).data,
                status=status.HTTP_200_OK
            )
        
        # Get termination reason from request
        reason = request.data.get('reason', 'Нарушение правил прохождения теста')
        
        # Terminate the attempt
        attempt.completed_at = timezone.now()
        attempt.score = 0.0
        attempt.passed = False
        attempt.termination_reason = reason
        attempt.save()
        
        # Create notification
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=attempt.user,
            type='exam_failed',
            title='Тест досрочно завершен',
            message=f'Тест "{attempt.test.title}" был досрочно завершен из-за нарушений правил. Причина: {reason}'
        )
        
        return Response(
            TestAttemptSerializer(attempt, context={'request': request}).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['get'])
    def my_attempts(self, request):
        """Get current user's attempts"""
        attempts = TestAttempt.objects.filter(
            user=request.user
        ).select_related('test').order_by('-started_at')
        
        serializer = TestAttemptSerializer(attempts, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def test_attempts(self, request):
        """Get user's attempts for a specific test"""
        test_id = request.query_params.get('test_id')
        if not test_id:
            return Response(
                {'error': 'test_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            test = Test.objects.get(id=test_id)
        except Test.DoesNotExist:
            return Response(
                {'error': 'Test not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        attempts = TestAttempt.objects.filter(
            user=request.user,
            test=test
        ).select_related('test').order_by('-started_at')
        
        serializer = TestAttemptSerializer(attempts, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def request_delete_video_otp(self, request, pk=None):
        """Request SMS code for video deletion confirmation"""
        if not request.user.is_admin:
            return Response(
                {'error': 'Permission denied. Admin access required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        attempt = self.get_object()
        
        if not attempt.video_recording:
            return Response(
                {'error': 'No video recording to delete'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from apps.accounts.sms_service import sms_service
            from apps.accounts.models import SMSVerificationCode
            import logging
            
            logger = logging.getLogger(__name__)
            
            # Normalize phone number
            phone = request.user.phone
            normalized_phone = ''.join(filter(str.isdigit, str(phone)))
            if normalized_phone.startswith('8'):
                normalized_phone = '7' + normalized_phone[1:]
            if not normalized_phone.startswith('7'):
                normalized_phone = '7' + normalized_phone
            
            # Generate verification code
            verification_code = SMSVerificationCode.generate_code(normalized_phone, 'verification')
            
            # Log the code
            logger.warning(f"[VIDEO DELETION] SMS code for {normalized_phone}: {verification_code.code}")
            print(f"\n{'='*60}")
            print(f"⚠️  VIDEO DELETION SMS CODE")
            print(f"Phone: {normalized_phone}")
            print(f"Code: {verification_code.code}")
            print(f"Attempt ID: {attempt.id}")
            print(f"Expires at: {verification_code.expires_at}")
            print(f"{'='*60}\n")
            
            # Send SMS via SMSC.kz
            sms_result = sms_service.send_verification_code(
                normalized_phone,
                verification_code.code,
                'verification'
            )
            
            if not sms_result['success']:
                logger.error(f"Failed to send SMS to {normalized_phone}: {sms_result.get('error')}")
            
            return Response({
                'message': 'SMS verification code sent successfully',
                'expires_at': verification_code.expires_at.isoformat(),
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error requesting video deletion OTP: {str(e)}")
            return Response(
                {'error': 'Failed to send verification code', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def delete_video(self, request, pk=None):
        """Delete video recording after SMS verification"""
        if not request.user.is_admin:
            return Response(
                {'error': 'Permission denied. Admin access required.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        attempt = self.get_object()
        
        if not attempt.video_recording:
            return Response(
                {'error': 'No video recording to delete'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get SMS code from request
        sms_code = request.data.get('sms_code')
        if not sms_code:
            return Response(
                {'error': 'SMS verification code is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from apps.accounts.models import SMSVerificationCode
            import logging
            import os
            
            logger = logging.getLogger(__name__)
            
            # Normalize phone number
            phone = request.user.phone
            normalized_phone = ''.join(filter(str.isdigit, str(phone)))
            if normalized_phone.startswith('8'):
                normalized_phone = '7' + normalized_phone[1:]
            if not normalized_phone.startswith('7'):
                normalized_phone = '7' + normalized_phone
            
            # Find and verify the code
            verification_code = SMSVerificationCode.objects.filter(
                phone=normalized_phone,
                purpose='verification',
                is_verified=False
            ).order_by('-created_at').first()
            
            if not verification_code:
                return Response(
                    {'error': 'Verification code not found or already used'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify the code
            if not verification_code.verify(sms_code):
                return Response(
                    {'error': 'Invalid or expired verification code'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Delete video file
            if attempt.video_recording:
                video_path = attempt.video_recording.path
                if os.path.exists(video_path):
                    os.remove(video_path)
                    logger.info(f"Video file deleted: {video_path}")
                
                # Clear the field
                attempt.video_recording.delete(save=False)
                attempt.video_recording = None
                attempt.save()
                
                logger.info(f"Video recording deleted for attempt {attempt.id} by admin {request.user.phone}")
                
                return Response({
                    'message': 'Video recording deleted successfully'
                }, status=status.HTTP_200_OK)
            else:
                return Response(
                    {'error': 'Video recording not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
                
        except Exception as e:
            logger.error(f"Error deleting video recording: {str(e)}")
            return Response(
                {'error': 'Failed to delete video recording', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_client_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class ExtraAttemptRequestViewSet(viewsets.ModelViewSet):
    """Extra attempt request ViewSet"""
    queryset = ExtraAttemptRequest.objects.select_related('user', 'test', 'processed_by').all()
    serializer_class = ExtraAttemptRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter requests by user unless admin"""
        queryset = super().get_queryset()
        if not self.request.user.is_admin:
            queryset = queryset.filter(user=self.request.user)
        else:
            # Admin can filter by status
            status_filter = self.request.query_params.get('status')
            if status_filter:
                queryset = queryset.filter(status=status_filter)
        return queryset
    
    def get_serializer_class(self):
        """Return appropriate serializer class"""
        if self.action == 'create':
            return ExtraAttemptRequestCreateSerializer
        elif self.action in ['approve', 'reject']:
            return ExtraAttemptRequestProcessSerializer
        return ExtraAttemptRequestSerializer
    
    def create(self, request):
        """Create a new extra attempt request"""
        serializer = ExtraAttemptRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Неверные данные запроса', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        test_id = serializer.validated_data['test_id']
        reason = serializer.validated_data['reason']
        
        try:
            test = Test.objects.get(id=test_id)
        except Test.DoesNotExist:
            return Response(
                {'error': 'Тест не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if max attempts actually reached
        user_attempts = TestAttempt.objects.filter(
            user=request.user,
            test=test
        ).count()
        
        approved_extra_attempts = ExtraAttemptRequest.objects.filter(
            user=request.user,
            test=test,
            status='approved'
        ).count()
        
        max_allowed = test.max_attempts + approved_extra_attempts
        
        if user_attempts < max_allowed:
            return Response(
                {'error': f'У вас еще есть доступные попытки ({user_attempts} из {max_allowed} использовано)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user has already passed excellently (90%+)
        excellent_pass_exists = TestAttempt.objects.filter(
            user=request.user,
            test=test,
            completed_at__isnull=False,
            score__gte=90.0
        ).exists()
        
        if excellent_pass_exists:
            return Response(
                {'error': 'Cannot request extra attempts: test already passed excellently (90%+)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create request
        extra_request = ExtraAttemptRequest.objects.create(
            user=request.user,
            test=test,
            reason=reason,
            status='pending'
        )
        
        # Create notification for admin
        from apps.notifications.models import Notification
        from apps.accounts.models import User
        admins = User.objects.filter(role='admin', is_active=True)
        for admin in admins:
            Notification.objects.create(
                user=admin,
                type='extra_attempt_request',
                title='Новый запрос на дополнительные попытки',
                message=f'Студент {request.user.full_name or request.user.phone} запросил дополнительные попытки для теста "{test.title}"'
            )
        
        return Response(
            ExtraAttemptRequestSerializer(extra_request).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        """Approve extra attempt request (admin only)"""
        if not request.user.is_admin:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        extra_request = self.get_object()
        
        if extra_request.status != 'pending':
            return Response(
                {'error': f'Request is already {extra_request.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Approve request
        extra_request.status = 'approved'
        extra_request.processed_by = request.user
        extra_request.processed_at = timezone.now()
        if request.data.get('admin_response'):
            extra_request.admin_response = request.data['admin_response']
        extra_request.save()
        
        # Create notification for student
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=extra_request.user,
            type='extra_attempt_approved',
            title='Запрос на дополнительные попытки одобрен',
            message=f'Ваш запрос на дополнительные попытки для теста "{extra_request.test.title}" был одобрен.'
        )
        
        return Response(
            ExtraAttemptRequestSerializer(extra_request).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        """Reject extra attempt request (admin only)"""
        if not request.user.is_admin:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        extra_request = self.get_object()
        
        if extra_request.status != 'pending':
            return Response(
                {'error': f'Request is already {extra_request.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ExtraAttemptRequestProcessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Reject request
        extra_request.status = 'rejected'
        extra_request.processed_by = request.user
        extra_request.processed_at = timezone.now()
        extra_request.admin_response = serializer.validated_data.get('admin_response', '')
        extra_request.save()
        
        # Create notification for student
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=extra_request.user,
            type='extra_attempt_rejected',
            title='Запрос на дополнительные попытки отклонен',
            message=f'Ваш запрос на дополнительные попытки для теста "{extra_request.test.title}" был отклонен.' + (
                f' Причина: {extra_request.admin_response}' if extra_request.admin_response else ''
            )
        )
        
        return Response(
            ExtraAttemptRequestSerializer(extra_request).data,
            status=status.HTTP_200_OK
        )

