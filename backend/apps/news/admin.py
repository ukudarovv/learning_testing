from django.contrib import admin
from .models import NewsCategory, News


@admin.register(NewsCategory)
class NewsCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'order', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'name_kz', 'name_en', 'description')
    ordering = ('order', 'name')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'name_kz', 'name_en', 'description')
        }),
        ('Настройки', {
            'fields': ('order', 'is_active')
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'is_published', 'published_at', 'order', 'created_at')
    list_filter = ('category', 'is_published', 'created_at')
    search_fields = ('title', 'title_kz', 'title_en', 'excerpt', 'content')
    ordering = ('order', '-published_at', '-created_at')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Основная информация (RU)', {
            'fields': ('title', 'excerpt', 'content')
        }),
        ('Казахский', {
            'fields': ('title_kz', 'excerpt_kz', 'content_kz'),
            'classes': ('collapse',)
        }),
        ('Английский', {
            'fields': ('title_en', 'excerpt_en', 'content_en'),
            'classes': ('collapse',)
        }),
        ('Медиа и категория', {
            'fields': ('image', 'category')
        }),
        ('Настройки', {
            'fields': ('is_published', 'published_at', 'order')
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('category')
