"""
URL configuration for unicover project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # API endpoints
    path('api/auth/', include('apps.accounts.urls')),
    path('api/users/', include('apps.accounts.user_urls')),
    path('api/courses/', include('apps.courses.urls')),
    path('api/tests/', include('apps.tests.urls')),
    path('api/exams/', include('apps.exams.urls')),
    path('api/protocols/', include('apps.protocols.urls')),
    path('api/certificates/', include('apps.certificates.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/files/', include('apps.files.urls')),
    path('api/licenses/', include('apps.licenses.urls')),
    path('api/vacancies/', include('apps.vacancies.urls')),
    path('api/contacts/', include('apps.contacts.urls')),
    path('api/projects/', include('apps.projects.urls')),
    path('api/news/', include('apps.news.urls')),
    path('api/', include('apps.partners.urls')),
    path('api/core/', include('apps.core.urls')),
    path('api/lessons/', include('apps.courses.lesson_urls')),  # For lesson endpoints
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

