from django.db import models
from django.conf import settings


class Notification(models.Model):
    """Notification model"""
    
    TYPE_CHOICES = [
        ('course_assigned', 'Course Assigned'),
        ('exam_available', 'Exam Available'),
        ('protocol_ready', 'Protocol Ready'),
        ('certificate_issued', 'Certificate Issued'),
        ('pdek_signature_request', 'EC Signature Request'),
        ('exam_passed', 'Exam Passed'),
        ('exam_failed', 'Exam Failed'),
        ('extra_attempt_request', 'Extra Attempt Request'),
        ('extra_attempt_approved', 'Extra Attempt Approved'),
        ('extra_attempt_rejected', 'Extra Attempt Rejected'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE)
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'read', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.full_name or self.user.phone} - {self.title}"

