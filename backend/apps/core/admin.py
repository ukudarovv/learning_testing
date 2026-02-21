from django.contrib import admin
from django.shortcuts import redirect
from .models import ContentPage, SiteConfig, get_site_config


@admin.register(ContentPage)
class ContentPageAdmin(admin.ModelAdmin):
    list_display = ['page_type', 'updated_at']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Основная информация', {
            'fields': ('page_type',)
        }),
        ('Содержание', {
            'fields': ('content_ru', 'content_kz', 'content_en')
        }),
        ('Системная информация', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = ['require_sms_on_registration', 'updated_at']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Регистрация', {
            'fields': ('require_sms_on_registration',),
            'description': 'При включении «Требовать SMS при регистрации» пользователи должны подтвердить номер телефона SMS-кодом при регистрации.',
        }),
        ('Системная информация', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def has_add_permission(self, request):
        return not SiteConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        config = get_site_config()
        return redirect(f'admin:core_siteconfig_change', config.pk)
