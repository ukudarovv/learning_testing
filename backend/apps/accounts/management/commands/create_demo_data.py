"""
Management command to create demo data for testing
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.models import User
from apps.courses.models import Course, Module, Lesson
from apps.tests.models import Test, Question
from datetime import timedelta


class Command(BaseCommand):
    help = 'Create demo data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Creating demo data...')
        
        # Create admin user
        admin, created = User.objects.get_or_create(
            phone='77771234567',
            defaults={
                'full_name': 'Администратор',
                'email': 'admin@aqlant.com',
                'role': 'admin',
                'verified': True,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save()
            self.stdout.write(self.style.SUCCESS(f'Created admin user: {admin.phone} / admin123'))
        else:
            self.stdout.write(self.style.WARNING(f'Admin user already exists: {admin.phone}'))
        
        # Create student users
        students_data = [
            {'phone': '77771111111', 'name': 'Иван Иванов', 'iin': '123456789012'},
            {'phone': '77772222222', 'name': 'Мария Петрова', 'iin': '123456789013'},
            {'phone': '77773333333', 'name': 'Алексей Сидоров', 'iin': '123456789014'},
        ]
        
        for student_data in students_data:
            student, created = User.objects.get_or_create(
                phone=student_data['phone'],
                defaults={
                    'full_name': student_data['name'],
                    'email': f"{student_data['phone']}@example.com",
                    'iin': student_data['iin'],
                    'role': 'student',
                    'verified': True,
                }
            )
            if created:
                student.set_password('student123')
                student.save()
                self.stdout.write(self.style.SUCCESS(f'Created student: {student.phone} / student123'))
        
        # Create teacher
        teacher, created = User.objects.get_or_create(
            phone='77774444444',
            defaults={
                'full_name': 'Преподаватель Тестов',
                'email': 'teacher@aqlant.com',
                'role': 'teacher',
                'verified': True,
            }
        )
        if created:
            teacher.set_password('teacher123')
            teacher.save()
            self.stdout.write(self.style.SUCCESS(f'Created teacher: {teacher.phone} / teacher123'))
        
        # Create PDEK members
        pdek_member, created = User.objects.get_or_create(
            phone='77775555555',
            defaults={
                'full_name': 'Член ПДЭК',
                'email': 'pdek@aqlant.com',
                'role': 'pdek_member',
                'verified': True,
            }
        )
        if created:
            pdek_member.set_password('pdek123')
            pdek_member.save()
            self.stdout.write(self.style.SUCCESS(f'Created PDEK member: {pdek_member.phone} / pdek123'))
        
        pdek_chairman, created = User.objects.get_or_create(
            phone='77776666666',
            defaults={
                'full_name': 'Председатель ПДЭК',
                'email': 'chairman@aqlant.com',
                'role': 'pdek_chairman',
                'verified': True,
            }
        )
        if created:
            pdek_chairman.set_password('chairman123')
            pdek_chairman.save()
            self.stdout.write(self.style.SUCCESS(f'Created PDEK chairman: {pdek_chairman.phone} / chairman123'))
        
        # Create test course
        course, created = Course.objects.get_or_create(
            title='Промышленная безопасность',
            defaults={
                'title_kz': 'Өнеркәсіптік қауіпсіздік',
                'title_en': 'Industrial Safety',
                'description': 'Курс по промышленной безопасности для работников опасных производственных объектов',
                'category': 'industrial_safety',
                'duration': 40,
                'format': 'online',
                'passing_score': 80,
                'max_attempts': 3,
                'has_timer': True,
                'timer_minutes': 120,
                'status': 'assigned',
            }
        )
        
        if created:
            # Create modules
            module1 = Module.objects.create(
                course=course,
                title='Модуль 1: Основы промышленной безопасности',
                description='Введение в промышленную безопасность',
                order=1
            )
            
            module2 = Module.objects.create(
                course=course,
                title='Модуль 2: Требования безопасности',
                description='Основные требования к безопасности',
                order=2
            )
            
            # Create lessons
            Lesson.objects.create(
                module=module1,
                title='Введение в курс',
                description='Обзор курса и основных понятий',
                type='text',
                content='Промышленная безопасность - это состояние защищенности...',
                order=1,
                required=True
            )
            
            Lesson.objects.create(
                module=module1,
                title='Видео-лекция: Основы',
                description='Видео-лекция по основам промышленной безопасности',
                type='video',
                video_url='https://example.com/video1.mp4',
                thumbnail_url='https://example.com/thumb1.jpg',
                order=2,
                required=True,
                track_progress=True
            )
            
            Lesson.objects.create(
                module=module2,
                title='Нормативные документы',
                description='Изучение нормативных документов',
                type='pdf',
                pdf_url='https://example.com/document.pdf',
                order=1,
                required=True,
                allow_download=True
            )
            
            self.stdout.write(self.style.SUCCESS(f'Created course: {course.title}'))
        
        # Create test
        test, created = Test.objects.get_or_create(
            title='Тест по промышленной безопасности',
            defaults={
                'course': course,
                'passing_score': 80,
                'time_limit': 60,
                'max_attempts': 3,
                'is_active': True,
            }
        )
        
        if created:
            # Create questions
            question1 = Question.objects.create(
                test=test,
                type='single_choice',
                text='Что такое промышленная безопасность?',
                options=[
                    {'id': '1', 'text': 'Состояние защищенности', 'is_correct': True},
                    {'id': '2', 'text': 'Техническое обслуживание', 'is_correct': False},
                    {'id': '3', 'text': 'Экономическая эффективность', 'is_correct': False},
                ],
                order=1,
                weight=1
            )
            
            question2 = Question.objects.create(
                test=test,
                type='multiple_choice',
                text='Какие факторы влияют на промышленную безопасность?',
                options=[
                    {'id': '1', 'text': 'Техническое состояние оборудования', 'is_correct': True},
                    {'id': '2', 'text': 'Квалификация персонала', 'is_correct': True},
                    {'id': '3', 'text': 'Погодные условия', 'is_correct': False},
                    {'id': '4', 'text': 'Соблюдение требований', 'is_correct': True},
                ],
                order=2,
                weight=2
            )
            
            question3 = Question.objects.create(
                test=test,
                type='yes_no',
                text='Обязательно ли проходить обучение по промышленной безопасности?',
                options=[
                    {'id': '1', 'text': 'Да', 'is_correct': True},
                    {'id': '2', 'text': 'Нет', 'is_correct': False},
                ],
                order=3,
                weight=1
            )
            
            self.stdout.write(self.style.SUCCESS(f'Created test: {test.title} with {test.questions.count()} questions'))
        
        self.stdout.write(self.style.SUCCESS('\nDemo data created successfully!'))
        self.stdout.write('\nTest credentials:')
        self.stdout.write('Admin: 77771234567 / admin123')
        self.stdout.write('Student: 77771111111 / student123')
        self.stdout.write('Teacher: 77774444444 / teacher123')
        self.stdout.write('PDEK Member: 77775555555 / pdek123')
        self.stdout.write('PDEK Chairman: 77776666666 / chairman123')

