from rest_framework import serializers
from .models import License, LicenseCategory


class LicenseCategorySerializer(serializers.ModelSerializer):
    """License category serializer"""
    
    class Meta:
        model = LicenseCategory
        fields = [
            'id', 'name', 'name_kz', 'name_en', 'slug',
            'description', 'order', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LicenseCategoryDetailSerializer(serializers.ModelSerializer):
    """License category detail serializer with licenses count"""
    licenses_count = serializers.SerializerMethodField()
    
    class Meta:
        model = LicenseCategory
        fields = [
            'id', 'name', 'name_kz', 'name_en', 'slug',
            'description', 'order', 'is_active', 'licenses_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'licenses_count']
    
    def get_licenses_count(self, obj):
        """Get count of active licenses in this category"""
        return obj.licenses.filter(is_active=True).count()


class LicenseSerializer(serializers.ModelSerializer):
    """License serializer"""
    file_url = serializers.SerializerMethodField()
    category = LicenseCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=LicenseCategory.objects.filter(is_active=True),
        source='category',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = License
        fields = [
            'id', 'title', 'number', 'category', 'category_id',
            'description', 'file', 'file_url', 'issued_date', 'valid_until',
            'is_active', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'file_url']
    
    def get_file_url(self, obj):
        """Get file URL"""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class LicenseCreateUpdateSerializer(serializers.ModelSerializer):
    """License create/update serializer"""
    
    valid_until = serializers.DateField(required=False, allow_null=True)
    
    def to_internal_value(self, data):
        """Handle empty string for valid_until field"""
        if isinstance(data, dict):
            if 'valid_until' in data and data['valid_until'] == '':
                data = data.copy()
                data['valid_until'] = None
        return super().to_internal_value(data)
    
    class Meta:
        model = License
        fields = [
            'title', 'number', 'category', 'description', 'file',
            'issued_date', 'valid_until', 'is_active'
        ]

