from django.contrib import admin
from .models import Test, Question, TestEnrollmentRequest


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ('title', 'passing_score', 'time_limit', 'max_attempts', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('title',)
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'questions_count')


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'test', 'type', 'order', 'weight', 'created_at')
    list_filter = ('type', 'test', 'created_at')
    search_fields = ('text',)
    ordering = ('test', 'order', 'id')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(TestEnrollmentRequest)
class TestEnrollmentRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'test', 'status', 'processed_by', 'processed_at', 'created_at')
    list_filter = ('status', 'created_at', 'processed_at')
    search_fields = ('user__phone', 'user__full_name', 'test__title')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'processed_at')

