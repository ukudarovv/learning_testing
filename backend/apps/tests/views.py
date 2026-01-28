from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Max
from django.utils import timezone

from .models import Test, Question, TestCompletionVerification, TestEnrollmentRequest, TestAssignment
from .serializers import (
    TestSerializer,
    QuestionSerializer,
    QuestionCreateSerializer,
    TestEnrollmentRequestSerializer,
    TestEnrollmentRequestCreateSerializer,
    TestEnrollmentRequestProcessSerializer,
    TestAssignmentSerializer,
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
    
    def paginate_queryset(self, queryset):
        """Disable pagination for questions action"""
        if self.action == 'questions':
            return None
        return super().paginate_queryset(queryset)
    
    @action(detail=True, methods=['get', 'post'])
    def questions(self, request, pk=None):
        """Get or add questions to test"""
        test = self.get_object()
        
        if request.method == 'GET':
            questions = test.questions.all().order_by('order', 'id')
            serializer = QuestionSerializer(questions, many=True)
            # Возвращаем данные напрямую без пагинации
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
        
        # Check if test is standalone (must have category and is_standalone=False, meaning not used in courses)
        if test.is_standalone or not test.category:
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
    
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign test to students (admin only)"""
        test = self.get_object()
        user_ids = request.data.get('user_ids', [])
        
        if not isinstance(user_ids, list):
            return Response({'error': 'user_ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Проверка прав администратора
        if not request.user.is_staff:
            return Response(
                {'error': 'Only admins can assign tests'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        assigned = []
        for user_id in user_ids:
            try:
                from apps.accounts.models import User
                user = User.objects.get(id=user_id)
                assignment, created = TestAssignment.objects.get_or_create(
                    user=user,
                    test=test,
                    defaults={
                        'status': 'assigned',
                        'assigned_by': request.user
                    }
                )
                if created:
                    assigned.append(user_id)
                    # Создаем уведомление для студента
                    from apps.notifications.models import Notification
                    Notification.objects.create(
                        user=user,
                        type='test_assigned',
                        title='Тест назначен',
                        message=f'Вам назначен тест "{test.title}"'
                    )
            except User.DoesNotExist:
                continue
        
        return Response({
            'message': f'Assigned test to {len(assigned)} students',
            'assigned': assigned
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def revoke_assignment(self, request, pk=None):
        """Revoke test assignment for a student (admin only)"""
        test = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Проверка прав администратора
        if not request.user.is_staff:
            return Response(
                {'error': 'Only admins can revoke test assignments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            assignment = TestAssignment.objects.get(test=test, user_id=user_id)
            assignment.status = 'revoked'
            assignment.save()
            
            # Создаем уведомление для студента
            from apps.notifications.models import Notification
            Notification.objects.create(
                user=assignment.user,
                type='test_assignment_revoked',
                title='Назначение теста отозвано',
                message=f'Назначение теста "{test.title}" было отозвано администратором'
            )
            
            return Response({
                'message': 'Test assignment revoked successfully'
            }, status=status.HTTP_200_OK)
        except TestAssignment.DoesNotExist:
            return Response(
                {'error': 'Test assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'])
    def assignments(self, request, pk=None):
        """Get test assignments for this test"""
        test = self.get_object()
        
        # Админы видят все назначения, студенты - только свои
        if request.user.is_staff:
            assignments = TestAssignment.objects.filter(test=test).select_related('user', 'assigned_by')
        else:
            assignments = TestAssignment.objects.filter(test=test, user=request.user).select_related('user', 'assigned_by')
        
        serializer = TestAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)


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


class TestEnrollmentRequestViewSet(viewsets.ModelViewSet):
    """Test enrollment request ViewSet"""
    queryset = TestEnrollmentRequest.objects.select_related('user', 'test', 'processed_by').all()
    serializer_class = TestEnrollmentRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Отключить пагинацию для этого ViewSet
    
    def get_queryset(self):
        """Filter requests by user unless admin"""
        queryset = super().get_queryset()
        
        # Проверка прав администратора
        is_admin_user = (
            self.request.user.is_admin or
            self.request.user.role == 'admin' or 
            self.request.user.is_superuser or 
            self.request.user.is_staff
        )
        
        if not is_admin_user:
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
            return TestEnrollmentRequestCreateSerializer
        elif self.action in ['approve', 'reject']:
            return TestEnrollmentRequestProcessSerializer
        return TestEnrollmentRequestSerializer
    
    def create(self, request):
        """Create a new test enrollment request"""
        serializer = TestEnrollmentRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request data', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        test_id = serializer.validated_data['test_id']
        
        try:
            test = Test.objects.get(id=test_id)
        except Test.DoesNotExist:
            return Response(
                {'error': 'Test not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Убрана проверка is_standalone - теперь запросы можно создавать для всех тестов
        
        # Check if request already exists
        existing_request = TestEnrollmentRequest.objects.filter(
            user=request.user,
            test=test
        ).first()
        
        if existing_request:
            if existing_request.status == 'pending':
                return Response(
                    {'error': 'Request already pending'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif existing_request.status == 'approved':
                return Response(
                    {'error': 'Request already approved'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create request
        enrollment_request = TestEnrollmentRequest.objects.create(
            user=request.user,
            test=test,
            status='pending'
        )
        
        # Create notification for admin
        from apps.notifications.models import Notification
        from apps.accounts.models import User
        admins = User.objects.filter(role='admin', is_active=True)
        for admin in admins:
            Notification.objects.create(
                user=admin,
                type='test_enrollment_request',
                title='Новый запрос на запись на тест',
                message=f'Студент {request.user.full_name or request.user.phone} запросил запись на тест "{test.title}"'
            )
        
        return Response(
            TestEnrollmentRequestSerializer(enrollment_request).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's enrollment requests"""
        requests = TestEnrollmentRequest.objects.filter(
            user=request.user
        ).select_related('test', 'processed_by')
        serializer = TestEnrollmentRequestSerializer(requests, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        """Approve test enrollment request (admin only)"""
        if not request.user.is_admin:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        enrollment_request = self.get_object()
        
        if enrollment_request.status != 'pending':
            return Response(
                {'error': f'Request is already {enrollment_request.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Approve request
        enrollment_request.status = 'approved'
        enrollment_request.processed_by = request.user
        enrollment_request.processed_at = timezone.now()
        if request.data.get('admin_response'):
            enrollment_request.admin_response = request.data['admin_response']
        enrollment_request.save()
        
        # Create notification for student
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=enrollment_request.user,
            type='test_enrollment_approved',
            title='Запрос на запись на тест одобрен',
            message=f'Ваш запрос на запись на тест "{enrollment_request.test.title}" был одобрен. Теперь вы можете пройти тест.'
        )
        
        return Response(
            TestEnrollmentRequestSerializer(enrollment_request).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        """Reject test enrollment request (admin only)"""
        if not request.user.is_admin:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        enrollment_request = self.get_object()
        
        if enrollment_request.status != 'pending':
            return Response(
                {'error': f'Request is already {enrollment_request.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = TestEnrollmentRequestProcessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Reject request
        enrollment_request.status = 'rejected'
        enrollment_request.processed_by = request.user
        enrollment_request.processed_at = timezone.now()
        enrollment_request.admin_response = serializer.validated_data.get('admin_response', '')
        enrollment_request.save()
        
        # Create notification for student
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=enrollment_request.user,
            type='test_enrollment_rejected',
            title='Запрос на запись на тест отклонен',
            message=f'Ваш запрос на запись на тест "{enrollment_request.test.title}" был отклонен.' + (
                f' Причина: {enrollment_request.admin_response}' if enrollment_request.admin_response else ''
            )
        )
        
        return Response(
            TestEnrollmentRequestSerializer(enrollment_request).data,
            status=status.HTTP_200_OK
        )


class TestEnrollmentRequestViewSet(viewsets.ModelViewSet):
    """Test enrollment request ViewSet"""
    queryset = TestEnrollmentRequest.objects.select_related('user', 'test', 'processed_by').all()
    serializer_class = TestEnrollmentRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Отключить пагинацию для этого ViewSet
    
    def get_queryset(self):
        """Filter requests by user unless admin"""
        queryset = super().get_queryset()
        
        # Проверка прав администратора
        is_admin_user = (
            self.request.user.is_admin or
            self.request.user.role == 'admin' or 
            self.request.user.is_superuser or 
            self.request.user.is_staff
        )
        
        if not is_admin_user:
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
            return TestEnrollmentRequestCreateSerializer
        elif self.action in ['approve', 'reject']:
            return TestEnrollmentRequestProcessSerializer
        return TestEnrollmentRequestSerializer
    
    def create(self, request):
        """Create a new test enrollment request"""
        serializer = TestEnrollmentRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request data', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        test_id = serializer.validated_data['test_id']
        
        try:
            test = Test.objects.get(id=test_id)
        except Test.DoesNotExist:
            return Response(
                {'error': 'Test not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Убрана проверка is_standalone - теперь запросы можно создавать для всех тестов
        
        # Check if request already exists
        existing_request = TestEnrollmentRequest.objects.filter(
            user=request.user,
            test=test
        ).first()
        
        if existing_request:
            if existing_request.status == 'pending':
                return Response(
                    {'error': 'Request already pending'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif existing_request.status == 'approved':
                return Response(
                    {'error': 'Request already approved'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create request
        enrollment_request = TestEnrollmentRequest.objects.create(
            user=request.user,
            test=test,
            status='pending'
        )
        
        # Create notification for admin
        from apps.notifications.models import Notification
        from apps.accounts.models import User
        admins = User.objects.filter(role='admin', is_active=True)
        for admin in admins:
            Notification.objects.create(
                user=admin,
                type='test_enrollment_request',
                title='Новый запрос на запись на тест',
                message=f'Студент {request.user.full_name or request.user.phone} запросил запись на тест "{test.title}"'
            )
        
        return Response(
            TestEnrollmentRequestSerializer(enrollment_request).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's enrollment requests"""
        requests = TestEnrollmentRequest.objects.filter(
            user=request.user
        ).select_related('test', 'processed_by')
        serializer = TestEnrollmentRequestSerializer(requests, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        """Approve test enrollment request (admin only)"""
        if not request.user.is_admin:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        enrollment_request = self.get_object()
        
        if enrollment_request.status != 'pending':
            return Response(
                {'error': f'Request is already {enrollment_request.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Approve request
        enrollment_request.status = 'approved'
        enrollment_request.processed_by = request.user
        enrollment_request.processed_at = timezone.now()
        if request.data.get('admin_response'):
            enrollment_request.admin_response = request.data['admin_response']
        enrollment_request.save()
        
        # Create notification for student
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=enrollment_request.user,
            type='test_enrollment_approved',
            title='Запрос на запись на тест одобрен',
            message=f'Ваш запрос на запись на тест "{enrollment_request.test.title}" был одобрен. Теперь вы можете пройти тест.'
        )
        
        return Response(
            TestEnrollmentRequestSerializer(enrollment_request).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        """Reject test enrollment request (admin only)"""
        if not request.user.is_admin:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        enrollment_request = self.get_object()
        
        if enrollment_request.status != 'pending':
            return Response(
                {'error': f'Request is already {enrollment_request.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = TestEnrollmentRequestProcessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Reject request
        enrollment_request.status = 'rejected'
        enrollment_request.processed_by = request.user
        enrollment_request.processed_at = timezone.now()
        enrollment_request.admin_response = serializer.validated_data.get('admin_response', '')
        enrollment_request.save()
        
        # Create notification for student
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=enrollment_request.user,
            type='test_enrollment_rejected',
            title='Запрос на запись на тест отклонен',
            message=f'Ваш запрос на запись на тест "{enrollment_request.test.title}" был отклонен.' + (
                f' Причина: {enrollment_request.admin_response}' if enrollment_request.admin_response else ''
            )
        )
        
        return Response(
            TestEnrollmentRequestSerializer(enrollment_request).data,
            status=status.HTTP_200_OK
        )

