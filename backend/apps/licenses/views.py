from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import HttpResponse

from .models import License, LicenseCategory
from .serializers import (
    LicenseSerializer, LicenseCreateUpdateSerializer,
    LicenseCategorySerializer, LicenseCategoryDetailSerializer
)
from apps.accounts.permissions import IsAdminOrReadOnly


class LicenseCategoryViewSet(viewsets.ModelViewSet):
    """License Category ViewSet"""
    queryset = LicenseCategory.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'name_kz', 'name_en', 'description']
    ordering_fields = ['order', 'name', 'created_at']
    ordering = ['order', 'name']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return LicenseCategoryDetailSerializer
        return LicenseCategorySerializer
    
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


class LicenseViewSet(viewsets.ModelViewSet):
    """License ViewSet"""
    queryset = License.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['title', 'number', 'description']
    ordering_fields = ['issued_date', 'valid_until', 'created_at']
    ordering = ['-issued_date']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return LicenseCreateUpdateSerializer
        return LicenseSerializer
    
    def get_serializer_context(self):
        """Add request to serializer context for file URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        """Filter active licenses for public, all for admin"""
        queryset = super().get_queryset()
        if not self.request.user.is_authenticated or not self.request.user.is_admin:
            queryset = queryset.filter(is_active=True)
        return queryset
    
    def perform_create(self, serializer):
        """Set created_by to current user if authenticated"""
        if self.request.user.is_authenticated:
            serializer.save(created_by=self.request.user)
        else:
            serializer.save()
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download license file"""
        license = self.get_object()
        
        if not license.file:
            return Response(
                {'error': 'File not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        response = HttpResponse(license.file.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{license.file.name}"'
        return response

