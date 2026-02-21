from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import HttpResponse, FileResponse
from django.utils import timezone
import mimetypes
import os

from .models import Protocol, ProtocolSignature
from apps.core.export_utils import export_to_excel, create_excel_response
from .serializers import (
    ProtocolSerializer,
    ProtocolCreateSerializer,
    ProtocolUpdateSerializer,
    ProtocolSignatureSerializer,
    OTPRequestSerializer,
    OTPSignSerializer,
)
from .utils import generate_protocol_pdf
from apps.accounts.permissions import IsAdmin, IsAdminOrReadOnly
from apps.accounts.models import User


class ProtocolViewSet(viewsets.ModelViewSet):
    """Protocol ViewSet"""
    queryset = Protocol.objects.select_related('student', 'course', 'test', 'attempt', 'enrollment', 'uploaded_by').prefetch_related('signatures__signer').all()
    serializer_class = ProtocolSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'result']
    search_fields = ['number', 'student__full_name', 'student__phone', 'course__title']
    ordering_fields = ['created_at', 'exam_date']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Students see only their protocols; admin and PDEK see all"""
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and user.role == 'student' and not user.is_admin:
            queryset = queryset.filter(student=user)
        return queryset
    
    def get_permissions(self):
        """Allow PDEK members to request and sign protocols"""
        # Allow authenticated users to request signature and sign protocols
        # (role check is done inside the action methods)
        if self.action in ['request_signature', 'sign']:
            return [permissions.IsAuthenticated()]
        # Default permissions for other actions (IsAdminOrReadOnly)
        return [IsAdminOrReadOnly()]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ProtocolCreateSerializer
        if self.action in ['update', 'partial_update']:
            return ProtocolUpdateSerializer
        return ProtocolSerializer
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve protocol with full related data"""
        import logging
        logger = logging.getLogger(__name__)
        
        instance = self.get_object()
        logger.info(f'Retrieving protocol {instance.id}: student={instance.student}, course={instance.course}, attempt={instance.attempt}')
        
        serializer = self.get_serializer(instance)
        data = serializer.data
        logger.info(f'Protocol serialized data keys: {list(data.keys())}')
        logger.info(f'Protocol student data: {data.get("student")}')
        logger.info(f'Protocol course data: {data.get("course")}')
        
        return Response(data)
    
    def create(self, request, *args, **kwargs):
        """Create protocol from test attempt"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        attempt_id = serializer.validated_data.get('attempt')
        if attempt_id:
            from apps.exams.models import TestAttempt
            try:
                attempt = TestAttempt.objects.get(id=attempt_id.id if hasattr(attempt_id, 'id') else attempt_id)
                protocol = Protocol.objects.create(
                    student=serializer.validated_data['student'],
                    course=serializer.validated_data['course'],
                    attempt=attempt,
                    exam_date=serializer.validated_data['exam_date'],
                    score=serializer.validated_data['score'],
                    passing_score=serializer.validated_data['passing_score'],
                    result=serializer.validated_data['result'],
                )
                
                # Create signatures for PDEK members
                pdek_members = User.objects.filter(role__in=['pdek_member', 'pdek_chairman'])
                for member in pdek_members:
                    ProtocolSignature.objects.create(
                        protocol=protocol,
                        signer=member,
                        role='chairman' if member.role == 'pdek_chairman' else 'member'
                    )
                
                return Response(ProtocolSerializer(protocol).data, status=status.HTTP_201_CREATED)
            except TestAttempt.DoesNotExist:
                pass
        
        protocol = serializer.save()
        return Response(ProtocolSerializer(protocol).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def request_signature(self, request, pk=None):
        """Request OTP for signature"""
        import logging
        logger = logging.getLogger(__name__)
        
        protocol = self.get_object()
        logger.info(f'Request signature for protocol {protocol.id}: student={protocol.student}, course={protocol.course}')
        
        # Check if user is PDEK member
        if request.user.role not in ['pdek_member', 'pdek_chairman']:
            return Response(
                {'error': 'Only PDEK members can sign protocols'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get or create signature
        signature, created = ProtocolSignature.objects.get_or_create(
            protocol=protocol,
            signer=request.user
        )
        
        # Always generate new OTP, even if signature already exists
        # This allows re-requesting OTP if it expired or was not received
        otp_code = signature.generate_otp()
        
        # Log the SMS code
        logger.warning(f"[SMS CODE] Protocol Sign - Phone: {request.user.phone}, Code: {otp_code}, Protocol: {protocol.number}")
        print(f"\n{'='*60}")
        print(f"⚠️  PROTOCOL SIGN SMS CODE")
        print(f"Phone: {request.user.phone}")
        print(f"Code: {otp_code}")
        print(f"Protocol: {protocol.number}")
        print(f"{'='*60}\n")
        
        # Send SMS via SMSC.kz
        sms_sent = False
        sms_error = None
        try:
            from apps.accounts.sms_service import sms_service
            from django.conf import settings
            
            logger.info(f"Attempting to send SMS to {request.user.phone} for protocol {protocol.number}")
            sms_result = sms_service.send_verification_code(
                request.user.phone,
                otp_code,
                'protocol_sign'
            )
            
            if sms_result['success']:
                sms_sent = True
                logger.info(f"SMS sent successfully to {request.user.phone}")
            else:
                sms_error = sms_result.get('error', 'Unknown error')
                logger.error(f"Failed to send SMS via SMSC.kz: {sms_error}")
                logger.error(f"SMS result: {sms_result}")
        except Exception as e:
            sms_error = str(e)
            logger.error(f"Exception while sending SMS: {sms_error}", exc_info=True)
        
        response_data = {
            'message': 'OTP code sent to your phone' if sms_sent else 'OTP code generated',
            'otp_expires_at': signature.otp_expires_at.isoformat() if signature.otp_expires_at else None,
            'sms_sent': sms_sent,
        }
        
        # Add error info if SMS failed
        if sms_error:
            response_data['sms_error'] = sms_error
            response_data['warning'] = 'SMS sending failed, but OTP code was generated'
        
        # В режиме разработки (без SMSC.kz или при ошибке) возвращаем OTP код в ответе для тестирования
        from django.conf import settings
        is_smsc_configured = (
            hasattr(settings, 'SMSC_LOGIN') and 
            settings.SMSC_LOGIN and 
            hasattr(settings, 'SMSC_PASSWORD') and 
            settings.SMSC_PASSWORD
        )
        
        if not is_smsc_configured or not sms_sent:
            response_data['otp_code'] = otp_code
            response_data['debug'] = True
            if not is_smsc_configured:
                response_data['debug_reason'] = 'SMSC.kz not configured'
            elif not sms_sent:
                response_data['debug_reason'] = f'SMS sending failed: {sms_error}'
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """Sign protocol with OTP"""
        protocol = self.get_object()
        serializer = OTPSignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        otp_code = serializer.validated_data['otp']
        
        # Get signature
        try:
            signature = ProtocolSignature.objects.get(
                protocol=protocol,
                signer=request.user
            )
        except ProtocolSignature.DoesNotExist:
            return Response(
                {'error': 'Signature not found. Please request OTP first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify OTP
        if not signature.verify_otp(otp_code):
            return Response(
                {'error': 'Invalid or expired OTP code'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Refresh protocol and signatures from DB to get latest data
        protocol.refresh_from_db()
        
        # Check if all PDEK members have signed
        all_signed = protocol.signatures.filter(otp_verified=True).count()
        total_signatures = protocol.signatures.count()
        
        # Update protocol status based on signing progress
        if all_signed == total_signatures:
            # All members signed - protocol is fully signed
            protocol.status = 'signed_chairman'
        elif signature.role == 'chairman':
            protocol.status = 'signed_chairman'
        elif all_signed > 0:
            protocol.status = 'signed_members'
        else:
            protocol.status = 'pending_pdek'
        
        protocol.save()
        
        # If chairman signed and protocol is for course or test completion, create certificate
        # Check if chairman just signed (status is signed_chairman)
        if protocol.status == 'signed_chairman' and (protocol.enrollment or protocol.test):
            from apps.certificates.models import Certificate
            from apps.notifications.models import Notification
            from django.utils import timezone
            
            # Determine if this is for a course or test
            is_course = protocol.course is not None
            is_test = protocol.test is not None
            
            # Check if certificate already exists to avoid duplicates
            certificate_exists = False
            if is_course:
                certificate_exists = Certificate.objects.filter(
                    protocol=protocol, 
                    student=protocol.student, 
                    course=protocol.course
                ).exists()
            elif is_test:
                certificate_exists = Certificate.objects.filter(
                    protocol=protocol, 
                    student=protocol.student, 
                    test=protocol.test
                ).exists()
            
            if not certificate_exists:
                # Create certificate
                certificate_data = {
                    'student': protocol.student,
                    'protocol': protocol
                }
                if is_course:
                    certificate_data['course'] = protocol.course
                elif is_test:
                    certificate_data['test'] = protocol.test
                
                certificate = Certificate.objects.create(**certificate_data)
                
                # Update enrollment status to completed if it's a course
                if protocol.enrollment:
                    protocol.enrollment.status = 'completed'
                    protocol.enrollment.completed_at = timezone.now()
                    protocol.enrollment.save()
                
                # Notify student
                if is_course:
                    message = f'Ваш сертификат по курсу "{protocol.course.title}" готов. Номер сертификата: {certificate.number}'
                elif is_test:
                    message = f'Ваш сертификат по тесту "{protocol.test.title}" готов. Номер сертификата: {certificate.number}'
                else:
                    message = f'Ваш сертификат готов. Номер сертификата: {certificate.number}'
                
                Notification.objects.create(
                    user=protocol.student,
                    type='certificate_issued',
                    title='Сертификат выдан',
                    message=message
                )
        
        return Response(
            ProtocolSerializer(protocol).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Download protocol - uploaded file if exists, else generated PDF"""
        protocol = self.get_object()
        
        if protocol.file and protocol.file.name:
            # Serve uploaded file
            content_type, _ = mimetypes.guess_type(protocol.file.name)
            if not content_type:
                content_type = 'application/octet-stream'
            filename = os.path.basename(protocol.file.name)
            response = FileResponse(protocol.file.open('rb'), content_type=content_type)
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        
        # Generate PDF when no uploaded file
        buffer = generate_protocol_pdf(protocol)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="protocol_{protocol.number}.pdf"'
        return response

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export protocols list to Excel"""
        protocols = self.filter_queryset(self.get_queryset()).select_related(
            'student', 'course', 'test'
        ).order_by('-created_at')[:5000]

        headers = ['Номер', 'Студент', 'Курс/Тест', 'Дата экзамена', 'Балл', 'Результат', 'Статус']
        rows = []
        for p in protocols:
            course_or_test = p.course.title if p.course else (p.test.title if p.test else '—')
            rows.append([
                p.number,
                p.student.full_name or p.student.phone or '',
                course_or_test,
                p.exam_date.strftime('%Y-%m-%d %H:%M') if p.exam_date else '',
                f'{p.score:.1f}' if p.score is not None else '—',
                'Сдан' if p.result == 'passed' else 'Не сдан',
                p.get_status_display() if hasattr(p, 'get_status_display') else p.status,
            ])
        buffer = export_to_excel(headers, rows, 'Протоколы')
        return create_excel_response(buffer, 'protocols.xlsx')

