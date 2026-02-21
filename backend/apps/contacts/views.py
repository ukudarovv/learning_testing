from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import ContactMessage
from apps.core.export_utils import export_to_excel, create_excel_response
from .serializers import (
    ContactMessageSerializer,
    ContactMessageCreateSerializer,
    ContactMessageUpdateSerializer
)
from apps.accounts.permissions import IsAdmin


class ContactMessageViewSet(viewsets.ModelViewSet):
    """Contact message ViewSet"""
    queryset = ContactMessage.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'direction']
    search_fields = ['name', 'email', 'phone', 'company', 'message']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ContactMessageCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ContactMessageUpdateSerializer
        return ContactMessageSerializer
    
    def get_permissions(self):
        """Allow anonymous users to create messages, only admins can read/update"""
        if self.action == 'create':
            return [permissions.AllowAny()]
        return [IsAdmin()]
    
    def perform_create(self, serializer):
        """Create new message with default status"""
        serializer.save(status='new')

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export contact messages to Excel"""
        messages = self.filter_queryset(self.get_queryset()).order_by('-created_at')[:5000]
        headers = ['Имя', 'Компания', 'Email', 'Телефон', 'Направление', 'Сообщение', 'Статус', 'Дата']
        rows = []
        for m in messages:
            rows.append([
                m.name,
                m.company or '',
                m.email,
                m.phone,
                m.get_direction_display() if hasattr(m, 'get_direction_display') else m.direction or '',
                (m.message or '')[:500],
                m.get_status_display() if hasattr(m, 'get_status_display') else m.status,
                m.created_at.strftime('%Y-%m-%d %H:%M') if m.created_at else '',
            ])
        buffer = export_to_excel(headers, rows, 'Контакты')
        return create_excel_response(buffer, 'contact_messages.xlsx')

