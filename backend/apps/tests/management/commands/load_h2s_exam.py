"""
Management command to load the H2S (Сероводород) exam test. Creates category,
test, and 10 questions (верно / не верно).
"""
import copy
from django.core.management.base import BaseCommand
from apps.courses.models import Category
from apps.tests.models import Test, Question


TEST_TITLE = 'Сероводород'
CATEGORY_NAME = 'Сероводород'

QUESTIONS = [
    {
        'text': 'Молекулярная формула сероводорода H2S',
        'options': [
            {'text': 'верно', 'is_correct': True},
            {'text': 'не верно', 'is_correct': False},
        ],
    },
    {
        'text': 'Сероводород является газом',
        'options': [
            {'text': 'верно', 'is_correct': True},
            {'text': 'не верно', 'is_correct': False},
        ],
    },
    {
        'text': 'Встречается сероводород в природе',
        'options': [
            {'text': 'верно', 'is_correct': True},
            {'text': 'не верно', 'is_correct': False},
        ],
    },
    {
        'text': 'Сероводород немного тяжелее воздуха',
        'options': [
            {'text': 'верно', 'is_correct': True},
            {'text': 'не верно', 'is_correct': False},
        ],
    },
    {
        'text': 'Сероводород бесцветный газ с запахом тухлых яиц и сладковатым вкусом',
        'options': [
            {'text': 'верно', 'is_correct': True},
            {'text': 'не верно', 'is_correct': False},
        ],
    },
    {
        'text': 'Сероводород безвреден для здоровья',
        'options': [
            {'text': 'верно', 'is_correct': False},
            {'text': 'не верно', 'is_correct': True},
        ],
    },
    {
        'text': 'Вдыхание воздуха с содержанием сероводорода вызывает головокружение, головную боль, тошноту',
        'options': [
            {'text': 'верно', 'is_correct': True},
            {'text': 'не верно', 'is_correct': False},
        ],
    },
    {
        'text': 'Со значительной концентрацией может привести к коме, судорогам, отеку легких и даже к летальному исходу',
        'options': [
            {'text': 'верно', 'is_correct': True},
            {'text': 'не верно', 'is_correct': False},
        ],
    },
    {
        'text': 'При высокой концентрации однократное вдыхание может вызвать мгновенную смерть',
        'options': [
            {'text': 'верно', 'is_correct': True},
            {'text': 'не верно', 'is_correct': False},
        ],
    },
    {
        'text': 'Сероводород из-за своих полезных свойств находит огромное применении',
        'options': [
            {'text': 'верно', 'is_correct': False},
            {'text': 'не верно', 'is_correct': True},
        ],
    },
]


class Command(BaseCommand):
    help = 'Load the H2S exam test (Сероводород) with 10 questions.'

    def handle(self, *args, **options):
        category, cat_created = Category.objects.get_or_create(
            name=CATEGORY_NAME,
            defaults={
                'name_kz': '',
                'name_en': 'Hydrogen sulfide',
                'description': '',
                'icon': '',
                'order': 0,
                'is_active': True,
            },
        )
        if cat_created:
            self.stdout.write(self.style.SUCCESS(f'Created category: {CATEGORY_NAME}'))
        else:
            self.stdout.write(f'Category already exists: {CATEGORY_NAME}')

        test, test_created = Test.objects.get_or_create(
            title=TEST_TITLE,
            defaults={
                'category': category,
                'language': 'ru',
                'is_standalone': True,
                'is_active': True,
                'passing_score': 80,
                'max_attempts': 3,
                'time_limit': 60,
                'requires_video_recording': False,
            },
        )
        if test_created:
            self.stdout.write(self.style.SUCCESS(f'Created test: {TEST_TITLE}'))
        else:
            self.stdout.write(self.style.WARNING('Тест уже существует, пропуск.'))
            return

        for i, q in enumerate(QUESTIONS, start=1):
            Question.objects.create(
                test=test,
                type='single_choice',
                text=q['text'],
                options=copy.deepcopy(q['options']),
                order=i,
                weight=1,
                language='ru',
            )
        self.stdout.write(self.style.SUCCESS(f'Created {len(QUESTIONS)} questions.'))
