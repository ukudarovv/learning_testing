from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Avg, Sum
from django.utils import timezone
from django.http import HttpResponse
from datetime import timedelta, datetime
from collections import defaultdict
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

from apps.accounts.models import User
from apps.courses.models import Course, CourseEnrollment, LessonProgress, Lesson
from apps.exams.models import TestAttempt
from apps.certificates.models import Certificate
from apps.accounts.permissions import IsAdmin
from apps.core.export_utils import export_to_excel, export_to_excel_multi_sheet, create_excel_response


class AnalyticsViewSet(viewsets.ViewSet):
    """Analytics ViewSet"""
    permission_classes = [IsAdmin]
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get general statistics"""
        total_students = User.objects.filter(role='student').count()
        active_students = User.objects.filter(
            role='student',
            enrollments__status__in=['in_progress', 'exam_available']
        ).distinct().count()
        
        active_courses = Course.objects.filter(status__in=['assigned', 'in_progress']).count()
        completed_courses = CourseEnrollment.objects.filter(status='completed').count()
        
        today = timezone.now().date()
        tests_today = TestAttempt.objects.filter(started_at__date=today).count()
        
        # Success rate
        total_attempts = TestAttempt.objects.filter(completed_at__isnull=False).count()
        passed_attempts = TestAttempt.objects.filter(completed_at__isnull=False, passed=True).count()
        success_rate = (passed_attempts / total_attempts * 100) if total_attempts > 0 else 0
        
        # Average score
        avg_score = TestAttempt.objects.filter(
            completed_at__isnull=False,
            score__isnull=False
        ).aggregate(avg=Avg('score'))['avg'] or 0
        
        total_certificates = Certificate.objects.count()
        this_month = timezone.now().replace(day=1)
        certificates_this_month = Certificate.objects.filter(issued_at__gte=this_month).count()
        
        return Response({
            'total_students': total_students,
            'active_students': active_students,
            'active_courses': active_courses,
            'completed_courses': completed_courses,
            'tests_today': tests_today,
            'success_rate': round(success_rate, 2),
            'avg_score': round(avg_score, 2),
            'total_certificates': total_certificates,
            'certificates_this_month': certificates_this_month,
        })
    
    @action(detail=False, methods=['get'])
    def enrollment_trend(self, request):
        """Get enrollment trend over months"""
        six_months_ago = timezone.now() - timedelta(days=180)
        enrollments = CourseEnrollment.objects.filter(
            enrolled_at__gte=six_months_ago
        ).extra(
            select={'month': "strftime('%%Y-%%m', enrolled_at)"}
        ).values('month').annotate(
            students=Count('user', distinct=True)
        ).order_by('month')
        
        result = []
        for item in enrollments:
            result.append({
                'month': item['month'],
                'students': item['students']
            })
        
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def test_results_distribution(self, request):
        """Get test results distribution"""
        attempts = TestAttempt.objects.filter(
            completed_at__isnull=False,
            score__isnull=False
        )
        
        distribution = {
            '0-50': attempts.filter(score__lt=50).count(),
            '50-70': attempts.filter(score__gte=50, score__lt=70).count(),
            '70-85': attempts.filter(score__gte=70, score__lt=85).count(),
            '85-100': attempts.filter(score__gte=85).count(),
        }
        
        colors = {
            '0-50': '#ef4444',
            '50-70': '#f59e0b',
            '70-85': '#3b82f6',
            '85-100': '#10b981',
        }
        
        result = []
        for key, value in distribution.items():
            result.append({
                'name': key,
                'value': value,
                'color': colors[key]
            })
        
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def courses_popularity(self, request):
        """Get courses popularity"""
        courses = Course.objects.annotate(
            students=Count('enrollments', distinct=True)
        ).order_by('-students')[:10]
        
        result = []
        for course in courses:
            result.append({
                'name': course.title,
                'students': course.students
            })
        
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def top_students(self, request):
        """Get top students"""
        students = User.objects.filter(role='student').annotate(
            courses_count=Count('enrollments', distinct=True),
            certificates_count=Count('certificates', distinct=True)
        )
        
        # Calculate average score
        top_students = []
        for student in students:
            attempts = TestAttempt.objects.filter(
                user=student,
                completed_at__isnull=False,
                score__isnull=False
            )
            avg_score = attempts.aggregate(avg=Avg('score'))['avg'] or 0
            
            top_students.append({
                'id': str(student.id),
                'name': student.full_name or student.phone,
                'rank': 0,  # Will be set after sorting
                'courses': student.courses_count,
                'avg_score': round(avg_score, 2),
                'certificates': student.certificates_count,
            })
        
        # Sort by avg_score and courses
        top_students.sort(key=lambda x: (x['avg_score'], x['courses']), reverse=True)
        
        # Set ranks
        for i, student in enumerate(top_students[:10], 1):
            student['rank'] = i
        
        return Response(top_students[:10])

    def _get_stats_data(self):
        """Get stats data for reports"""
        total_students = User.objects.filter(role='student').count()
        active_students = User.objects.filter(
            role='student',
            enrollments__status__in=['in_progress', 'exam_available']
        ).distinct().count()
        active_courses = Course.objects.filter(status__in=['assigned', 'in_progress']).count()
        completed_courses = CourseEnrollment.objects.filter(status='completed').count()
        total_attempts = TestAttempt.objects.filter(completed_at__isnull=False).count()
        passed_attempts = TestAttempt.objects.filter(completed_at__isnull=False, passed=True).count()
        success_rate = (passed_attempts / total_attempts * 100) if total_attempts > 0 else 0
        avg_score = TestAttempt.objects.filter(
            completed_at__isnull=False,
            score__isnull=False
        ).aggregate(avg=Avg('score'))['avg'] or 0
        total_certificates = Certificate.objects.count()
        this_month = timezone.now().replace(day=1)
        certificates_this_month = Certificate.objects.filter(issued_at__gte=this_month).count()
        return {
            'total_students': total_students,
            'active_students': active_students,
            'active_courses': active_courses,
            'completed_courses': completed_courses,
            'success_rate': round(success_rate, 2),
            'avg_score': round(avg_score, 2),
            'total_certificates': total_certificates,
            'certificates_this_month': certificates_this_month,
        }

    @action(detail=False, methods=['get'], url_path='summary_report')
    def summary_report(self, request):
        """Export summary report as PDF or Excel"""
        fmt = request.query_params.get('format', 'xlsx').lower()
        if fmt not in ('pdf', 'xlsx'):
            return Response({'error': 'Invalid format. Use pdf or xlsx'}, status=400)

        stats = self._get_stats_data()
        if fmt == 'xlsx':
            headers = ['Показатель', 'Значение']
            rows = [
                ['Всего студентов', stats['total_students']],
                ['Активных студентов', stats['active_students']],
                ['Активных курсов', stats['active_courses']],
                ['Завершено курсов', stats['completed_courses']],
                ['Процент сдачи (%)', stats['success_rate']],
                ['Средний балл', stats['avg_score']],
                ['Всего сертификатов', stats['total_certificates']],
                ['Сертификатов за месяц', stats['certificates_this_month']],
            ]
            buffer = export_to_excel(headers, rows, 'Сводный отчет')
            return create_excel_response(buffer, 'summary_report.xlsx')

        # PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=TA_CENTER)
        story.append(Paragraph('Сводный отчет', title_style))
        story.append(Spacer(1, 0.5*cm))
        data = [['Показатель', 'Значение']] + [
            ['Всего студентов', str(stats['total_students'])],
            ['Активных студентов', str(stats['active_students'])],
            ['Активных курсов', str(stats['active_courses'])],
            ['Завершено курсов', str(stats['completed_courses'])],
            ['Процент сдачи (%)', str(stats['success_rate'])],
            ['Средний балл', str(stats['avg_score'])],
            ['Всего сертификатов', str(stats['total_certificates'])],
            ['Сертификатов за месяц', str(stats['certificates_this_month'])],
        ]
        table = Table(data, colWidths=[8*cm, 6*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E0E0E0')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
        ]))
        story.append(table)
        doc.build(story)
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="summary_report.pdf"'
        return response

    @action(detail=False, methods=['get'], url_path='test_results_export')
    def test_results_export(self, request):
        """Export test results to Excel"""
        attempts = TestAttempt.objects.filter(
            completed_at__isnull=False
        ).select_related('user', 'test').order_by('-completed_at')[:5000]

        headers = ['Студент', 'Тест', 'Балл', 'Проходной балл', 'Результат', 'Дата прохождения']
        rows = []
        for a in attempts:
            passing_score = a.test.passing_score if a.test else None
            rows.append([
                a.user.full_name or a.user.phone or '',
                a.test.title if a.test else '—',
                f'{a.score:.1f}' if a.score is not None else '—',
                f'{passing_score:.1f}' if passing_score is not None else '—',
                'Сдан' if a.passed else 'Не сдан',
                a.completed_at.strftime('%Y-%m-%d %H:%M') if a.completed_at else '',
            ])
        buffer = export_to_excel(headers, rows, 'Результаты тестов')
        return create_excel_response(buffer, 'test_results.xlsx')

    @action(detail=False, methods=['get'], url_path='certificates_export')
    def certificates_export(self, request):
        """Export certificates list as PDF or Excel"""
        fmt = request.query_params.get('format', 'xlsx').lower()
        if fmt not in ('pdf', 'xlsx'):
            return Response({'error': 'Invalid format. Use pdf or xlsx'}, status=400)

        certs = Certificate.objects.select_related('student', 'course', 'test').order_by('-issued_at')[:1000]
        headers = ['Номер', 'Студент', 'Курс/Тест', 'Дата выдачи']
        rows = []
        for c in certs:
            course_or_test = c.course.title if c.course else (c.test.title if c.test else '—')
            rows.append([
                c.number,
                c.student.full_name or c.student.phone or '',
                course_or_test,
                c.issued_at.strftime('%Y-%m-%d %H:%M') if c.issued_at else '',
            ])

        if fmt == 'xlsx':
            buffer = export_to_excel(headers, rows, 'Сертификаты')
            return create_excel_response(buffer, 'certificates.xlsx')

        # PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=TA_CENTER)
        story.append(Paragraph('Выданные сертификаты', title_style))
        story.append(Spacer(1, 0.5*cm))
        data = [headers] + rows
        table = Table(data, colWidths=[4*cm, 5*cm, 6*cm, 3*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E0E0E0')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ]))
        story.append(table)
        doc.build(story)
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="certificates.pdf"'
        return response

    @action(detail=False, methods=['get'], url_path='courses_popularity_export')
    def courses_popularity_export(self, request):
        """Export courses popularity to Excel"""
        courses = Course.objects.annotate(
            students=Count('enrollments', distinct=True)
        ).order_by('-students')

        headers = ['Курс', 'Количество студентов']
        rows = [[c.title, c.students] for c in courses]
        buffer = export_to_excel(headers, rows, 'Популярность курсов')
        return create_excel_response(buffer, 'courses_popularity.xlsx')

    @action(detail=False, methods=['get'], url_path='learning_exam_report')
    def learning_exam_report(self, request):
        """Export detailed report on learning process and exam results to Excel"""
        course_id = request.query_params.get('course_id')
        user_id = request.query_params.get('user_id')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        enrollments_qs = CourseEnrollment.objects.select_related('user', 'course').order_by('-enrolled_at')[:5000]
        lesson_progress_qs = LessonProgress.objects.select_related(
            'enrollment__user', 'enrollment__course', 'lesson__module'
        ).filter(completed=True).order_by('enrollment', 'lesson__module__order', 'lesson__order')[:10000]
        attempts_qs = TestAttempt.objects.filter(
            completed_at__isnull=False
        ).select_related('user', 'test').order_by('user', 'test', 'started_at')[:5000]

        if course_id:
            enrollments_qs = enrollments_qs.filter(course_id=course_id)
            lesson_progress_qs = lesson_progress_qs.filter(enrollment__course_id=course_id)
            attempts_qs = attempts_qs.filter(test__final_courses__id=course_id)
        if user_id:
            enrollments_qs = enrollments_qs.filter(user_id=user_id)
            lesson_progress_qs = lesson_progress_qs.filter(enrollment__user_id=user_id)
            attempts_qs = attempts_qs.filter(user_id=user_id)
        if date_from:
            try:
                dt_from = datetime.strptime(date_from, '%Y-%m-%d')
                if timezone.is_naive(dt_from):
                    dt_from = timezone.make_aware(dt_from)
                enrollments_qs = enrollments_qs.filter(enrolled_at__gte=dt_from)
                lesson_progress_qs = lesson_progress_qs.filter(completed_at__gte=dt_from)
                attempts_qs = attempts_qs.filter(completed_at__gte=dt_from)
            except ValueError:
                pass
        if date_to:
            try:
                dt_to = datetime.strptime(date_to, '%Y-%m-%d')
                if timezone.is_naive(dt_to):
                    dt_to = timezone.make_aware(dt_to)
                dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)
                enrollments_qs = enrollments_qs.filter(enrolled_at__lte=dt_to)
                lesson_progress_qs = lesson_progress_qs.filter(completed_at__lte=dt_to)
                attempts_qs = attempts_qs.filter(completed_at__lte=dt_to)
            except ValueError:
                pass

        # Sheet 1: Learning process
        enrollments = list(enrollments_qs)
        learning_headers = [
            'Студент', 'Email', 'Телефон', 'Курс', 'Дата записи', 'Прогресс %',
            'Статус', 'Завершено уроков', 'Всего уроков', 'Дата завершения'
        ]
        learning_rows = []
        for e in enrollments:
            total_lessons = Lesson.objects.filter(module__course=e.course).count()
            completed_lessons = LessonProgress.objects.filter(enrollment=e, completed=True).count()
            learning_rows.append([
                e.user.full_name or '',
                e.user.email or '',
                e.user.phone or '',
                e.course.title,
                e.enrolled_at,
                e.progress,
                e.get_status_display() if hasattr(e, 'get_status_display') else e.status,
                completed_lessons,
                total_lessons,
                e.completed_at,
            ])

        # Sheet 2: Lesson progress
        lesson_progress_list = list(lesson_progress_qs)
        lesson_headers = ['Студент', 'Курс', 'Модуль', 'Урок', 'Завершён', 'Дата завершения']
        lesson_rows = []
        for lp in lesson_progress_list:
            lesson_rows.append([
                lp.enrollment.user.full_name or lp.enrollment.user.phone or '',
                lp.enrollment.course.title,
                lp.lesson.module.title if lp.lesson.module else '—',
                lp.lesson.title,
                'Да' if lp.completed else 'Нет',
                lp.completed_at,
            ])

        # Sheet 3: Exam results
        attempts = list(attempts_qs)
        attempt_counts = defaultdict(int)
        exam_headers = [
            'Студент', 'Тест', 'Курс', 'Попытка №', 'Балл', 'Проходной балл',
            'Результат', 'Дата начала', 'Дата завершения'
        ]
        exam_rows = []
        for a in attempts:
            key = (a.user_id, a.test_id)
            attempt_counts[key] += 1
            attempt_num = attempt_counts[key]
            course = a.test.final_courses.first() if a.test else None
            course_title = course.title if course else '—'
            passing_score = a.test.passing_score if a.test else None
            exam_rows.append([
                a.user.full_name or a.user.phone or '',
                a.test.title if a.test else '—',
                course_title,
                attempt_num,
                f'{a.score:.1f}' if a.score is not None else '—',
                f'{passing_score:.1f}' if passing_score is not None else '—',
                'Сдан' if a.passed else 'Не сдан',
                a.started_at,
                a.completed_at,
            ])

        sheets_data = [
            ('Процесс обучения', learning_headers, learning_rows),
            ('Прогресс по урокам', lesson_headers, lesson_rows),
            ('Результаты экзаменов', exam_headers, exam_rows),
        ]
        buffer = export_to_excel_multi_sheet(sheets_data)
        return create_excel_response(buffer, 'learning_exam_report.xlsx')

