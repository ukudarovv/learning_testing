from django.db import models
from django.conf import settings


class Category(models.Model):
    """Course category model"""
    
    name = models.CharField(max_length=100, unique=True)
    name_kz = models.CharField(max_length=100, blank=True)
    name_en = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text='Icon name or class')
    order = models.IntegerField(default=0, help_text='Display order')
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'categories'
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name


class Course(models.Model):
    """Course model"""
    
    STATUS_CHOICES = [
        ('in_development', 'In Development'),
        ('draft', 'Draft'),
        ('published', 'Published'),
        # Старые статусы для обратной совместимости
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('exam_available', 'Exam Available'),
        ('exam_passed', 'Exam Passed'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('annulled', 'Annulled'),
    ]
    
    FORMAT_CHOICES = [
        ('online', 'Online'),
        ('offline', 'Offline'),
        ('blended', 'Blended'),
    ]
    
    LANGUAGE_CHOICES = [
        ('ru', 'Russian'),
        ('kz', 'Kazakh'),
        ('en', 'English'),
    ]
    
    title = models.CharField(max_length=255)
    title_kz = models.CharField(max_length=255, blank=True)
    title_en = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    description_kz = models.TextField(blank=True, help_text='Description in Kazakh')
    description_en = models.TextField(blank=True, help_text='Description in English')
    category = models.ForeignKey('Category', related_name='courses', on_delete=models.PROTECT, null=True, blank=True)
    duration = models.IntegerField(default=0, help_text='Duration in hours')
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default='online')
    passing_score = models.IntegerField(default=80, help_text='Minimum score to pass')
    max_attempts = models.IntegerField(default=3, help_text='Maximum test attempts')
    has_timer = models.BooleanField(default=False)
    timer_minutes = models.IntegerField(null=True, blank=True, help_text='Timer in minutes')
    pdek_commission = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_development')
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='ru', help_text='Language of the course content')
    final_test = models.ForeignKey('tests.Test', related_name='final_courses', on_delete=models.SET_NULL, null=True, blank=True, help_text='Final test for course completion')
    is_standalone_test = models.BooleanField(default=False, help_text='If True, this course is displayed as a standalone test on Training Programs page')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'courses'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title


class Module(models.Model):
    """Course module"""
    
    LANGUAGE_CHOICES = [
        ('ru', 'Russian'),
        ('kz', 'Kazakh'),
        ('en', 'English'),
    ]
    
    course = models.ForeignKey(Course, related_name='modules', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    title_kz = models.CharField(max_length=255, blank=True, help_text='Title in Kazakh')
    title_en = models.CharField(max_length=255, blank=True, help_text='Title in English')
    description = models.TextField(blank=True)
    description_kz = models.TextField(blank=True, help_text='Description in Kazakh')
    description_en = models.TextField(blank=True, help_text='Description in English')
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='ru', help_text='Language of the module (inherits from course)')
    order = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'modules'
        ordering = ['order', 'id']
        unique_together = ['course', 'order']
    
    def __str__(self):
        return f"{self.course.title} - {self.title}"


class Lesson(models.Model):
    """Lesson model"""
    
    TYPE_CHOICES = [
        ('text', 'Text'),
        ('video', 'Video'),
        ('pdf', 'PDF'),
        ('ppt', 'PPT'),
        ('quiz', 'Quiz'),
    ]
    
    LANGUAGE_CHOICES = [
        ('ru', 'Russian'),
        ('kz', 'Kazakh'),
        ('en', 'English'),
    ]
    
    module = models.ForeignKey(Module, related_name='lessons', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    title_kz = models.CharField(max_length=255, blank=True, help_text='Title in Kazakh')
    title_en = models.CharField(max_length=255, blank=True, help_text='Title in English')
    description = models.TextField(blank=True)
    description_kz = models.TextField(blank=True, help_text='Description in Kazakh')
    description_en = models.TextField(blank=True, help_text='Description in English')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='text')
    content = models.TextField(blank=True)
    content_kz = models.TextField(blank=True, help_text='Content in Kazakh')
    content_en = models.TextField(blank=True, help_text='Content in English')
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='ru', help_text='Language of the lesson (inherits from course)')
    video_url = models.URLField(blank=True, null=True)
    thumbnail_url = models.URLField(blank=True, null=True)
    pdf_url = models.URLField(blank=True, null=True)
    ppt_url = models.URLField(blank=True, null=True)
    test_id = models.CharField(max_length=100, blank=True, null=True, help_text='Test ID for quiz type')
    duration = models.IntegerField(default=0, help_text='Duration in minutes')
    order = models.IntegerField(default=0)
    required = models.BooleanField(default=True)
    allow_download = models.BooleanField(default=False)
    track_progress = models.BooleanField(default=False)
    passing_score = models.IntegerField(null=True, blank=True, help_text='For quiz type')
    max_attempts = models.IntegerField(null=True, blank=True, help_text='For quiz type')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'lessons'
        ordering = ['order', 'id']
        unique_together = ['module', 'order']
    
    def __str__(self):
        return f"{self.module.title} - {self.title}"


