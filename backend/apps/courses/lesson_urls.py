from django.urls import path
from .views import LessonViewSet

urlpatterns = [
    path('<int:pk>/complete/', LessonViewSet.as_view({'post': 'complete'}), name='lesson-complete'),
    path('<int:pk>/ppt-to-pdf/', LessonViewSet.as_view({'get': 'ppt_to_pdf'}), name='lesson-ppt-to-pdf'),
]

