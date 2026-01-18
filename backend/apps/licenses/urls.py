from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LicenseViewSet, LicenseCategoryViewSet

router = DefaultRouter()
router.register(r'categories', LicenseCategoryViewSet, basename='license-category')
router.register(r'', LicenseViewSet, basename='license')

urlpatterns = [
    path('', include(router.urls)),
]

