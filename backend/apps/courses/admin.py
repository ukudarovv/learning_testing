from django.contrib import admin
from .models import Category, Course, Module, Lesson, CourseEnrollment, LessonProgress, CourseCompletionVerification, CourseEnrollmentRequest


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'status', 'format', 'duration', 'passing_score', 'final_test', 'created_at')
    list_filter = ('status', 'category', 'format', 'created_at')
    search_fields = ('title', 'title_kz', 'title_en', 'description')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('final_test',)


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order', 'created_at')
    list_filter = ('course', 'created_at')
    search_fields = ('title', 'description')
    ordering = ('course', 'order', 'id')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'type', 'order', 'duration', 'required', 'created_at')
    list_filter = ('type', 'required', 'module__course', 'created_at')
    search_fields = ('title', 'description', 'content')
    ordering = ('module', 'order', 'id')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'course', 'status', 'progress', 'enrolled_at', 'completed_at')
    list_filter = ('status', 'enrolled_at', 'completed_at')
    search_fields = ('user__phone', 'user__full_name', 'course__title')
    ordering = ('-enrolled_at',)
    readonly_fields = ('enrolled_at',)


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ('enrollment', 'lesson', 'completed', 'completed_at')
    list_filter = ('completed', 'completed_at')
    search_fields = ('enrollment__user__phone', 'enrollment__user__full_name', 'lesson__title')
    readonly_fields = ('completed_at',)


@admin.register(CourseEnrollmentRequest)
class CourseEnrollmentRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'course', 'status', 'processed_by', 'processed_at', 'created_at')
    list_filter = ('status', 'created_at', 'processed_at')
    search_fields = ('user__phone', 'user__full_name', 'course__title')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'processed_at')


@admin.register(CourseCompletionVerification)
class CourseCompletionVerificationAdmin(admin.ModelAdmin):
    list_display = ('enrollment', 'verified', 'verified_at', 'otp_expires_at', 'created_at')
    list_filter = ('verified', 'created_at', 'verified_at')
    search_fields = ('enrollment__user__full_name', 'enrollment__user__phone', 'enrollment__course__title')
    readonly_fields = ('otp_code', 'otp_expires_at', 'verified_at', 'created_at', 'updated_at')

