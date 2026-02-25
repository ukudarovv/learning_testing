from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, SMSVerificationCode
from apps.notifications.utils import send_registration_email
import logging

logger = logging.getLogger(__name__)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('phone', 'full_name', 'email', 'role', 'verified', 'is_active', 'created_at')
    list_filter = ('role', 'verified', 'is_active', 'is_staff', 'created_at')
    search_fields = ('phone', 'email', 'full_name', 'iin')
    ordering = ('-created_at',)
    
    fieldsets = (
        (None, {'fields': ('phone', 'password')}),
        ('Personal info', {'fields': ('full_name', 'email', 'iin', 'city', 'organization')}),
        ('Permissions', {'fields': ('role', 'verified', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Settings', {'fields': ('language',)}),
        ('Important dates', {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone', 'password1', 'password2', 'role', 'full_name', 'email'),
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at', 'date_joined', 'last_login')

    def save_model(self, request, obj, form, change):
        """При создании студента отправляем письмо с данными для входа"""
        super().save_model(request, obj, form, change)
        if not change and obj.role == 'student' and obj.email:
            password = form.cleaned_data.get('password1', '')
            if password:
                try:
                    send_registration_email(obj, password, fail_silently=True)
                except Exception as e:
                    logger.warning(f"Failed to send registration email to {obj.email}: {e}")


@admin.register(SMSVerificationCode)
class SMSVerificationCodeAdmin(admin.ModelAdmin):
    list_display = ('phone', 'code', 'purpose', 'is_verified', 'created_at', 'expires_at', 'verified_at')
    list_filter = ('purpose', 'is_verified', 'created_at')
    search_fields = ('phone', 'code')
    readonly_fields = ('created_at', 'verified_at')
    ordering = ('-created_at',)
    
    def has_add_permission(self, request):
        """Disable manual creation of verification codes"""
        return False

