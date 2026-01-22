"""Signals for automatic notification creation"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Notification
from apps.courses.models import CourseEnrollment
from apps.protocols.models import Protocol
from apps.certificates.models import Certificate


@receiver(post_save, sender=CourseEnrollment)
def notify_course_assigned(sender, instance, created, **kwargs):
    """Notify user when enrolled in course"""
    if created:
        Notification.objects.create(
            user=instance.user,
            type='course_assigned',
            title='Курс назначен',
            message=f'Вам назначен курс "{instance.course.title}"'
        )


@receiver(post_save, sender=Protocol)
def notify_protocol_ready(sender, instance, created, **kwargs):
    """Notify user when protocol is ready"""
    if created and instance.status == 'generated':
        Notification.objects.create(
            user=instance.student,
            type='protocol_ready',
            title='Протокол готов',
            message=f'Протокол {instance.number} готов к подписанию'
        )


@receiver(post_save, sender=Certificate)
def notify_certificate_issued(sender, instance, created, **kwargs):
    """Notify user when certificate is issued (course or standalone test)"""
    if not created:
        return
    if instance.course_id:
        subject = f'по курсу "{instance.course.title}"'
    elif instance.test_id:
        subject = f'по тесту "{instance.test.title}"'
    else:
        subject = ''
    message = f'Вам выдан сертификат № {instance.number} {subject}'.strip()
    Notification.objects.create(
        user=instance.student,
        type='certificate_issued',
        title='Сертификат выдан',
        message=message,
    )

