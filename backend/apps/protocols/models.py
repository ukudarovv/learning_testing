from django.db import models
from django.conf import settings
from apps.courses.models import Course, CourseEnrollment
from apps.exams.models import TestAttempt
import random
import string


class Protocol(models.Model):
    """Protocol model for PDEK"""
    
    STATUS_CHOICES = [
        ('generated', 'Generated'),
        ('pending_pdek', 'Pending PDEK'),
        ('signed_members', 'Signed by Members'),
        ('signed_chairman', 'Signed by Chairman'),
        ('rejected', 'Rejected'),
        ('annulled', 'Annulled'),
    ]
    
    number = models.CharField(max_length=50, unique=True, db_index=True)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='protocols', on_delete=models.CASCADE)
    course = models.ForeignKey(Course, related_name='protocols', on_delete=models.CASCADE, null=True, blank=True, help_text='Course for course completion protocols')
    test = models.ForeignKey('tests.Test', related_name='protocols', on_delete=models.CASCADE, null=True, blank=True, help_text='Test for standalone test completion protocols')
    attempt = models.ForeignKey(TestAttempt, related_name='protocols', on_delete=models.CASCADE, null=True, blank=True)
    enrollment = models.ForeignKey(CourseEnrollment, related_name='protocols', on_delete=models.CASCADE, null=True, blank=True, help_text='Enrollment for course completion protocols')
    exam_date = models.DateTimeField()
    score = models.FloatField()
    passing_score = models.FloatField()
    result = models.CharField(max_length=10, choices=[('passed', 'Passed'), ('failed', 'Failed')])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generated')
    rejection_reason = models.TextField(blank=True)
    
    file = models.FileField(upload_to='protocols/files/', null=True, blank=True, help_text='Uploaded protocol file in any format')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='uploaded_protocols', on_delete=models.SET_NULL, null=True, blank=True, help_text='Admin who uploaded the file')
    uploaded_at = models.DateTimeField(null=True, blank=True, help_text='When the file was uploaded')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'protocols'
        ordering = ['-created_at']
    
    def __str__(self):
        course_or_test = self.course.title if self.course else (self.test.title if self.test else 'Unknown')
        return f"Protocol {self.number} - {self.student.full_name or self.student.phone} - {course_or_test}"
    
    def generate_number(self):
        """Generate unique protocol number"""
        if self.number:
            return self.number
        
        from django.utils import timezone
        year = self.exam_date.year if self.exam_date else timezone.now().year
        prefix = f"PROT-{year}-"
        
        while True:
            suffix = ''.join(random.choices(string.digits, k=6))
            number = f"{prefix}{suffix}"
            if not Protocol.objects.filter(number=number).exists():
                self.number = number
                return number
    
    def save(self, *args, **kwargs):
        if not self.number:
            self.generate_number()
        super().save(*args, **kwargs)


class ProtocolSignature(models.Model):
    """Protocol signature model"""
    
    SIGN_TYPE_CHOICES = [
        ('otp', 'OTP (SMS)'),
        ('eds', 'EDS (ЭЦП)'),
    ]
    
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('chairman', 'Chairman'),
    ]
    
    protocol = models.ForeignKey(Protocol, related_name='signatures', on_delete=models.CASCADE)
    signer = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='protocol_signatures', on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    signed_at = models.DateTimeField(null=True, blank=True)
    otp_verified = models.BooleanField(default=False)
    otp_code = models.CharField(max_length=6, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    
    # EDS (ЭЦП) fields
    sign_type = models.CharField(max_length=10, choices=SIGN_TYPE_CHOICES, default='otp')
    eds_signature = models.TextField(blank=True, help_text='Base64 CMS detached signature from NCALayer')
    eds_certificate_info = models.JSONField(null=True, blank=True, help_text='IIN, full_name from certificate for audit')
    
    class Meta:
        db_table = 'protocol_signatures'
        unique_together = ['protocol', 'signer']
    
    def __str__(self):
        return f"{self.protocol.number} - {self.signer.full_name or self.signer.phone} ({self.role})"
    
    def generate_otp(self):
        """Generate OTP code"""
        self.otp_code = ''.join(random.choices(string.digits, k=6))
        from django.utils import timezone
        from datetime import timedelta
        self.otp_expires_at = timezone.now() + timedelta(minutes=10)
        self.save()
        return self.otp_code
    
    def verify_otp(self, code):
        """Verify OTP code"""
        import logging
        from django.utils import timezone
        
        logger = logging.getLogger(__name__)
        
        # Normalize code (strip whitespace and convert to string)
        code = str(code).strip() if code else ''
        stored_code = str(self.otp_code).strip() if self.otp_code else ''
        
        logger.info(f"Verifying OTP for signature {self.id}: provided='{code}', stored='{stored_code}', expires_at={self.otp_expires_at}")
        
        if not stored_code or not self.otp_expires_at:
            logger.warning(f"OTP verification failed: missing otp_code or otp_expires_at for signature {self.id}")
            return False
        
        if timezone.now() > self.otp_expires_at:
            logger.warning(f"OTP verification failed: expired. Now: {timezone.now()}, Expires: {self.otp_expires_at} for signature {self.id}")
            return False
        
        if stored_code != code:
            logger.warning(f"OTP verification failed: mismatch. Provided: '{code}', Stored: '{stored_code}' for signature {self.id}")
            return False
        
        self.otp_verified = True
        self.signed_at = timezone.now()
        self.save()
        logger.info(f"OTP verification successful for signature {self.id}")
        return True

