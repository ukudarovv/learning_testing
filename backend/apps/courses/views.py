from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from django.http import FileResponse, Http404
from django.conf import settings
import os
import subprocess
import logging
import urllib.parse
import tempfile
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

from .models import Category, Course, Module, Lesson, CourseEnrollment, LessonProgress, CourseCompletionVerification
from .serializers import (
    CategorySerializer,
    CourseSerializer,
    CourseCreateUpdateSerializer,
    CourseEnrollmentSerializer,
    LessonProgressSerializer,
    LessonSerializer,
    CourseCompletionVerificationSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
)
from apps.accounts.permissions import IsAdmin, IsAdminOrReadOnly
from apps.exams.models import TestAttempt
from apps.accounts.models import User
from apps.core.utils import get_request_language


class CategoryViewSet(viewsets.ModelViewSet):
    """Category ViewSet"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'name_kz', 'name_en', 'description']
    ordering_fields = ['order', 'name', 'created_at']
    ordering = ['order', 'name']
    
    def get_permissions(self):
        """Allow read access to all, write access only to admins"""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsAdminOrReadOnly()]
    
    def get_queryset(self):
        """Filter categories for public access"""
        queryset = super().get_queryset()
        # Для неавторизованных пользователей показываем только активные категории
        if not hasattr(self.request.user, 'is_authenticated') or not self.request.user.is_authenticated:
            queryset = queryset.filter(is_active=True)
        return queryset


class CourseViewSet(viewsets.ModelViewSet):
    """Course ViewSet"""
    queryset = Course.objects.prefetch_related('modules__lessons').all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'category__id', 'language']
    search_fields = ['title', 'title_kz', 'title_en', 'description']
    ordering_fields = ['created_at', 'title']
    ordering = ['-created_at']
    
    def get_permissions(self):
        """Allow read access to all, write access only to admins"""
        # Allow authenticated users to request and verify completion OTP, self-enroll, and view course with progress
        if self.action in ['request_completion_otp', 'verify_completion_otp', 'enroll', 'with_progress']:
            return [permissions.IsAuthenticated()]
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsAdminOrReadOnly()]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CourseCreateUpdateSerializer
        return CourseSerializer
    
    def get_queryset(self):
        """Filter courses for public access and by language"""
        queryset = super().get_queryset()
        
        # Для detail actions (retrieve, with_progress и т.д.) не применяем фильтрацию по языку
        # чтобы можно было открыть любой курс по ID независимо от языка
        is_detail_action = self.action in ['retrieve', 'with_progress', 'enroll', 'students', 
                                          'request_completion_otp', 'verify_completion_otp',
                                          'revoke_enrollment', 'update', 'partial_update', 'destroy']
        
        # Для неавторизованных пользователей показываем только опубликованные курсы
        if not hasattr(self.request.user, 'is_authenticated') or not self.request.user.is_authenticated:
            queryset = queryset.filter(status='published')
        
        # Фильтрация по языку применяется только для list (список курсов)
        # Для detail actions не применяем, чтобы можно было открыть курс на любом языке
        if not is_detail_action:
            # Для админов (staff) не применяем автоматическую фильтрацию по языку
            is_admin = hasattr(self.request.user, 'is_authenticated') and self.request.user.is_authenticated and (
                self.request.user.is_staff or 
                getattr(self.request.user, 'role', None) == 'admin'
            )
            
            if 'language' not in self.request.query_params and not is_admin:
                lang = get_request_language(self.request)
                queryset = queryset.filter(language=lang)
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        """Get students enrolled in course"""
        course = self.get_object()
        enrollments = CourseEnrollment.objects.filter(course=course).select_related('user')
        serializer = CourseEnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        """Enroll students in course (self-enrollment or admin enrollment)"""
        course = self.get_object()
        user_ids = request.data.get('user_ids', [])
        
        # Self-enrollment: если user_ids не указан, записать текущего пользователя
        if not user_ids:
            enrollment, created = CourseEnrollment.objects.get_or_create(
                user=request.user,
                course=course,
                defaults={'status': 'assigned'}
            )
            if created:
                return Response({
                    'message': 'Successfully enrolled in course',
                    'enrollment_id': enrollment.id
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'message': 'Already enrolled in this course',
                    'enrollment_id': enrollment.id
                }, status=status.HTTP_200_OK)
        
        # Admin enrollment: записать список пользователей (только для админов)
        if not isinstance(user_ids, list):
            return Response({'error': 'user_ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Проверка прав администратора для массовой записи
        if not request.user.is_staff:
            return Response(
                {'error': 'Only admins can enroll multiple users'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        enrolled = []
        for user_id in user_ids:
            try:
                from apps.accounts.models import User
                user = User.objects.get(id=user_id)
                enrollment, created = CourseEnrollment.objects.get_or_create(
                    user=user,
                    course=course,
                    defaults={'status': 'assigned'}
                )
                if created:
                    enrolled.append(user_id)
            except User.DoesNotExist:
                continue
        
        return Response({
            'message': f'Enrolled {len(enrolled)} students',
            'enrolled': enrolled
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def revoke_enrollment(self, request, pk=None):
        """Revoke course enrollment for a student (completely delete enrollment and all related data)"""
        course = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            enrollment = CourseEnrollment.objects.get(
                course=course,
                user_id=user_id
            )
            
            enrollment_id = enrollment.id
            
            # Delete CourseCompletionVerification if exists (OneToOne with enrollment)
            from .models import CourseCompletionVerification
            try:
                verification = CourseCompletionVerification.objects.get(enrollment=enrollment)
                verification.delete()
            except CourseCompletionVerification.DoesNotExist:
                pass
            
            # Get all test IDs for tests in this course
            from apps.tests.models import Test
            from apps.courses.models import Lesson
            course_test_ids = []
            
            # Get tests from lessons (lessons have test_id as string, need to find matching Test objects)
            lesson_test_ids = Lesson.objects.filter(
                module__course=course,
                test_id__isnull=False
            ).exclude(test_id='').values_list('test_id', flat=True).distinct()
            
            # Convert test_id strings to integers and find matching Test objects
            for test_id_str in lesson_test_ids:
                try:
                    test_id = int(test_id_str)
                    if Test.objects.filter(id=test_id).exists():
                        course_test_ids.append(test_id)
                except (ValueError, TypeError):
                    # If test_id is not a valid integer, skip it
                    continue
            
            # Also include final test if exists
            if course.final_test:
                course_test_ids.append(course.final_test.id)
            
            # Delete all test attempts and extra attempt requests for tests in this course by this user
            if course_test_ids:
                from apps.exams.models import TestAttempt, ExtraAttemptRequest
                TestAttempt.objects.filter(
                    user_id=user_id,
                    test_id__in=course_test_ids
                ).delete()
                
                # Delete extra attempt requests for these tests
                ExtraAttemptRequest.objects.filter(
                    user_id=user_id,
                    test_id__in=course_test_ids
                ).delete()
            
            # Delete all certificates related to this course and student
            from apps.certificates.models import Certificate
            Certificate.objects.filter(
                student_id=user_id,
                course=course
            ).delete()
            
            # Delete all protocols related to this enrollment
            # (Protocols will be deleted via CASCADE, but we delete explicitly to ensure certificates are handled)
            from apps.protocols.models import Protocol
            Protocol.objects.filter(
                enrollment=enrollment
            ).delete()
            
            # Delete all lesson progress for this enrollment
            # (CASCADE will handle this, but we do it explicitly for clarity)
            LessonProgress.objects.filter(enrollment=enrollment).delete()
            
            # Delete enrollment (CASCADE will also delete related data)
            enrollment.delete()
            
            return Response({
                'message': 'Course enrollment and all related data deleted successfully',
                'enrollment_id': enrollment_id
            }, status=status.HTTP_200_OK)
        except CourseEnrollment.DoesNotExist:
            return Response(
                {'error': 'Enrollment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'])
    def my_enrollments(self, request):
        """Get current user's enrollments"""
        enrollments = CourseEnrollment.objects.filter(
            user=request.user
        ).select_related('course').prefetch_related('course__modules__lessons')
        
        serializer = CourseEnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def with_progress(self, request, pk=None):
        """Get course with student's progress (auto-enroll if not enrolled)"""
        course = self.get_object()
        enrollment = CourseEnrollment.objects.filter(
            user=request.user,
            course=course
        ).first()
        
        # Auto-enroll if not enrolled
        if not enrollment:
            enrollment = CourseEnrollment.objects.create(
                user=request.user,
                course=course,
                status='assigned'
            )
        
        # Get lesson progress
        lesson_progress = {
            lp.lesson_id: lp.completed 
            for lp in LessonProgress.objects.filter(enrollment=enrollment)
        }
        
        # Serialize course with progress info
        serializer = self.get_serializer(course)
        data = serializer.data
        
        # Add completed status to each lesson
        if 'modules' in data:
            for module in data['modules']:
                if 'lessons' in module:
                    for lesson in module['lessons']:
                        lesson['completed'] = lesson_progress.get(lesson['id'], False)
        
        data['progress'] = enrollment.progress
        data['enrollment_status'] = enrollment.status
        
        return Response(data)
    
    @action(detail=True, methods=['post'])
    def request_completion_otp(self, request, pk=None):
        """Request OTP for course completion verification"""
        course = self.get_object()
        
        # Get user's enrollment
        enrollment = CourseEnrollment.objects.filter(
            user=request.user,
            course=course
        ).first()
        
        if not enrollment:
            return Response(
                {'error': 'Not enrolled in this course'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if all lessons are completed
        total_lessons = Lesson.objects.filter(module__course=course).count()
        completed_lessons = LessonProgress.objects.filter(
            enrollment=enrollment,
            completed=True
        ).count()
        
        if completed_lessons < total_lessons:
            return Response(
                {'error': 'Not all lessons are completed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # If final test exists, check if it's passed
        if course.final_test:
            final_test_attempt = TestAttempt.objects.filter(
                user=request.user,
                test=course.final_test,
                passed=True
            ).order_by('-completed_at').first()
            
            if not final_test_attempt:
                return Response(
                    {'error': 'Final test not passed yet'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create or get verification
        verification, created = CourseCompletionVerification.objects.get_or_create(
            enrollment=enrollment
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
                logger.info(f"Using existing valid OTP for enrollment {enrollment.id}")
            else:
                # OTP истек, нужно сгенерировать новый
                logger.info(f"Existing OTP expired for enrollment {enrollment.id}, generating new one")
        
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
                    logger.info(f"Attempting to send SMS to {user_phone} for course completion {course.id}")
                    logger.info(f"OTP code generated: {otp_code}")
                    logger.info(f"SMSC.kz configured: login={settings.SMSC_LOGIN}, password={'***' if settings.SMSC_PASSWORD else 'Not set'}")
                    
                    sms_result = sms_service.send_verification_code(
                        user_phone,
                        otp_code,
                        'verification'  # Using 'verification' purpose for course completion
                    )
                    
                    logger.info(f"SMS result: {sms_result}")
                    
                    if sms_result['success']:
                        sms_sent = True
                        logger.info(f"SMS sent successfully to {user_phone} for course {course.id}")
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
        course = self.get_object()
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        otp_code = serializer.validated_data['otp_code']
        
        # Get user's enrollment
        enrollment = CourseEnrollment.objects.filter(
            user=request.user,
            course=course
        ).first()
        
        if not enrollment:
            return Response(
                {'error': 'Not enrolled in this course'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get verification
        try:
            verification = CourseCompletionVerification.objects.get(enrollment=enrollment)
        except CourseCompletionVerification.DoesNotExist:
            return Response(
                {'error': 'Verification not found. Please request OTP first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify OTP
        import logging
        from django.conf import settings
        
        logger = logging.getLogger(__name__)
        logger.info(f"Attempting to verify OTP for course {course.id}, user {request.user.id}, code: '{otp_code}'")
        
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
            logger.warning(f"OTP verification failed for course {course.id}, user {request.user.id}, code: '{otp_code}'")
            error_response = {'error': 'Invalid or expired OTP code'}
            if not is_smsc_configured:
                error_response['debug'] = {
                    'provided_code': otp_code,
                    'stored_code': verification.otp_code,
                    'stored_code_exists': bool(verification.otp_code),
                    'expires_at': verification.otp_expires_at.isoformat() if verification.otp_expires_at else None,
                }
            return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"OTP verification successful for course {course.id}, user {request.user.id}")
        
        # Get final test attempt if exists
        final_test_attempt = None
        if course.final_test:
            final_test_attempt = TestAttempt.objects.filter(
                user=request.user,
                test=course.final_test,
                passed=True
            ).order_by('-completed_at').first()
            
            if not final_test_attempt:
                return Response(
                    {'error': 'Final test attempt not found'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create Protocol
        from apps.protocols.models import Protocol, ProtocolSignature
        from django.utils import timezone
        
        # Determine protocol parameters
        if final_test_attempt:
            exam_date = final_test_attempt.completed_at or timezone.now()
            score = final_test_attempt.score or 0
            passing_score = course.final_test.passing_score
        else:
            exam_date = timezone.now()
            score = 0
            passing_score = course.passing_score
        
        protocol = Protocol.objects.create(
            student=request.user,
            course=course,
            attempt=final_test_attempt,  # Can be None if no final test
            enrollment=enrollment,
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
        
        # Update enrollment status to 'pending_pdek' after protocol creation
        enrollment.status = 'pending_pdek'
        enrollment.save()
        
        # After all PDEK members sign, enrollment status will be changed to 'completed' in protocols/views.py
        
        # Create notification for PDEK members
        from apps.notifications.models import Notification
        for member in pdek_members:
            Notification.objects.create(
                user=member,
                type='protocol_ready',
                title='Новый протокол для подписания',
                message=f'Протокол {protocol.number} для курса "{course.title}" готов к подписанию'
            )
        
        return Response({
            'message': 'Course completion verified. Protocol created for PDEK review.',
            'protocol_id': protocol.id
        }, status=status.HTTP_200_OK)


class LessonViewSet(viewsets.ReadOnlyModelViewSet):
    """Lesson ViewSet (read-only)"""
    queryset = Lesson.objects.select_related('module__course').all()
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LessonSerializer
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark lesson as completed"""
        lesson = self.get_object()
        
        # Find user's enrollment for this course
        enrollment = CourseEnrollment.objects.filter(
            user=request.user,
            course=lesson.module.course
        ).first()
        
        if not enrollment:
            return Response(
                {'error': 'You are not enrolled in this course'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create or update lesson progress
        progress, created = LessonProgress.objects.get_or_create(
            enrollment=enrollment,
            lesson=lesson,
            defaults={'completed': True, 'completed_at': timezone.now()}
        )
        
        if not created and not progress.completed:
            progress.completed = True
            progress.completed_at = timezone.now()
            progress.save()
        
        # Update course progress
        total_lessons = Lesson.objects.filter(module__course=enrollment.course).count()
        completed_lessons = LessonProgress.objects.filter(
            enrollment=enrollment,
            completed=True
        ).count()
        
        enrollment.progress = int((completed_lessons / total_lessons * 100) if total_lessons > 0 else 0)
        enrollment.save()
        
        # Check if all lessons are completed
        # Status will be changed to 'pending_pdek' after SMS verification
        all_lessons_completed = completed_lessons >= total_lessons and total_lessons > 0
        
        return Response({
            'message': 'Lesson completed',
            'progress': enrollment.progress,
            'all_lessons_completed': all_lessons_completed
        }, status=status.HTTP_200_OK)
    
    def ppt_to_pdf(self, request, pk=None):
        """Convert PPT/PPTX file to PDF"""
        logger.info(f'ppt_to_pdf called with pk={pk}, user={request.user.id if request.user.is_authenticated else "anonymous"}')
        
        try:
            lesson = self.get_object()
            logger.info(f'Lesson found: id={lesson.id}, ppt_url={lesson.ppt_url}')
        except Exception as e:
            logger.error(f'Error getting lesson with pk={pk}: {str(e)}')
            return Response(
                {'error': f'Lesson not found: {str(e)}'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        ppt_url = lesson.ppt_url or ''
        if not ppt_url:
            logger.warning(f'PPT URL not found for lesson {lesson.id}')
            return Response(
                {'error': 'PPT URL not found for this lesson'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Build full URL
        if ppt_url.startswith('/'):
            # Relative URL - build absolute URL
            api_base_url = request.build_absolute_uri('/').rstrip('/')
            full_ppt_url = f"{api_base_url}{ppt_url}"
        elif ppt_url.startswith('http'):
            # Absolute URL
            full_ppt_url = ppt_url
        else:
            return Response(
                {'error': 'Invalid PPT URL format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check file extension
        parsed_url = urllib.parse.urlparse(ppt_url)
        file_ext = os.path.splitext(parsed_url.path)[1].lower()
        if file_ext not in ['.ppt', '.pptx']:
            return Response(
                {'error': 'File must be PPT or PPTX format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create cache directory for converted PDFs
        cache_dir = os.path.join(settings.MEDIA_ROOT, 'ppt_cache')
        os.makedirs(cache_dir, exist_ok=True)
        
        # Generate cache filename
        cache_filename = f"lesson_{lesson.id}_{os.path.basename(parsed_url.path)}.pdf"
        cache_path = os.path.join(cache_dir, cache_filename)
        
        # Check if PDF already exists in cache
        if os.path.exists(cache_path):
            logger.info(f'PDF cache hit: {cache_path}')
            return FileResponse(
                open(cache_path, 'rb'),
                content_type='application/pdf',
                filename=os.path.basename(cache_path),
                as_attachment=False  # Display inline
            )
        
        # Download PPT file temporarily
        try:
            # Prepare headers for authenticated request
            headers = {}
            if request.user.is_authenticated:
                # Try to get authorization token from request
                auth_header = request.META.get('HTTP_AUTHORIZATION', '')
                if auth_header:
                    headers['Authorization'] = auth_header
            
            # Download file
            response = requests.get(full_ppt_url, headers=headers, timeout=30)
            response.raise_for_status()
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
                tmp_file.write(response.content)
                tmp_ppt_path = tmp_file.name
            
            # Convert to PDF
            if self._convert_with_libreoffice(tmp_ppt_path, cache_path):
                # Clean up temp file
                os.unlink(tmp_ppt_path)
                
                logger.info(f'Successfully converted PPT to PDF: {cache_path}')
                return FileResponse(
                    open(cache_path, 'rb'),
                    content_type='application/pdf',
                    filename=os.path.basename(cache_path),
                    as_attachment=False
                )
            else:
                # Clean up temp file
                os.unlink(tmp_ppt_path)
                return Response(
                    {'error': 'LibreOffice not available. Please install LibreOffice for PPT/PPTX conversion.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
                
        except requests.RequestException as e:
            logger.error(f'Error downloading PPT file: {str(e)}')
            return Response(
                {'error': f'Failed to download PPT file: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f'Error converting PPT to PDF: {str(e)}')
            return Response(
                {'error': f'Conversion failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _convert_with_libreoffice(self, input_path, output_path):
        """Convert PPT/PPTX to PDF using LibreOffice headless"""
        try:
            # Create output directory if it doesn't exist
            output_dir = os.path.dirname(output_path)
            os.makedirs(output_dir, exist_ok=True)
            
            # Try different LibreOffice command names
            libreoffice_cmd = None
            for cmd in ['libreoffice', 'soffice', '/usr/bin/libreoffice', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe']:
                try:
                    result = subprocess.run(
                        [cmd, '--version'],
                        capture_output=True,
                        timeout=5
                    )
                    if result.returncode == 0:
                        libreoffice_cmd = cmd
                        break
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    continue
            
            if not libreoffice_cmd:
                logger.warning('LibreOffice not found')
                return False
            
            # Convert file
            result = subprocess.run(
                [
                    libreoffice_cmd,
                    '--headless',
                    '--convert-to', 'pdf',
                    '--outdir', output_dir,
                    input_path
                ],
                capture_output=True,
                timeout=60,  # 60 seconds timeout
                cwd=output_dir
            )
            
            if result.returncode == 0:
                # LibreOffice outputs PDF with same name but .pdf extension
                expected_pdf = os.path.join(
                    output_dir,
                    os.path.basename(input_path).replace(os.path.splitext(input_path)[1], '.pdf')
                )
                
                if os.path.exists(expected_pdf):
                    # Rename to match expected output path if different
                    if expected_pdf != output_path:
                        os.rename(expected_pdf, output_path)
                    return True
                else:
                    logger.warning(f'PDF file not found after conversion: {expected_pdf}')
                    return False
            else:
                logger.error(f'LibreOffice conversion failed: {result.stderr.decode()}')
                return False
                
        except subprocess.TimeoutExpired:
            logger.error('LibreOffice conversion timeout')
            return False
        except Exception as e:
            logger.error(f'Error in LibreOffice conversion: {str(e)}')
            return False

