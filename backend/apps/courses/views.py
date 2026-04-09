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

from .models import Category, Course, Module, Lesson, CourseEnrollment, LessonProgress, CourseCompletionVerification, CourseEnrollmentRequest
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
    CourseEnrollmentRequestSerializer,
    CourseEnrollmentRequestCreateSerializer,
    CourseEnrollmentRequestProcessSerializer,
)
from apps.accounts.permissions import IsAdmin, IsAdminOrReadOnly
from apps.exams.models import TestAttempt
from apps.accounts.models import User
from apps.core.utils import get_request_language
from apps.core.models import get_site_config
from apps.core.export_utils import export_to_excel, create_excel_response


def _course_completion_eligibility(user, course):
    """Returns (enrollment, None) or (None, Response)."""
    enrollment = CourseEnrollment.objects.filter(user=user, course=course).first()
    if not enrollment:
        return None, Response(
            {'error': 'Not enrolled in this course'},
            status=status.HTTP_404_NOT_FOUND,
        )
    total_lessons = Lesson.objects.filter(module__course=course).count()
    completed_lessons = LessonProgress.objects.filter(
        enrollment=enrollment,
        completed=True,
    ).count()
    if completed_lessons < total_lessons:
        return None, Response(
            {'error': 'Not all lessons are completed'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if course.final_test:
        final_ok = TestAttempt.objects.filter(
            user=user,
            test=course.final_test,
            passed=True,
        ).exists()
        if not final_ok:
            return None, Response(
                {'error': 'Final test not passed yet'},
                status=status.HTTP_400_BAD_REQUEST,
            )
    return enrollment, None


def _finalize_course_protocol_creation(request, course, enrollment):
    """Create protocol after course completion (after OTP or when SMS not required)."""
    from apps.protocols.models import Protocol, ProtocolSignature
    from apps.notifications.models import Notification
    from apps.notifications.utils import send_protocol_pdek_notification

    existing = Protocol.objects.filter(enrollment=enrollment).first()
    if existing:
        logger.info(
            'Protocol already exists for enrollment %s, returning existing protocol %s',
            enrollment.id,
            existing.id,
        )
        return Response(
            {
                'message': 'Course completion verified. Protocol already created for EC review.',
                'protocol_id': existing.id,
            },
            status=status.HTTP_200_OK,
        )

    final_test_attempt = None
    if course.final_test:
        final_test_attempt = TestAttempt.objects.filter(
            user=request.user,
            test=course.final_test,
            passed=True,
        ).order_by('-completed_at').first()
        if not final_test_attempt:
            return Response(
                {'error': 'Final test attempt not found'},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
        attempt=final_test_attempt,
        enrollment=enrollment,
        exam_date=exam_date,
        score=score,
        passing_score=passing_score,
        result='passed',
        status='pending_pdek',
    )

    pdek_members = User.objects.filter(role__in=['pdek_member', 'pdek_chairman'])
    for member in pdek_members:
        ProtocolSignature.objects.create(
            protocol=protocol,
            signer=member,
            role='chairman' if member.role == 'pdek_chairman' else 'member',
        )

    enrollment.status = 'pending_pdek'
    enrollment.save()

    for member in pdek_members:
        Notification.objects.create(
            user=member,
            type='protocol_ready',
            title='Новый протокол для подписания',
            message=f'Протокол {protocol.number} для курса "{course.title}" готов к подписанию',
        )

    send_protocol_pdek_notification(protocol)

    return Response(
        {
            'message': 'Course completion verified. Protocol created for EC review.',
            'protocol_id': protocol.id,
        },
        status=status.HTTP_200_OK,
    )


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
        if self.action in ['request_completion_otp', 'verify_completion_otp', 'finalize_completion',
                           'enroll', 'with_progress']:
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
                                          'request_completion_otp', 'verify_completion_otp', 'finalize_completion',
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

    @action(detail=True, methods=['get'], url_path='enrollments/export')
    def export_enrollments(self, request, pk=None):
        """Export course enrollments to Excel (admin only)"""
        if not request.user.is_authenticated or not getattr(request.user, 'is_admin', False):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        course = self.get_object()
        enrollments = CourseEnrollment.objects.filter(course=course).select_related('user').order_by('-enrolled_at')[:5000]
        headers = ['Студент', 'Email', 'Телефон', 'Статус', 'Дата записи', 'Завершён']
        rows = []
        for e in enrollments:
            rows.append([
                e.user.full_name or '',
                e.user.email or '',
                e.user.phone or '',
                e.get_status_display() if hasattr(e, 'get_status_display') else e.status,
                e.enrolled_at.strftime('%Y-%m-%d %H:%M') if e.enrolled_at else '',
                e.completed_at.strftime('%Y-%m-%d') if e.completed_at else '—',
            ])
        buffer = export_to_excel(headers, rows, f'Студенты_{course.title[:30]}')
        return create_excel_response(buffer, f'course_{course.id}_enrollments.xlsx')
    
    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        """Enroll students in course (self-enrollment creates request, admin enrollment is direct)"""
        course = self.get_object()
        user_ids = request.data.get('user_ids', [])
        
        # Self-enrollment: если user_ids не указан, создаем запрос на запись
        if not user_ids:
            # Проверяем, есть ли уже запрос или запись
            existing_request = CourseEnrollmentRequest.objects.filter(
                user=request.user,
                course=course
            ).first()
            
            if existing_request:
                if existing_request.status == 'pending':
                    return Response({
                        'message': 'Request already pending',
                        'request_id': existing_request.id,
                        'status': 'pending'
                    }, status=status.HTTP_200_OK)
                elif existing_request.status == 'approved':
                    # Если запрос одобрен, проверяем наличие enrollment
                    enrollment = CourseEnrollment.objects.filter(
                        user=request.user,
                        course=course
                    ).first()
                    if enrollment:
                        return Response({
                            'message': 'Already enrolled in this course',
                            'enrollment_id': enrollment.id
                        }, status=status.HTTP_200_OK)
            
            # Проверяем, есть ли уже запись
            existing_enrollment = CourseEnrollment.objects.filter(
                user=request.user,
                course=course
            ).first()
            
            if existing_enrollment:
                return Response({
                    'message': 'Already enrolled in this course',
                    'enrollment_id': existing_enrollment.id
                }, status=status.HTTP_200_OK)
            
            site_config = get_site_config()
            if not site_config.require_course_enrollment_request:
                # Прямая запись без запроса администратора
                enrollment = CourseEnrollment.objects.create(
                    user=request.user,
                    course=course,
                    status='assigned'
                )
                return Response({
                    'message': 'Enrolled successfully',
                    'enrollment_id': enrollment.id
                }, status=status.HTTP_201_CREATED)
            
            # Создаем запрос на запись
            enrollment_request = CourseEnrollmentRequest.objects.create(
                user=request.user,
                course=course,
                status='pending'
            )
            
            logger.info(f"Created enrollment request: ID={enrollment_request.id}, User={request.user.phone}, Course={course.title}, Status={enrollment_request.status}")
            
            # Create notification for admin
            from apps.notifications.models import Notification
            from apps.accounts.models import User
            admins = User.objects.filter(role='admin', is_active=True)
            for admin in admins:
                Notification.objects.create(
                    user=admin,
                    type='enrollment_request',
                    title='Новый запрос на запись на курс',
                    message=f'Студент {request.user.full_name or request.user.phone} запросил запись на курс "{course.title}"'
                )
            
            return Response({
                'message': 'Enrollment request created',
                'request_id': enrollment_request.id,
                'status': 'pending'
            }, status=status.HTTP_201_CREATED)
        
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
            
            # Delete course enrollment requests for this course and user
            CourseEnrollmentRequest.objects.filter(
                course=course,
                user_id=user_id
            ).delete()
            
            # Delete test enrollment requests for tests in this course and user
            if course_test_ids:
                from apps.tests.models import TestEnrollmentRequest
                TestEnrollmentRequest.objects.filter(
                    user_id=user_id,
                    test_id__in=course_test_ids
                ).delete()
            
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
        """Get course with student's progress (check for approved enrollment request first)"""
        course = self.get_object()
        enrollment = CourseEnrollment.objects.filter(
            user=request.user,
            course=course
        ).first()
        
        # If not enrolled, check for approved enrollment request
        if not enrollment:
            enrollment_request = CourseEnrollmentRequest.objects.filter(
                user=request.user,
                course=course
            ).first()
            
            if enrollment_request:
                if enrollment_request.status == 'pending':
                    # Request is pending, return error
                    return Response(
                        {
                            'error': 'Enrollment request pending',
                            'message': 'Your enrollment request is pending admin approval',
                            'request_status': 'pending'
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )
                elif enrollment_request.status == 'approved':
                    # Request approved, create enrollment
                    enrollment = CourseEnrollment.objects.create(
                        user=request.user,
                        course=course,
                        status='assigned'
                    )
                else:
                    # Request rejected
                    return Response(
                        {
                            'error': 'Enrollment request rejected',
                            'message': 'Your enrollment request was rejected',
                            'request_status': 'rejected',
                            'admin_response': enrollment_request.admin_response
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )
            else:
                # No enrollment and no request
                site_config = get_site_config()
                if not site_config.require_course_enrollment_request:
                    # Прямой доступ: создаём enrollment автоматически
                    enrollment = CourseEnrollment.objects.create(
                        user=request.user,
                        course=course,
                        status='assigned'
                    )
                else:
                    return Response(
                        {
                            'error': 'Enrollment required',
                            'message': 'You need to request enrollment for this course',
                            'request_status': 'not_requested'
                        },
                        status=status.HTTP_403_FORBIDDEN
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
                    # Log the SMS code
                    logger.warning(f"[SMS CODE] Course Completion - Phone: {user_phone}, Code: {otp_code}, Course: {course.id}")
                    print(f"\n{'='*60}")
                    print(f"⚠️  COURSE COMPLETION SMS CODE")
                    print(f"Phone: {user_phone}")
                    print(f"Code: {otp_code}")
                    print(f"Course ID: {course.id}")
                    print(f"{'='*60}\n")
                    
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
        """Verify OTP and create protocol for EC review"""
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

        return _finalize_course_protocol_creation(request, course, enrollment)

    @action(detail=True, methods=['post'])
    def finalize_completion(self, request, pk=None):
        """Complete course and create protocol without SMS when disabled in site settings."""
        course = self.get_object()
        cfg = get_site_config()
        if cfg.require_sms_for_course_completion:
            return Response(
                {'error': 'SMS confirmation is required for course completion'},
                status=status.HTTP_403_FORBIDDEN,
            )
        enrollment, err = _course_completion_eligibility(request.user, course)
        if err:
            return err
        return _finalize_course_protocol_creation(request, course, enrollment)


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


class CourseEnrollmentRequestViewSet(viewsets.ModelViewSet):
    """Course enrollment request ViewSet"""
    queryset = CourseEnrollmentRequest.objects.select_related('user', 'course', 'processed_by').all()
    serializer_class = CourseEnrollmentRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # Отключить пагинацию для этого ViewSet
    
    def get_queryset(self):
        """Filter requests by user unless admin"""
        queryset = super().get_queryset()
        
        # Проверка прав администратора
        is_admin_user = (
            self.request.user.is_admin or  # Использовать свойство is_admin
            self.request.user.role == 'admin' or 
            self.request.user.is_superuser or 
            self.request.user.is_staff
        )
        
        # Debug: log user info
        logger.info(f"get_queryset - User: {self.request.user.phone}, Role: {self.request.user.role}, is_admin property: {self.request.user.is_admin}, is_admin_user: {is_admin_user}")
        logger.info(f"Total requests in DB: {CourseEnrollmentRequest.objects.count()}")
        
        # If user is admin, return all requests (with optional status filter)
        if is_admin_user:
            status_filter = self.request.query_params.get('status')
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            logger.info(f"Admin queryset - returning {queryset.count()} requests")
            # Admin sees all requests - no additional filtering needed
            return queryset
        else:
            # Non-admin users only see their own requests
            filtered = queryset.filter(user=self.request.user)
            logger.info(f"Non-admin queryset - returning {filtered.count()} requests for user {self.request.user.phone}")
            return filtered
    
    def list(self, request, *args, **kwargs):
        """Override list to add debug logging"""
        is_admin_user = (
            request.user.role == 'admin' or 
            request.user.is_superuser or 
            request.user.is_staff
        )
        logger.info(f"list() - User: {request.user.phone}, Role: {request.user.role}, is_admin: {is_admin_user}")
        logger.info(f"Total requests in DB: {CourseEnrollmentRequest.objects.count()}")
        
        queryset = self.filter_queryset(self.get_queryset())
        logger.info(f"Filtered queryset count: {queryset.count()}")
        
        serializer = self.get_serializer(queryset, many=True)
        logger.info(f"Returning {len(serializer.data)} items")
        return Response(serializer.data)
    
    def get_serializer_class(self):
        """Return appropriate serializer class"""
        if self.action == 'create':
            return CourseEnrollmentRequestCreateSerializer
        elif self.action in ['approve', 'reject']:
            return CourseEnrollmentRequestProcessSerializer
        return CourseEnrollmentRequestSerializer
    
    def create(self, request):
        """Create a new course enrollment request"""
        serializer = CourseEnrollmentRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request data', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        course_id = serializer.validated_data['course_id']
        
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response(
                {'error': 'Course not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if already enrolled
        existing_enrollment = CourseEnrollment.objects.filter(
            user=request.user,
            course=course
        ).first()
        
        if existing_enrollment:
            return Response(
                {'error': 'Already enrolled in this course'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if request already exists
        existing_request = CourseEnrollmentRequest.objects.filter(
            user=request.user,
            course=course
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
        enrollment_request = CourseEnrollmentRequest.objects.create(
            user=request.user,
            course=course,
            status='pending'
        )
        
        logger.info(f"Created enrollment request via create() method: ID={enrollment_request.id}, User={request.user.phone}, Course={course.title}, Status={enrollment_request.status}")
        logger.info(f"Total requests in DB after creation: {CourseEnrollmentRequest.objects.count()}")
        
        # Create notification for admin
        from apps.notifications.models import Notification
        from apps.accounts.models import User
        admins = User.objects.filter(role='admin', is_active=True)
        logger.info(f"Found {admins.count()} admins to notify")
        for admin in admins:
            Notification.objects.create(
                user=admin,
                type='enrollment_request',
                title='Новый запрос на запись на курс',
                message=f'Студент {request.user.full_name or request.user.phone} запросил запись на курс "{course.title}"'
            )
        
        return Response(
            CourseEnrollmentRequestSerializer(enrollment_request).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's enrollment requests"""
        requests = CourseEnrollmentRequest.objects.filter(
            user=request.user
        ).select_related('course', 'processed_by')
        serializer = CourseEnrollmentRequestSerializer(requests, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def debug_info(self, request):
        """Debug endpoint to check admin status and request count"""
        is_admin_user = (
            request.user.role == 'admin' or 
            request.user.is_superuser or 
            request.user.is_staff
        )
        total_requests = CourseEnrollmentRequest.objects.count()
        pending_requests = CourseEnrollmentRequest.objects.filter(status='pending').count()
        
        return Response({
            'user': {
                'phone': request.user.phone,
                'role': request.user.role,
                'is_admin_property': request.user.is_admin,
                'is_admin_user': is_admin_user,
                'is_staff': request.user.is_staff,
                'is_superuser': request.user.is_superuser,
            },
            'requests': {
                'total': total_requests,
                'pending': pending_requests,
            },
            'all_requests': list(CourseEnrollmentRequest.objects.values('id', 'user__phone', 'course__title', 'status')[:10])
        })
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        """Approve course enrollment request (admin only)"""
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
        
        # Create enrollment
        enrollment, created = CourseEnrollment.objects.get_or_create(
            user=enrollment_request.user,
            course=enrollment_request.course,
            defaults={'status': 'assigned'}
        )
        
        # Create notification for student
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=enrollment_request.user,
            type='enrollment_approved',
            title='Запрос на запись на курс одобрен',
            message=f'Ваш запрос на запись на курс "{enrollment_request.course.title}" был одобрен. Теперь вы можете начать обучение.'
        )
        
        return Response(
            CourseEnrollmentRequestSerializer(enrollment_request).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        """Reject course enrollment request (admin only)"""
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
        
        serializer = CourseEnrollmentRequestProcessSerializer(data=request.data)
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
            type='enrollment_rejected',
            title='Запрос на запись на курс отклонен',
            message=f'Ваш запрос на запись на курс "{enrollment_request.course.title}" был отклонен.' + (
                f' Причина: {enrollment_request.admin_response}' if enrollment_request.admin_response else ''
            )
        )
        
        return Response(
            CourseEnrollmentRequestSerializer(enrollment_request).data,
            status=status.HTTP_200_OK
        )

