from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Max

from .models import Test, Question, TestCompletionVerification
from .serializers import (
    TestSerializer,
    QuestionSerializer,
    QuestionCreateSerializer,
)
from apps.accounts.permissions import IsAdminOrReadOnly
from apps.core.utils import get_request_language
from apps.courses.serializers import OTPVerifySerializer


class TestViewSet(viewsets.ModelViewSet):
    """Test ViewSet"""
    queryset = Test.objects.prefetch_related('questions').all()
    serializer_class = TestSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'language', 'category']
    search_fields = ['title']
    ordering_fields = ['created_at', 'title']
    ordering = ['-created_at']
    
    def get_permissions(self):
        """Allow read access to all, write access only to admins"""
        # Allow authenticated users to request and verify completion OTP
        if self.action in ['request_completion_otp', 'verify_completion_otp']:
            return [permissions.IsAuthenticated()]
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsAdminOrReadOnly()]
    
    def get_queryset(self):
        """Filter tests by language (except for admins)"""
        queryset = super().get_queryset()
        
        # Для админов показываем все тесты независимо от языка
        is_admin = (
            self.request.user and 
            self.request.user.is_authenticated and 
            (getattr(self.request.user, 'is_admin', False) or getattr(self.request.user, 'is_staff', False))
        )
        
        if not is_admin:
            # Для неавторизованных и обычных пользователей фильтруем по языку
            # (если не указан явно в параметрах запроса)
            if 'language' not in self.request.query_params:
                lang = get_request_language(self.request)
                queryset = queryset.filter(language=lang)
        
        # Для неавторизованных пользователей показываем только активные тесты
        if not self.request.user or not self.request.user.is_authenticated:
            queryset = queryset.filter(is_active=True)
        
        return queryset
    
    @action(detail=True, methods=['get', 'post'])
    def questions(self, request, pk=None):
        """Get or add questions to test"""
        test = self.get_object()
        
        if request.method == 'GET':
            questions = test.questions.all()
            serializer = QuestionSerializer(questions, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            serializer = QuestionCreateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # Set order if not provided
            if 'order' not in serializer.validated_data:
                max_order = test.questions.aggregate(max_order=Max('order'))['max_order'] or 0
                serializer.validated_data['order'] = max_order + 1
            
            question = serializer.save(test=test)
            return Response(QuestionSerializer(question).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def request_completion_otp(self, request, pk=None):
        """Request OTP for standalone test completion verification"""
        test = self.get_object()
        
        # Check if test is standalone (must have both category and is_standalone flag)
        if not test.is_standalone or not test.category:
            return Response(
                {'error': 'This test is not a standalone test'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if test is passed
        from apps.exams.models import TestAttempt
        test_attempt = TestAttempt.objects.filter(
            user=request.user,
            test=test,
            passed=True
        ).order_by('-completed_at').first()
        
        if not test_attempt:
            return Response(
                {'error': 'Test not passed yet'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create or get verification
        verification, created = TestCompletionVerification.objects.get_or_create(
            test_attempt=test_attempt
        )
        
        # Проверяем, существует ли уже действительный OTP
        from django.utils import timezone
        import logging
        logger = logging.getLogger(__name__)
        
        otp_code = None
        otp_is_new = False
        existing_otp_valid = False
        
        if verification.otp_code and verification.otp_expires_at:
            # Проверяем, не истек ли существующий OTP
            if timezone.now() <= verification.otp_expires_at:
                # OTP еще действителен, используем его
                otp_code = verification.otp_code
                existing_otp_valid = True
                logger.info(f"Using existing valid OTP for test attempt {test_attempt.id}")
            else:
                # OTP истек, нужно сгенерировать новый
                logger.info(f"Existing OTP expired for test attempt {test_attempt.id}, generating new one")
        
        # Если OTP не существует или истек, генерируем новый
        sms_sent = False
        sms_error = None
        if not existing_otp_valid:
            otp_code = verification.generate_otp()
            otp_is_new = True
            
            # Send SMS via SMSC.kz
            try:
                from apps.accounts.sms_service import sms_service
                from django.conf import settings
                
                user_phone = request.user.phone
                
                # Validate phone number
                if not user_phone:
                    logger.error(f"User {request.user.id} has no phone number")
                    sms_error = "User phone number is missing"
                else:
                    # Log the SMS code
                    logger.warning(f"[SMS CODE] Test Completion - Phone: {user_phone}, Code: {otp_code}, Test: {test.id}")
                    print(f"\n{'='*60}")
                    print(f"⚠️  TEST COMPLETION SMS CODE")
                    print(f"Phone: {user_phone}")
                    print(f"Code: {otp_code}")
                    print(f"Test ID: {test.id}")
                    print(f"{'='*60}\n")
                    
                    logger.info(f"Attempting to send SMS to {user_phone} for test completion {test.id}")
                    logger.info(f"OTP code generated: {otp_code}")
                    logger.info(f"SMSC.kz configured: login={settings.SMSC_LOGIN}, password={'***' if settings.SMSC_PASSWORD else 'Not set'}")
                    
                    sms_result = sms_service.send_verification_code(
                        user_phone,
                        otp_code,
                        'verification'  # Using 'verification' purpose for test completion
                    )
                    
                    logger.info(f"SMS result: {sms_result}")
                    
                    if sms_result['success']:
                        sms_sent = True
                        logger.info(f"SMS sent successfully to {user_phone} for test {test.id}")
                    else:
                        sms_error = sms_result.get('error', 'Unknown error')
                        logger.error(f"Failed to send SMS via SMSC.kz: {sms_error}")
                        logger.error(f"Full SMS result: {sms_result}")
            except Exception as e:
                sms_error = str(e)
                logger.error(f"Exception while sending SMS: {sms_error}", exc_info=True)
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Проверяем, настроен ли SMSC.kz (для формирования ответа)
        from django.conf import settings
        is_smsc_configured = (
            hasattr(settings, 'SMSC_LOGIN') and 
            settings.SMSC_LOGIN and 
            hasattr(settings, 'SMSC_PASSWORD') and 
            settings.SMSC_PASSWORD
        )
        
        # Формируем ответ
        response_data = {
            'message': 'OTP code sent to your phone' if (otp_is_new and sms_sent) else ('OTP code generated' if otp_is_new else 'OTP code already sent'),
            'otp_expires_at': verification.otp_expires_at.isoformat() if verification.otp_expires_at else None,
            'otp_is_new': otp_is_new,
            'sms_sent': sms_sent,
        }
        
        # Add error info if SMS failed
        if sms_error:
            response_data['sms_error'] = sms_error
            response_data['warning'] = 'SMS sending failed, but OTP code was generated'
        
        # В режиме разработки (без SMSC.kz или при ошибке) возвращаем OTP код в ответе для тестирования
        if not is_smsc_configured or not sms_sent:
            response_data['otp_code'] = otp_code
            response_data['debug'] = True
            if not is_smsc_configured:
                response_data['debug_reason'] = 'SMSC.kz not configured'
            elif not sms_sent:
                response_data['debug_reason'] = f'SMS sending failed: {sms_error}'
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def verify_completion_otp(self, request, pk=None):
        """Verify OTP and create protocol for PDEK review"""
        test = self.get_object()
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        otp_code = serializer.validated_data['otp_code']
        
        # Check if test is standalone
        if not test.is_standalone or not test.category:
            return Response(
                {'error': 'This test is not a standalone test'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get test attempt
        from apps.exams.models import TestAttempt
        test_attempt = TestAttempt.objects.filter(
            user=request.user,
            test=test,
            passed=True
        ).order_by('-completed_at').first()
        
        if not test_attempt:
            return Response(
                {'error': 'Test attempt not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get verification
        try:
            verification = TestCompletionVerification.objects.get(test_attempt=test_attempt)
        except TestCompletionVerification.DoesNotExist:
            return Response(
                {'error': 'Verification not found. Please request OTP first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify OTP
        import logging
        from django.conf import settings
        
        logger = logging.getLogger(__name__)
        logger.info(f"Attempting to verify OTP for test {test.id}, user {request.user.id}, code: '{otp_code}'")
        
        # Check if SMSC.kz is configured (for debug info)
        is_smsc_configured = (
            hasattr(settings, 'SMSC_LOGIN') and 
            settings.SMSC_LOGIN and 
            hasattr(settings, 'SMSC_PASSWORD') and 
            settings.SMSC_PASSWORD
        )
        
        # Get current OTP info for debugging (refresh from DB to ensure we have latest)
        verification.refresh_from_db()
        logger.info(f"Verification details: otp_code='{verification.otp_code}', otp_expires_at={verification.otp_expires_at}, verified={verification.verified}")
        
        if not verification.verify_otp(otp_code):
            logger.warning(f"OTP verification failed for test {test.id}, user {request.user.id}, code: '{otp_code}'")
            error_response = {'error': 'Invalid or expired OTP code'}
            if not is_smsc_configured:
                error_response['debug'] = {
                    'provided_code': otp_code,
                    'stored_code': verification.otp_code,
                    'stored_code_exists': bool(verification.otp_code),
                    'expires_at': verification.otp_expires_at.isoformat() if verification.otp_expires_at else None,
                }
            return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"OTP verification successful for test {test.id}, user {request.user.id}")
        
        # Create Protocol
        from apps.protocols.models import Protocol, ProtocolSignature
        from apps.accounts.models import User
        from django.utils import timezone
        
        # Determine protocol parameters
        exam_date = test_attempt.completed_at or timezone.now()
        score = test_attempt.score or 0
        passing_score = test.passing_score
        
        protocol = Protocol.objects.create(
            student=request.user,
            test=test,  # For standalone tests
            course=None,  # No course for standalone tests
            attempt=test_attempt,
            enrollment=None,  # No enrollment for standalone tests
            exam_date=exam_date,
            score=score,
            passing_score=passing_score,
            result='passed',
            status='pending_pdek'
        )
        
        # Create signatures for PDEK members
        pdek_members = User.objects.filter(role__in=['pdek_member', 'pdek_chairman'])
        for member in pdek_members:
            ProtocolSignature.objects.create(
                protocol=protocol,
                signer=member,
                role='chairman' if member.role == 'pdek_chairman' else 'member'
            )
        
        # Create notification for PDEK members
        from apps.notifications.models import Notification
        for member in pdek_members:
            Notification.objects.create(
                user=member,
                type='protocol_ready',
                title='Новый протокол для подписания',
                message=f'Протокол {protocol.number} для теста "{test.title}" готов к подписанию'
            )
        
        return Response({
            'message': 'Test completion verified. Protocol created for PDEK review.',
            'protocol_id': protocol.id
        }, status=status.HTTP_200_OK)


class QuestionViewSet(viewsets.ModelViewSet):
    """Question ViewSet for managing questions"""
    queryset = Question.objects.all()
    serializer_class = QuestionCreateSerializer
    permission_classes = [IsAdminOrReadOnly]
    
    def get_queryset(self):
        """Filter questions by test"""
        queryset = super().get_queryset()
        test_id = self.kwargs.get('test_pk')
        if test_id:
            queryset = queryset.filter(test_id=test_id)
        return queryset
    
    def get_serializer_class(self):
        """Return appropriate serializer"""
        if self.action in ['list', 'retrieve']:
            return QuestionSerializer
        return QuestionCreateSerializer
    
    def perform_create(self, serializer):
        """Set test when creating question"""
        test_id = self.kwargs.get('test_pk')
        if test_id:
            try:
                test = Test.objects.get(id=test_id)
                # Set order if not provided
                if 'order' not in serializer.validated_data:
                    max_order = test.questions.aggregate(max_order=Max('order'))['max_order'] or 0
                    serializer.validated_data['order'] = max_order + 1
                serializer.save(test=test)
            except Test.DoesNotExist:
                from rest_framework.exceptions import NotFound
                raise NotFound('Test not found')
        else:
            serializer.save()

