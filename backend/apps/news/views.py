from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import NewsCategory, News
from .serializers import (
    NewsCategorySerializer,
    NewsSerializer,
    NewsDetailSerializer,
    NewsCreateUpdateSerializer,
)
from apps.accounts.permissions import IsAdminOrReadOnly


class NewsCategoryViewSet(viewsets.ModelViewSet):
    """News category ViewSet"""
    queryset = NewsCategory.objects.all()
    serializer_class = NewsCategorySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsAdminOrReadOnly()]

    filter_backends = [OrderingFilter]
    ordering_fields = ['order', 'name']
    ordering = ['order', 'name']

    def get_queryset(self):
        queryset = super().get_queryset()
        if not self.request.user.is_authenticated or not getattr(self.request.user, 'is_admin', False):
            queryset = queryset.filter(is_active=True)
        return queryset


class NewsViewSet(viewsets.ModelViewSet):
    """News ViewSet"""
    queryset = News.objects.all().select_related('category')
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsAdminOrReadOnly()]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'is_published']
    search_fields = ['title', 'title_kz', 'title_en', 'excerpt', 'content']
    ordering_fields = ['published_at', 'order', 'created_at']
    ordering = ['order', '-published_at', '-created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return NewsDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return NewsCreateUpdateSerializer
        return NewsSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if not self.request.user.is_authenticated or not getattr(self.request.user, 'is_admin', False):
            queryset = queryset.filter(is_published=True)
        category_id = self.request.query_params.get('category_id', None)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        news = serializer.save()
        response_serializer = NewsDetailSerializer(news, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        news = serializer.save()
        response_serializer = NewsDetailSerializer(news, context={'request': request})
        return Response(response_serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
