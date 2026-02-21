from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NewsCategoryViewSet, NewsViewSet

router = DefaultRouter()
router.register(r'categories', NewsCategoryViewSet, basename='news-category')
router.register(r'', NewsViewSet, basename='news')

urlpatterns = [
    path('', include(router.urls)),
]
