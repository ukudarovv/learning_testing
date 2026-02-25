from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Permission for admin users only"""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_admin


class IsAdminOrReadOnly(permissions.BasePermission):
    """Permission for admin users or read-only"""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.is_admin


class IsAdminOrPublicReadOnly(permissions.BasePermission):
    """Permission for admin users or public read-only access"""
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            # Разрешаем публичный доступ для чтения
            return True
        # Для записи требуется авторизация и права администратора
        return request.user and request.user.is_authenticated and request.user.is_admin


class IsAdminOrPdekOrReadOnly(permissions.BasePermission):
    """Разрешение: админ — полный доступ; ПДЭК и студенты — чтение протоколов"""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True  # Чтение: любой авторизованный (admin, pdek, student)
        return request.user.is_admin


class IsOwnerOrAdmin(permissions.BasePermission):
    """Permission for object owner or admin"""
    
    def has_object_permission(self, request, view, obj):
        if request.user.is_admin:
            return True
        return obj.user == request.user or obj.id == request.user.id

