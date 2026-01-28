from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TestViewSet, QuestionViewSet, TestEnrollmentRequestViewSet, TestAssignmentViewSet

router = DefaultRouter()
router.register(r'enrollment-requests', TestEnrollmentRequestViewSet, basename='test-enrollment-request')
router.register(r'assignments', TestAssignmentViewSet, basename='test-assignment')
router.register(r'', TestViewSet, basename='test')

urlpatterns = [
    # Questions endpoints (ПЕРЕД router.urls, чтобы иметь приоритет)
    path('<int:test_pk>/questions/', QuestionViewSet.as_view({'get': 'list', 'post': 'create'}), name='test-questions-list'),
    path('<int:test_pk>/questions/<int:pk>/', QuestionViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='test-questions-detail'),
    path('', include(router.urls)),
]

