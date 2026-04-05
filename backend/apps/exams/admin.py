from django.contrib import admin
from .models import TestAttempt, ExtraAttemptRequest


@admin.register(TestAttempt)
class TestAttemptAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'test', 'score', 'passed', 'started_at', 'completed_at',
        'has_video_recording', 'has_screen_recording',
    )
    list_filter = ('passed', 'started_at', 'completed_at')
    search_fields = ('user__phone', 'user__full_name', 'test__title')
    ordering = ('-started_at',)
    readonly_fields = (
        'started_at', 'completed_at', 'score', 'passed',
        'video_recording', 'screen_recording', 'has_video_recording', 'has_screen_recording',
    )
    
    def has_video_recording(self, obj):
        """Check if test attempt has video recording"""
        return bool(obj.video_recording)
    has_video_recording.boolean = True
    has_video_recording.short_description = 'Видеозапись'

    def has_screen_recording(self, obj):
        return bool(obj.screen_recording)
    has_screen_recording.boolean = True
    has_screen_recording.short_description = 'Запись экрана'


@admin.register(ExtraAttemptRequest)
class ExtraAttemptRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'test', 'status', 'processed_by', 'created_at', 'processed_at')
    list_filter = ('status', 'created_at', 'processed_at')
    search_fields = ('user__phone', 'user__full_name', 'test__title', 'reason')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'processed_at')
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'test', 'reason', 'status')
        }),
        ('Обработка', {
            'fields': ('processed_by', 'processed_at', 'admin_response')
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at')
        }),
    )

