from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, SMSVerificationCode


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""
    
    class Meta:
        model = User
        fields = [
            'id', 'phone', 'email', 'iin', 'full_name', 'role',
            'verified', 'is_active', 'language', 'city', 'organization',
            'created_at', 'updated_at', 'date_joined'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'date_joined']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8)
    verification_code = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['phone', 'password', 'full_name', 'email', 'iin', 'role', 'city', 'organization', 'language', 'verified', 'is_active', 'verification_code']
    
    def validate_password(self, value):
        """Validate password if provided"""
        if value and len(value) < 8:
            raise serializers.ValidationError('Password must be at least 8 characters long.')
        return value
    
    def validate(self, data):
        """Validate SMS verification code if provided"""
        verification_code = data.get('verification_code')
        phone = data.get('phone')
        
        if verification_code and phone:
            # Normalize phone number
            normalized_phone = ''.join(filter(str.isdigit, str(phone)))
            if normalized_phone.startswith('8'):
                normalized_phone = '7' + normalized_phone[1:]
            if not normalized_phone.startswith('7'):
                normalized_phone = '7' + normalized_phone
            
            # Find the most recent unverified code for this phone and registration purpose
            verification_obj = SMSVerificationCode.objects.filter(
                phone=normalized_phone,
                purpose='registration',
                is_verified=False
            ).order_by('-created_at').first()
            
            if not verification_obj:
                raise serializers.ValidationError({'verification_code': 'Verification code not found or already used'})
            
            # Verify the code
            if not verification_obj.verify(verification_code):
                raise serializers.ValidationError({'verification_code': 'Invalid or expired verification code'})
        
        return data
    
    def create(self, validated_data):
        import secrets
        import string
        
        password = validated_data.pop('password', None)
        validated_data.pop('verification_code', None)  # Remove verification_code, it's not a model field
        
        # Если роль не указана, устанавливаем 'student' по умолчанию
        if 'role' not in validated_data or not validated_data.get('role'):
            validated_data['role'] = 'student'
        
        # Если пароль не указан, генерируем автоматически
        if not password or not password.strip():
            # Генерируем безопасный пароль: 12 символов, буквы (верхний и нижний регистр), цифры, спецсимволы
            alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
            password = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        user = User.objects.create_user(password=password, **validated_data)
        
        # Сохраняем пароль в объекте user для возврата (не сохраняется в БД, только для ответа)
        user._generated_password = password
        
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user"""
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(required=False, max_length=20)
    verification_code = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['phone', 'full_name', 'email', 'iin', 'language', 'city', 'organization', 'role', 'verified', 'is_active', 'password', 'verification_code']
    
    def validate_password(self, value):
        """Validate password if provided"""
        if value and len(value) < 8:
            raise serializers.ValidationError('Password must be at least 8 characters long.')
        return value
    
    def validate(self, data):
        """Validate SMS verification code if phone is being changed"""
        verification_code = data.get('verification_code')
        new_phone = data.get('phone')
        instance = self.instance
        
        # If phone is being changed and verification code is provided
        if new_phone and instance and instance.phone != new_phone:
            if not verification_code:
                raise serializers.ValidationError({'verification_code': 'Verification code is required when changing phone number'})
            
            # Normalize phone number
            normalized_phone = ''.join(filter(str.isdigit, str(new_phone)))
            if normalized_phone.startswith('8'):
                normalized_phone = '7' + normalized_phone[1:]
            if not normalized_phone.startswith('7'):
                normalized_phone = '7' + normalized_phone
            
            # Find the most recent unverified code for this phone and verification/profile_update purpose
            verification_obj = SMSVerificationCode.objects.filter(
                phone=normalized_phone,
                purpose__in=['verification', 'profile_update'],
                is_verified=False
            ).order_by('-created_at').first()
            
            if not verification_obj:
                raise serializers.ValidationError({'verification_code': 'Verification code not found or already used'})
            
            # Verify the code
            if not verification_obj.verify(verification_code):
                raise serializers.ValidationError({'verification_code': 'Invalid or expired verification code'})
        
        return data
    
    def update(self, instance, validated_data):
        # Remove password from validated_data if it's empty or not provided
        password = validated_data.pop('password', None)
        if password and password.strip():
            instance.set_password(password)
        
        # Remove verification_code, it's not a model field
        validated_data.pop('verification_code', None)
        
        # Normalize phone if it's being changed
        if 'phone' in validated_data and validated_data['phone']:
            new_phone = validated_data['phone']
            normalized_phone = ''.join(filter(str.isdigit, str(new_phone)))
            if normalized_phone.startswith('8'):
                normalized_phone = '7' + normalized_phone[1:]
            if not normalized_phone.startswith('7'):
                normalized_phone = '7' + normalized_phone
            validated_data['phone'] = normalized_phone
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    """Serializer for login"""
    phone = serializers.CharField(required=True, allow_blank=False)
    password = serializers.CharField(write_only=True, required=True, allow_blank=False)
    
    def validate(self, attrs):
        phone = attrs.get('phone')
        password = attrs.get('password')
        
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"LoginSerializer validate - phone: {phone}, password provided: {bool(password)}")
        
        if not phone:
            raise serializers.ValidationError({'phone': 'Phone is required.'})
        
        if not password:
            raise serializers.ValidationError({'password': 'Password is required.'})
        
        # Normalize phone number: remove +, spaces, and other non-digit characters
        # Keep only digits
        normalized_phone = ''.join(filter(str.isdigit, str(phone)))
        logger.info(f"Normalized phone: {normalized_phone} (from {phone})")
        
        # Try to get user by phone (try both normalized and original)
        user = None
        try:
            # First try normalized phone
            user = User.objects.get(phone=normalized_phone)
            logger.info(f"User found by normalized phone: {user.phone}, is_active: {user.is_active}")
        except User.DoesNotExist:
            # Try original phone
            try:
                user = User.objects.get(phone=phone)
                logger.info(f"User found by original phone: {user.phone}, is_active: {user.is_active}")
            except User.DoesNotExist:
                logger.warning(f"User not found with phone: {phone} (normalized: {normalized_phone})")
                raise serializers.ValidationError({'non_field_errors': ['Invalid phone or password.']})
        
        # Check if user is active
        if not user.is_active:
            raise serializers.ValidationError({'non_field_errors': ['User account is disabled.']})
        
        # Check password
        if not user.check_password(password):
            logger.warning(f"Password check failed for user: {user.phone}")
            raise serializers.ValidationError({'non_field_errors': ['Invalid phone or password.']})
        
        logger.info(f"Login successful for user: {user.phone}")
        attrs['user'] = user
        return attrs


class TokenSerializer(serializers.Serializer):
    """Serializer for JWT tokens"""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer(read_only=True)
    
    @classmethod
    def get_tokens_for_user(cls, user):
        refresh = RefreshToken.for_user(user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        }


class SendSMSVerificationSerializer(serializers.Serializer):
    """Serializer for sending SMS verification code"""
    phone = serializers.CharField(required=True, max_length=20)
    purpose = serializers.ChoiceField(
        choices=SMSVerificationCode.PURPOSE_CHOICES,
        default='verification'
    )
    
    def validate_phone(self, value):
        """Validate phone number format"""
        # Remove all non-digit characters for validation
        digits_only = ''.join(filter(str.isdigit, str(value)))
        
        # Check if phone has reasonable length (7-15 digits)
        if len(digits_only) < 7 or len(digits_only) > 15:
            raise serializers.ValidationError('Invalid phone number format.')
        
        return value


class VerifySMSSerializer(serializers.Serializer):
    """Serializer for verifying SMS code"""
    phone = serializers.CharField(required=True, max_length=20)
    code = serializers.CharField(required=True, max_length=6, min_length=6)
    purpose = serializers.ChoiceField(
        choices=SMSVerificationCode.PURPOSE_CHOICES,
        default='verification'
    )
    
    def validate_code(self, value):
        """Validate code format"""
        if not value.isdigit():
            raise serializers.ValidationError('Code must contain only digits.')
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for requesting password reset"""
    phone = serializers.CharField(required=True, max_length=20)
    
    def validate_phone(self, value):
        """Validate phone number format"""
        # Remove all non-digit characters for validation
        digits_only = ''.join(filter(str.isdigit, str(value)))
        
        # Check if phone has reasonable length (7-15 digits)
        if len(digits_only) < 7 or len(digits_only) > 15:
            raise serializers.ValidationError('Invalid phone number format.')
        
        return value


