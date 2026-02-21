from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContentPageViewSet, SiteConfigViewSet

router = DefaultRouter()
router.register(r'content-pages', ContentPageViewSet, basename='contentpage')
router.register(r'settings', SiteConfigViewSet, basename='siteconfig')

urlpatterns = [
    path('', include(router.urls)),
]
