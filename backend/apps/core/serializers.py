from rest_framework import serializers
from .models import ContentPage, SiteConfig


class ContentPageSerializer(serializers.ModelSerializer):
    """Serializer for ContentPage model"""
    
    class Meta:
        model = ContentPage
        fields = ['id', 'page_type', 'content_ru', 'content_kz', 'content_en', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContentPageUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating ContentPage"""
    
    class Meta:
        model = ContentPage
        fields = ['content_ru', 'content_kz', 'content_en']


class SiteConfigSerializer(serializers.ModelSerializer):
    """Serializer for SiteConfig (read)"""
    
    class Meta:
        model = SiteConfig
        fields = ['id', 'require_sms_on_registration', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SiteConfigUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating SiteConfig"""
    
    class Meta:
        model = SiteConfig
        fields = ['require_sms_on_registration']
