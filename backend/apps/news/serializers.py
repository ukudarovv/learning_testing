from rest_framework import serializers
from .models import NewsCategory, News


class NewsCategorySerializer(serializers.ModelSerializer):
    """News category serializer"""

    class Meta:
        model = NewsCategory
        fields = ['id', 'name', 'name_kz', 'name_en', 'description', 'order', 'is_active']
        read_only_fields = ['id']


class NewsSerializer(serializers.ModelSerializer):
    """News serializer for list view"""
    category = NewsCategorySerializer(read_only=True)
    category_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = News
        fields = [
            'id', 'title', 'title_kz', 'title_en', 'excerpt', 'excerpt_kz', 'excerpt_en',
            'content', 'content_kz', 'content_en', 'category', 'category_id',
            'image', 'image_url', 'is_published', 'published_at',
            'order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            try:
                return obj.image.url
            except ValueError:
                return None
        return None


class NewsCreateUpdateSerializer(serializers.ModelSerializer):
    """News create/update serializer"""
    category_id = serializers.IntegerField(required=False, allow_null=True)
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = News
        fields = [
            'title', 'title_kz', 'title_en', 'excerpt', 'excerpt_kz', 'excerpt_en',
            'content', 'content_kz', 'content_en', 'category_id', 'image',
            'is_published', 'published_at', 'order'
        ]

    def to_internal_value(self, data):
        from django.http import QueryDict

        if isinstance(data, QueryDict):
            mutable_data = {}
            for key, value in data.lists():
                if key != 'image':
                    mutable_data[key] = value[0] if isinstance(value, list) and len(value) > 0 else value
        elif isinstance(data, dict):
            mutable_data = data.copy()
        else:
            mutable_data = data

        return super().to_internal_value(mutable_data)


class NewsDetailSerializer(serializers.ModelSerializer):
    """News detail serializer with full information"""
    category = NewsCategorySerializer(read_only=True)
    category_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = News
        fields = [
            'id', 'title', 'title_kz', 'title_en', 'excerpt', 'excerpt_kz', 'excerpt_en',
            'content', 'content_kz', 'content_en', 'category', 'category_id',
            'image', 'image_url', 'is_published', 'published_at',
            'order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            try:
                return obj.image.url
            except ValueError:
                return None
        return None
