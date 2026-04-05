from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from datetime import timedelta
import random
import string


class UserManager(BaseUserManager):
    """Custom user manager"""
    
    def create_user(self, phone, password=None, **extra_fields):
        if not phone:
            raise ValueError('The Phone field must be set')
        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('verified', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(phone, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model"""
    
    ROLE_CHOICES = [
        ('guest', 'Guest'),
        ('student', 'Student'),
        ('pdek_member', 'EC Member'),
        ('pdek_chairman', 'EC Chairman'),
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
    ]
    
    LANGUAGE_CHOICES = [
        ('ru', 'Russian'),
        ('kz', 'Kazakh'),
        ('en', 'English'),
    ]
    
    phone = models.CharField(max_length=20, unique=True, db_index=True)
    email = models.EmailField(blank=True, null=True)
    iin = models.CharField(max_length=12, blank=True, null=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='guest')
    verified = models.BooleanField(default=False)
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='ru')
    city = models.CharField(max_length=100, blank=True)
    organization = models.CharField(max_length=255, blank=True)
    profile_photo = models.ImageField(
        upload_to='profiles/',
        null=True,
        blank=True,
        help_text='Фото для идентификации при прохождении тестов с видеозаписью',
    )
    
    # EC: preferred protocol signing method (sms, eds, or both)
    PROTOCOL_SIGN_CHOICES = [
        ('both', 'SMS и ЭЦП'),
        ('sms', 'Только SMS'),
        ('eds', 'Только ЭЦП'),
    ]
    protocol_sign_method = models.CharField(
        max_length=10, choices=PROTOCOL_SIGN_CHOICES, default='both',
        help_text='Способ подписания протоколов для членов ЭК'
    )
    
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.full_name or self.phone} ({self.role})"
    
    @property
    def is_admin(self):
        return self.role == 'admin' or self.is_superuser
    
    @property
    def is_pdek_member(self):
        return self.role in ['pdek_member', 'pdek_chairman']
    
    @property
    def is_student(self):
        return self.role == 'student'


class SMSVerificationCode(models.Model):
    """Model for storing SMS verification codes"""
    
    PURPOSE_CHOICES = [
        ('protocol_sign', 'Protocol Signing'),
        ('registration', 'Registration'),
        ('password_reset', 'Password Reset'),
        ('verification', 'General Verification'),
        ('profile_update', 'Profile Update'),
    ]
    
    phone = models.CharField(max_length=20, db_index=True)
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default='verification')
    is_verified = models.BooleanField(default=False)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'sms_verification_codes'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['phone', 'purpose', 'is_verified']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"SMS Code for {self.phone} ({self.purpose}) - {'Verified' if self.is_verified else 'Pending'}"
    
    @classmethod
    def generate_code(cls, phone: str, purpose: str = 'verification') -> 'SMSVerificationCode':
        """Generate a new verification code"""
        # Delete expired codes for this phone and purpose
        cls.objects.filter(
            phone=phone,
            purpose=purpose,
            expires_at__lt=timezone.now()
        ).delete()
        
        # Generate 6-digit code
        code = ''.join(random.choices(string.digits, k=6))
        
        # Create verification code instance
        verification_code = cls.objects.create(
            phone=phone,
            code=code,
            purpose=purpose,
            expires_at=timezone.now() + timedelta(minutes=10)
        )
        
        return verification_code
    
    def verify(self, code: str) -> bool:
        """Verify the code"""
        # Normalize code (strip whitespace)
        code = str(code).strip()
        stored_code = str(self.code).strip()
        
        # Check if already verified
        if self.is_verified:
            return False
        
        # Check if expired
        if timezone.now() > self.expires_at:
            return False
        
        # Check if code matches
        if stored_code != code:
            return False
        
        # Mark as verified
        self.is_verified = True
        self.verified_at = timezone.now()
        self.save()
        
        return True
    
    def is_expired(self) -> bool:
        """Check if code is expired"""
        return timezone.now() > self.expires_at

