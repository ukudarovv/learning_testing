from django.core.management.base import BaseCommand
from apps.courses.models import CourseEnrollmentRequest


class Command(BaseCommand):
    help = 'Удалить все запросы на поступление на курсы'

    def handle(self, *args, **options):
        count = CourseEnrollmentRequest.objects.count()
        self.stdout.write(f'Найдено {count} запросов на поступление на курсы')
        
        if count > 0:
            CourseEnrollmentRequest.objects.all().delete()
            self.stdout.write(
                self.style.SUCCESS(f'Успешно удалено {count} запросов на поступление на курсы')
            )
        else:
            self.stdout.write('Запросы на поступление не найдены')
