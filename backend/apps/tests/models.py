from django.db import models
from django.conf import settings
import uuid


class Test(models.Model):
    """Test model"""
    
    LANGUAGE_CHOICES = [
        ('ru', 'Russian'),
        ('kz', 'Kazakh'),
        ('en', 'English'),
    ]
    
    title = models.CharField(max_length=255)
    title_kz = models.CharField(max_length=255, blank=True, help_text='Title in Kazakh')
    title_en = models.CharField(max_length=255, blank=True, help_text='Title in English')
    passing_score = models.IntegerField(default=80, help_text='Minimum score to pass (percentage)')
    time_limit = models.IntegerField(null=True, blank=True, help_text='Time limit in minutes')
    max_attempts = models.IntegerField(default=3, help_text='Maximum attempts allowed')
    is_active = models.BooleanField(default=True)
    requires_video_recording = models.BooleanField(default=False, help_text='Require video recording during test')
    shuffle_questions = models.BooleanField(default=True, help_text='Shuffle questions order for each attempt')
    show_results = models.BooleanField(default=True, help_text='Show test results to students after completion')
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='ru', help_text='Language of the test content')
    category = models.ForeignKey('courses.Category', related_name='tests', on_delete=models.PROTECT, null=True, blank=True, help_text='Category for standalone tests displayed on Training Programs page')
    is_standalone = models.BooleanField(default=True, help_text='If True, test can be used in courses. If False, test is standalone and will be displayed on Training Programs page')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'tests'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title
    
    @property
    def questions_count(self):
        return self.questions.count()


class Question(models.Model):
    """Question model"""
    
    TYPE_CHOICES = [
        ('single_choice', 'Single Choice'),
        ('multiple_choice', 'Multiple Choice'),
        ('yes_no', 'Yes/No'),
        ('matching', 'Matching'),
        ('ordering', 'Ordering'),
        ('short_answer', 'Short Answer'),
    ]
    
    LANGUAGE_CHOICES = [
        ('ru', 'Russian'),
        ('kz', 'Kazakh'),
        ('en', 'English'),
    ]
    
    test = models.ForeignKey(Test, related_name='questions', on_delete=models.CASCADE)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    text = models.TextField()
    text_kz = models.TextField(blank=True, help_text='Question text in Kazakh')
    text_en = models.TextField(blank=True, help_text='Question text in English')
    options = models.JSONField(default=list, help_text='List of answer options with is_correct flag. Options can have text, text_kz, text_en fields for multilingual support.')
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='ru', help_text='Language of the question (inherits from test)')
    order = models.IntegerField(default=0)
    weight = models.IntegerField(default=1, help_text='Question weight for scoring')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'questions'
        ordering = ['order', 'id']
        unique_together = ['test', 'order']
    
    def __str__(self):
        return f"{self.test.title} - {self.text[:50]}"
    
    def get_correct_answers(self):
        """Get list of correct answer IDs (or text for yes_no questions)"""
        if not self.options:
            return []
        
        # Для yes_no вопросов возвращаем текст правильного ответа ("Да" или "Нет")
        if self.type == 'yes_no':
            # Для yes_no вопросов опции могут быть объектами с is_correct или строками
            result = []
            for opt in self.options:
                if isinstance(opt, dict):
                    if opt.get('is_correct', False):
                        result.append(opt.get('text', opt.get('id', '')))
                elif isinstance(opt, str):
                    # Если опция - строка, просто добавляем её (для обратной совместимости)
                    result.append(opt)
            return result
        
        # Для остальных типов вопросов возвращаем ID правильных ответов
        # Примечание: ID должны быть сгенерированы при сохранении через сериализатор или метод save()
        return [opt.get('id') for opt in self.options if isinstance(opt, dict) and opt.get('is_correct', False) and opt.get('id')]
    
    def save(self, *args, **kwargs):
        """Override save to ensure all options have IDs"""
        # Убеждаемся, что все опции имеют ID перед сохранением
        # Для yes_no вопросов опции могут быть пустыми
        if self.options and self.type != 'yes_no':
            for opt in self.options:
                if isinstance(opt, dict) and ('id' not in opt or not opt.get('id')):
                    opt['id'] = str(uuid.uuid4())
        super().save(*args, **kwargs)


class TestAssignment(models.Model):
    """Test assignment by admin"""
    
    STATUS_CHOICES = [
        ('assigned', 'Assigned'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('revoked', 'Revoked'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='test_assignments', on_delete=models.CASCADE)
    test = models.ForeignKey(Test, related_name='assignments', on_delete=models.CASCADE)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='assigned_tests',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='Admin who assigned the test'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='assigned')
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'test_assignments'
        unique_together = ['user', 'test']
        ordering = ['-assigned_at']
        indexes = [
            models.Index(fields=['user', 'test', 'status']),
            models.Index(fields=['status', '-assigned_at']),
        ]
    
    def __str__(self):
        return f"{self.user.full_name or self.user.phone} - {self.test.title} ({self.get_status_display()})"


class TestEnrollmentRequest(models.Model):
    """Request for test enrollment with admin approval"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='test_enrollment_requests', on_delete=models.CASCADE)
    test = models.ForeignKey(Test, related_name='enrollment_requests', on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_response = models.TextField(blank=True, help_text='Admin response or rejection reason')
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='processed_test_enrollment_requests',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'test_enrollment_requests'
        ordering = ['-created_at']
        unique_together = ['user', 'test']
        indexes = [
            models.Index(fields=['user', 'test', 'status']),
            models.Index(fields=['status', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.full_name or self.user.phone} - {self.test.title} ({self.get_status_display()})"
    
    def clean(self):
        """Validate test enrollment request"""
        # Убрана проверка is_standalone - теперь запросы можно создавать для всех тестов
        pass


class TestCompletionVerification(models.Model):
    """Test completion SMS verification for standalone tests"""
    
    test_attempt = models.OneToOneField('exams.TestAttempt', related_name='completion_verification', on_delete=models.CASCADE)
    otp_code = models.CharField(max_length=6, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'test_completion_verifications'
    
    def __str__(self):
        return f"{self.test_attempt.user.full_name or self.test_attempt.user.phone} - {self.test_attempt.test.title}"
    
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
        
        logger.info(f"Generated OTP for test attempt {self.test_attempt.id}: '{self.otp_code}', expires at {self.otp_expires_at}")
        
        return self.otp_code
    
    def verify_otp(self, code):
        """Verify OTP code"""
        from django.utils import timezone
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Нормализуем код: убираем пробелы и приводим к строке
        code = str(code).strip()
        
        logger.info(f"Verifying OTP: code='{code}', stored='{self.otp_code}', test_attempt={self.test_attempt.id}")
        
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
        
        logger.info(f"OTP verification successful for test attempt {self.test_attempt.id}")
        self.verified = True
        self.verified_at = timezone.now()
        self.save()
        return True

