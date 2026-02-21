from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from django.db.models import Count, Q
from datetime import timedelta

from .models import Vacancy, VacancyApplication
from apps.core.export_utils import export_to_excel, create_excel_response
from .serializers import (
    VacancySerializer, VacancyCreateUpdateSerializer,
    VacancyApplicationSerializer, VacancyApplicationCreateSerializer
)
from apps.accounts.permissions import IsAdmin
from apps.core.utils import get_request_language


class VacancyViewSet(viewsets.ModelViewSet):
    """Vacancy ViewSet"""
    queryset = Vacancy.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'is_active', 'employment_type', 'location', 'language']
    search_fields = ['title', 'description', 'requirements']
    ordering_fields = ['created_at', 'published_at', 'title']
    ordering = ['-created_at']
    
    def get_permissions(self):
        """Allow public read access, require auth for write"""
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsAdmin()]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return VacancyCreateUpdateSerializer
        return VacancySerializer
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        """Filter active published vacancies for public, all for admin, and by language"""
        queryset = super().get_queryset()
        if not self.request.user.is_authenticated or not getattr(self.request.user, 'is_admin', False):
            queryset = queryset.filter(is_active=True, status='published')
        
        # Фильтрация по языку (если не указан явно в параметрах запроса)
        if 'language' not in self.request.query_params:
            lang = get_request_language(self.request)
            queryset = queryset.filter(language=lang)
        
        return queryset
    
    def perform_create(self, serializer):
        """Set created_by to current user"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def statistics(self, request):
        """Get vacancy statistics"""
        # Vacancy counts by status
        vacancy_stats = Vacancy.objects.aggregate(
            total=Count('id'),
            draft=Count('id', filter=Q(status='draft')),
            published=Count('id', filter=Q(status='published')),
            closed=Count('id', filter=Q(status='closed')),
            active=Count('id', filter=Q(is_active=True))
        )
        
        # Application counts
        application_stats = VacancyApplication.objects.aggregate(
            total=Count('id'),
            pending=Count('id', filter=Q(status='pending')),
            reviewed=Count('id', filter=Q(status='reviewed')),
            contacted=Count('id', filter=Q(status='contacted')),
            rejected=Count('id', filter=Q(status='rejected'))
        )
        
        # Popular vacancies (by application count)
        popular_vacancies = Vacancy.objects.annotate(
            application_count=Count('applications')
        ).order_by('-application_count')[:10].values(
            'id', 'title', 'application_count'
        )
        
        # Applications by date (last 30 days)
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=30)
        applications_by_date = []
        current_date = start_date
        while current_date <= end_date:
            count = VacancyApplication.objects.filter(
                created_at__date=current_date
            ).count()
            applications_by_date.append({
                'date': current_date.isoformat(),
                'count': count
            })
            current_date += timedelta(days=1)
        
        # Applications by status distribution
        status_distribution = []
        for status_code, status_label in VacancyApplication.STATUS_CHOICES:
            count = VacancyApplication.objects.filter(status=status_code).count()
            status_distribution.append({
                'status': status_code,
                'status_display': status_label,
                'count': count
            })
        
        return Response({
            'vacancies': vacancy_stats,
            'applications': application_stats,
            'popular_vacancies': list(popular_vacancies),
            'applications_by_date': applications_by_date,
            'status_distribution': status_distribution
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export vacancies list to Excel"""
        vacancies = self.filter_queryset(self.get_queryset()).order_by('-created_at')[:5000]
        headers = ['Название', 'Статус', 'Тип занятости', 'Местоположение', 'Язык', 'Дата создания']
        rows = []
        for v in vacancies:
            rows.append([
                v.title,
                v.get_status_display() if hasattr(v, 'get_status_display') else v.status,
                v.employment_type or '',
                v.location or '',
                v.language or '',
                v.created_at.strftime('%Y-%m-%d %H:%M') if v.created_at else '',
            ])
        buffer = export_to_excel(headers, rows, 'Вакансии')
        return create_excel_response(buffer, 'vacancies.xlsx')


class VacancyApplicationViewSet(viewsets.ModelViewSet):
    """Vacancy Application ViewSet"""
    queryset = VacancyApplication.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['vacancy', 'status']
    search_fields = ['full_name', 'phone', 'email']
    ordering_fields = ['created_at', 'status']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']
    
    def get_permissions(self):
        """Allow public create, require admin for read/update"""
        if self.action == 'create':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsAdmin()]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return VacancyApplicationCreateSerializer
        return VacancyApplicationSerializer
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        """Create application"""
        serializer.save()
    
    def perform_update(self, serializer):
        """Update application status (admin only)"""
        if 'status' in serializer.validated_data:
            serializer.save(
                reviewed_by=self.request.user,
                reviewed_at=timezone.now()
            )
        else:
            serializer.save()

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export vacancy applications to Excel"""
        applications = self.filter_queryset(self.get_queryset()).select_related('vacancy').order_by('-created_at')[:5000]
        headers = ['Вакансия', 'ФИО', 'Телефон', 'Email', 'Сообщение', 'Статус', 'Дата']
        rows = []
        for a in applications:
            rows.append([
                a.vacancy.title if a.vacancy else '—',
                a.full_name,
                a.phone or '',
                a.email or '',
                (a.message or '')[:300],
                a.get_status_display() if hasattr(a, 'get_status_display') else a.status,
                a.created_at.strftime('%Y-%m-%d %H:%M') if a.created_at else '',
            ])
        buffer = export_to_excel(headers, rows, 'Заявки на вакансии')
        return create_excel_response(buffer, 'vacancy_applications.xlsx')

