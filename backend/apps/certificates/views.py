from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import HttpResponse
from django.db.models import Q, OuterRef, Exists
from django.utils import timezone

from .models import Certificate, CertificateTemplate
from .serializers import (
    CertificateSerializer, 
    CertificateCreateSerializer, 
    CertificateUpdateSerializer,
    CertificateTemplateSerializer
)
from .utils import generate_certificate_pdf
from apps.accounts.permissions import IsAdminOrReadOnly
from apps.core.export_utils import export_to_excel, create_excel_response
from apps.courses.models import CourseEnrollment


class CertificateTemplateViewSet(viewsets.ModelViewSet):
    """Certificate Template ViewSet"""
    queryset = CertificateTemplate.objects.all()
    serializer_class = CertificateTemplateSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'name']
    ordering = ['-created_at']


class CertificateViewSet(viewsets.ModelViewSet):
    """Certificate ViewSet"""
    queryset = Certificate.objects.select_related('student', 'course', 'test', 'protocol', 'template', 'uploaded_by').all()
    serializer_class = CertificateSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student', 'course']
    search_fields = ['number', 'student__full_name', 'student__phone', 'course__title']
    ordering_fields = ['issued_at', 'uploaded_at']
    ordering = ['-issued_at']
    
    def get_queryset(self):
        """Filter certificates - for list action, show only certificates with files"""
        queryset = super().get_queryset()
        
        # For list action, show only certificates that have uploaded files
        if self.action == 'list':
            queryset = queryset.filter(file__isnull=False).exclude(file='')
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CertificateCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CertificateUpdateSerializer
        return CertificateSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export certificates list to Excel"""
        certificates = self.filter_queryset(self.get_queryset()).order_by('-issued_at')[:5000]

        headers = ['Номер', 'Студент', 'Курс/Тест', 'Дата выдачи', 'Действителен до']
        rows = []
        for c in certificates:
            course_or_test = c.course.title if c.course else (c.test.title if c.test else '—')
            rows.append([
                c.number,
                c.student.full_name or c.student.phone or '',
                course_or_test,
                c.issued_at.strftime('%Y-%m-%d %H:%M') if c.issued_at else '',
                c.valid_until.strftime('%Y-%m-%d') if c.valid_until else '—',
            ])
        buffer = export_to_excel(headers, rows, 'Сертификаты')
        return create_excel_response(buffer, 'certificates.xlsx')

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Download certificate PDF"""
        certificate = self.get_object()
        
        # Generate PDF
        buffer = generate_certificate_pdf(certificate)
        
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="certificate_{certificate.number}.pdf"'
        return response
    
    @action(detail=False, methods=['get'], url_path='verify/(?P<qr_code>[^/.]+)', permission_classes=[permissions.AllowAny])
    def verify(self, request, qr_code=None):
        """Verify certificate by QR code or certificate number"""
        try:
            # Extract number from QR code URL if it's a full URL
            # Support both QR code URLs and direct certificate numbers
            certificate_number = qr_code
            if '/' in qr_code:
                # If it's a URL, extract the last part (certificate number)
                certificate_number = qr_code.split('/')[-1]
            
            # Try to find certificate by number
            certificate = Certificate.objects.select_related('student', 'course', 'protocol').get(number=certificate_number)
            
            # Check if certificate is still valid (if valid_until is set)
            is_valid = True
            if certificate.valid_until and certificate.valid_until < timezone.now():
                is_valid = False
            
            serializer = CertificateSerializer(certificate)
            return Response({
                'valid': is_valid,
                'certificate': serializer.data,
                'message': 'Certificate found' if is_valid else 'Certificate expired'
            }, status=status.HTTP_200_OK)
        except Certificate.DoesNotExist:
            return Response({
                'valid': False,
                'error': 'Сертификат не найден',
                'message': 'Сертификат с указанным номером не найден в базе данных'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'valid': False,
                'error': 'Ошибка при проверке сертификата',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'], url_path='pending')
    def pending_certificates(self, request):
        """Get list of students who need certificate uploads (courses and standalone tests)"""
        from apps.accounts.serializers import UserSerializer
        from apps.courses.serializers import CourseSerializer
        from apps.tests.serializers import TestSerializer
        from apps.protocols.models import Protocol
        
        pending_list = []
        
        # 1. Get certificates for completed course enrollments
        completed_enrollments = CourseEnrollment.objects.filter(
            status='completed'
        ).select_related('user', 'course')
        
        for enrollment in completed_enrollments:
            certificate = Certificate.objects.filter(
                student=enrollment.user,
                course=enrollment.course
            ).first()
            
            # Include if no certificate OR certificate without file
            # Check both file field and if file path is empty
            has_file = certificate and certificate.file and str(certificate.file).strip() != ''
            
            if not certificate or not has_file:
                pending_list.append({
                    'enrollment_id': enrollment.id,
                    'student': UserSerializer(enrollment.user).data,
                    'course': CourseSerializer(enrollment.course).data,
                    'test': None,
                    'protocol_id': None,
                    'completed_at': enrollment.completed_at.isoformat() if enrollment.completed_at else None,
                    'certificate_id': certificate.id if certificate else None,
                    'certificate_number': certificate.number if certificate else None,
                    'has_certificate_record': certificate is not None,
                    'needs_upload': True
                })
        
        # 2. Get certificates for standalone tests with signed protocols
        signed_test_protocols = Protocol.objects.filter(
            test__isnull=False,
            course__isnull=True,
            status='signed_chairman',
            result='passed'
        ).select_related('student', 'test')
        
        for protocol in signed_test_protocols:
            certificate = Certificate.objects.filter(
                protocol=protocol,
                student=protocol.student,
                test=protocol.test
            ).first()
            
            has_file = certificate and certificate.file and str(certificate.file).strip() != ''
            
            if not certificate or not has_file:
                pending_list.append({
                    'enrollment_id': None,
                    'student': UserSerializer(protocol.student).data,
                    'course': None,
                    'test': TestSerializer(protocol.test).data,
                    'protocol_id': protocol.id,
                    'completed_at': protocol.exam_date.isoformat() if protocol.exam_date else None,
                    'certificate_id': certificate.id if certificate else None,
                    'certificate_number': certificate.number if certificate else None,
                    'has_certificate_record': certificate is not None,
                    'needs_upload': True
                })
        
        return Response(pending_list, status=status.HTTP_200_OK)