class PasswordResetVerifyCodeSerializer(serializers.Serializer):
    """Serializer for verifying password reset code"""
    phone = serializers.CharField(required=True, max_length=20)
    code = serializers.CharField(required=True, max_length=6, min_length=6)
    
    def validate_phone(self, value):
        """Validate phone number format"""
        digits_only = ''.join(filter(str.isdigit, str(value)))
        if len(digits_only) < 7 or len(digits_only) > 15:
            raise serializers.ValidationError('Invalid phone number format.')
        return value
    
    def validate_code(self, value):
        """Validate code format"""
        if not value.isdigit():
            raise serializers.ValidationError('Code must contain only digits.')
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for confirming password reset - setting new password"""
    phone = serializers.CharField(required=True, max_length=20)
    code = serializers.CharField(required=True, max_length=6, min_length=6)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(required=True, write_only=True, min_length=8)
    
    def validate_phone(self, value):
        """Validate phone number format"""
        digits_only = ''.join(filter(str.isdigit, str(value)))
        if len(digits_only) < 7 or len(digits_only) > 15:
            raise serializers.ValidationError('Invalid phone number format.')
        return value
    
    def validate_code(self, value):
        """Validate code format"""
        if not value.isdigit():
            raise serializers.ValidationError('Code must contain only digits.')
        return value
    
    def validate(self, data):
        """Validate that passwords match and code is verified"""
        new_password = data.get('new_password')
        new_password_confirm = data.get('new_password_confirm')
        
        if new_password != new_password_confirm:
            raise serializers.ValidationError({
                'new_password_confirm': 'Passwords do not match.'
            })
        
        return data

