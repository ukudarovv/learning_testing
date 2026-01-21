from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView, RegisterView, LogoutView, MeView,
    SendSMSVerificationView, VerifySMSView,
    RequestPasswordResetView, VerifyPasswordResetCodeView, ConfirmPasswordResetView
)

urlpatterns = [
    path('token/', LoginView.as_view(), name='token'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='register'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('sms/send/', SendSMSVerificationView.as_view(), name='sms_send'),
    path('sms/verify/', VerifySMSView.as_view(), name='sms_verify'),
    path('password-reset/request/', RequestPasswordResetView.as_view(), name='password_reset_request'),
    path('password-reset/verify-code/', VerifyPasswordResetCodeView.as_view(), name='password_reset_verify_code'),
    path('password-reset/confirm/', ConfirmPasswordResetView.as_view(), name='password_reset_confirm'),
]

