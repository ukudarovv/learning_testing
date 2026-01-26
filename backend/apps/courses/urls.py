from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, CourseViewSet, LessonViewSet, CourseEnrollmentRequestViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'enrollment-requests', CourseEnrollmentRequestViewSet, basename='course-enrollment-request')
router.register(r'', CourseViewSet, basename='course')

urlpatterns = [
    path('', include(router.urls)),
    path('my_enrollments/', CourseViewSet.as_view({'get': 'my_enrollments'}), name='my-enrollments'),
    path('lessons/<int:pk>/complete/', LessonViewSet.as_view({'post': 'complete'}), name='lesson-complete'),
]