class CourseEnrollment(models.Model):
    """Course enrollment"""
    
    STATUS_CHOICES = [
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('exam_available', 'Exam Available'),
        ('exam_passed', 'Exam Passed'),
        ('pending_pdek', 'Pending PDEK Review'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('annulled', 'Annulled'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='enrollments', on_delete=models.CASCADE)
    course = models.ForeignKey(Course, related_name='enrollments', on_delete=models.CASCADE)
    progress = models.IntegerField(default=0, help_text='Progress percentage')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='assigned')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'course_enrollments'
        unique_together = ['user', 'course']
        ordering = ['-enrolled_at']
    
    def __str__(self):
        return f"{self.user.full_name or self.user.phone} - {self.course.title}"


class LessonProgress(models.Model):
    """Lesson progress tracking"""
    
    enrollment = models.ForeignKey(CourseEnrollment, related_name='lesson_progress', on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, related_name='progress', on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'lesson_progress'
        unique_together = ['enrollment', 'lesson']
    
    def __str__(self):
        return f"{self.enrollment.user.full_name or self.enrollment.user.phone} - {self.lesson.title}"


class CourseCompletionVerification(models.Model):
    """Course completion SMS verification"""
    
    enrollment = models.OneToOneField(CourseEnrollment, related_name='completion_verification', on_delete=models.CASCADE)
    otp_code = models.CharField(max_length=6, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'course_completion_verifications'
    
    def __str__(self):
        return f"{self.enrollment.user.full_name or self.enrollment.user.phone} - {self.enrollment.course.title}"
    
    def generate_otp(self):
        """Generate OTP code"""
        import random
        import string
        from django.utils import timezone
        from datetime import timedelta
        import logging
        
        logger = logging.getLogger(__name__)
        
        self.otp_code = ''.join(random.choices(string.digits, k=6))
        self.otp_expires_at = timezone.now() + timedelta(minutes=10)
        self.save()
        
        logger.info(f"Generated OTP for enrollment {self.enrollment.id}: '{self.otp_code}', expires at {self.otp_expires_at}")
        
        return self.otp_code
    
    def verify_otp(self, code):
        """Verify OTP code"""
        from django.utils import timezone
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Нормализуем код: убираем пробелы и приводим к строке
        code = str(code).strip()
        
        logger.info(f"Verifying OTP: code='{code}', stored='{self.otp_code}', enrollment={self.enrollment.id}")
        
        if not self.otp_code or not self.otp_expires_at:
            logger.warning(f"OTP verification failed: missing otp_code or otp_expires_at")
            return False
        
        if timezone.now() > self.otp_expires_at:
            logger.warning(f"OTP verification failed: expired. Now: {timezone.now()}, Expires: {self.otp_expires_at}")
            return False
        
        otp_code = str(self.otp_code).strip()
        if otp_code != code:
            logger.warning(f"OTP verification failed: code mismatch. Expected: '{otp_code}', Got: '{code}'")
            return False
        
        logger.info(f"OTP verification successful for enrollment {self.enrollment.id}")
        self.verified = True
        self.verified_at = timezone.now()
        self.save()
        return True

