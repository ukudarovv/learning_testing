from django.db import models
from django.conf import settings
from apps.courses.models import Course
from apps.protocols.models import Protocol
import random
import string
import qrcode
from io import BytesIO
from django.core.files.base import ContentFile
from PIL import Image


class CertificateTemplate(models.Model):
    """Certificate template model"""
    
    name = models.CharField(max_length=255, help_text='Template name')
    description = models.TextField(blank=True, help_text='Template description')
    file = models.FileField(upload_to='certificates/templates/', help_text='Template file')
    is_active = models.BooleanField(default=True, help_text='Is template active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'certificate_templates'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name


class Certificate(models.Model):
    """Certificate model"""
    
    number = models.CharField(max_length=50, unique=True, db_index=True)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='certificates', on_delete=models.CASCADE)
    course = models.ForeignKey(Course, related_name='certificates', on_delete=models.CASCADE, null=True, blank=True, help_text='Course for course completion certificates')
    test = models.ForeignKey('tests.Test', related_name='certificates', on_delete=models.CASCADE, null=True, blank=True, help_text='Test for standalone test completion certificates')
    protocol = models.ForeignKey(Protocol, related_name='certificates', on_delete=models.SET_NULL, null=True, blank=True)
    template = models.ForeignKey('CertificateTemplate', related_name='certificates', on_delete=models.SET_NULL, null=True, blank=True, help_text='Certificate template used')
    file = models.FileField(upload_to='certificates/files/', null=True, blank=True, help_text='Uploaded certificate file')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='uploaded_certificates', on_delete=models.SET_NULL, null=True, blank=True, help_text='Admin who uploaded the file')
    uploaded_at = models.DateTimeField(null=True, blank=True, help_text='When the file was uploaded')
    issued_at = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    qr_code = models.TextField(blank=True, help_text='QR code data')
    pdf_url = models.URLField(blank=True, null=True)
    
    class Meta:
        db_table = 'certificates'
        ordering = ['-issued_at']
    
    def __str__(self):
        course_or_test = self.course.title if self.course else (self.test.title if self.test else 'Unknown')
        return f"Certificate {self.number} - {self.student.full_name or self.student.phone} - {course_or_test}"
    
    def generate_number(self):
        """Generate unique certificate number"""
        if self.number:
            return self.number
        
        from django.utils import timezone
        year = self.issued_at.year if self.issued_at else timezone.now().year
        prefix = f"CERT-{year}-"
        
        while True:
            suffix = ''.join(random.choices(string.digits + string.ascii_uppercase, k=8))
            number = f"{prefix}{suffix}"
            if not Certificate.objects.filter(number=number).exists():
                self.number = number
                return number
    
    def generate_qr_code(self):
        """Generate QR code for certificate"""
        from django.conf import settings
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        verification_url = f"{frontend_url}/verify/{self.number}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(verification_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        
        self.qr_code = verification_url
        return buffer
    
    def save(self, *args, **kwargs):
        if not self.number:
            self.generate_number()
        if not self.qr_code:
            self.generate_qr_code()
        super().save(*args, **kwargs)

