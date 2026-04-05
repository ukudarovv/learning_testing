import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { CoursePlayer } from '../components/lms/CoursePlayer';
import { coursesService } from '../services/courses';
import { Course } from '../types/lms';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useEnrollmentRequests } from '../hooks/useEnrollmentRequests';

export function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { courseRequests, refresh: refreshEnrollmentRequests } = useEnrollmentRequests();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'pending' | 'rejected' | 'not_requested' | null>(null);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setAccessDenied(false);
        setRequestStatus(null);
        // Используем getCourseWithProgress для получения курса с прогрессом студента
        // Backend проверит наличие одобренного запроса перед предоставлением доступа
        const data = await coursesService.getCourseWithProgress(courseId);
        setCourse(data);
      } catch (err: any) {
        // Проверяем, является ли это ошибкой доступа из-за отсутствия enrollment или pending запроса
        if (err.status === 403 && err.data) {
          const errorData = err.data;
          if (errorData.request_status === 'pending' || errorData.error === 'Enrollment request pending') {
            setAccessDenied(true);
            setRequestStatus('pending');
            setError(t('lms.course.accessPending') || 'Ваш запрос на запись ожидает подтверждения администратора');
          } else if (errorData.request_status === 'rejected' || errorData.error === 'Enrollment request rejected') {
            setAccessDenied(true);
            setRequestStatus('rejected');
            setError(errorData.admin_response || (t('lms.course.accessRejected') || 'Ваш запрос на запись был отклонен'));
          } else if (errorData.request_status === 'not_requested' || errorData.error === 'Enrollment required') {
            setAccessDenied(true);
            setRequestStatus('not_requested');
            setError(t('lms.course.accessRequired') || 'Для доступа к курсу необходимо подать запрос на запись');
          } else {
            setError(err.message || 'Ошибка доступа к курсу');
          }
        } else if (err.status === 404) {
          // Если курс не найден, пробуем загрузить обычный курс
          try {
            const data = await coursesService.getCourse(courseId);
            setCourse(data);
          } catch (fallbackErr: any) {
            setError(fallbackErr.message || 'Курс не найден');
          }
        } else {
          setError(err.message || 'Ошибка загрузки курса');
        }
        console.error('Failed to fetch course:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  const handleLessonComplete = async (lessonId: string) => {
    try {
      const response = await coursesService.completeLesson(lessonId);
      toast.success('Урок отмечен как завершенный');
      
      // Обновляем курс с прогрессом после завершения урока
      if (courseId) {
        try {
          const updatedCourse = await coursesService.getCourseWithProgress(courseId);
          setCourse(updatedCourse);
        } catch (err) {
          // Если не удалось загрузить с прогрессом, обновляем локально
          if (course) {
            const updatedCourse = { ...course };
            if (updatedCourse.progress !== undefined) {
              updatedCourse.progress = response.progress;
            }
            // Обновляем статус урока в локальном состоянии
            if (updatedCourse.modules) {
              updatedCourse.modules = updatedCourse.modules.map(module => ({
                ...module,
                lessons: module.lessons.map(lesson => 
                  lesson.id === lessonId ? { ...lesson, completed: true } : lesson
                )
              }));
            }
            setCourse(updatedCourse);
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Ошибка при завершении урока');
    }
  };

  const handleCourseComplete = async () => {
    // Перезагружаем курс для обновления статуса
    if (courseId) {
      try {
        console.log('Refreshing course after completion...');
        // Добавляем небольшую задержку, чтобы бэкенд успел обновить статус
        await new Promise(resolve => setTimeout(resolve, 500));
        const updatedCourse = await coursesService.getCourseWithProgress(courseId);
        console.log('Updated course data:', updatedCourse);
        console.log('Enrollment status:', updatedCourse?.enrollment_status || updatedCourse?.status);
        console.log('Full course object:', JSON.stringify(updatedCourse, null, 2));
        setCourse(updatedCourse);
        
        const enrollmentStatus = updatedCourse?.enrollment_status || updatedCourse?.status;
        if (enrollmentStatus === 'pending_pdek') {
          toast.success('Курс отправлен на проверку ЭК. Вы получите уведомление после проверки.');
        } else if (enrollmentStatus === 'completed') {
          toast.success('Курс завершен! Сертификат выдан.');
        } else {
          console.warn('Unexpected enrollment status after completion:', enrollmentStatus);
          console.warn('Course object keys:', Object.keys(updatedCourse || {}));
        }
      } catch (error: any) {
        console.error('Failed to refresh course:', error);
        toast.error('Ошибка при обновлении данных курса');
      }
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Загрузка курса...</p>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  if (error || !course) {
    const existingRequest = courseRequests.find(r => r.courseId === courseId || (typeof r.course === 'object' && r.course?.id === courseId));
    
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {error || 'Курс не найден'}
            </h1>
            
            {accessDenied && requestStatus === 'pending' && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 mb-4">
                  {t('lms.course.requestPendingMessage') || 'Ваш запрос на запись на этот курс ожидает подтверждения администратора. Вы получите уведомление после рассмотрения запроса.'}
                </p>
              </div>
            )}
            
            {accessDenied && requestStatus === 'rejected' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 mb-4">
                  {t('lms.course.requestRejectedMessage') || 'Ваш запрос на запись был отклонен администратором.'}
                </p>
              </div>
            )}
            
            {accessDenied && requestStatus === 'not_requested' && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 mb-4">
                  {t('lms.course.requestRequiredMessage') || 'Для доступа к этому курсу необходимо подать запрос на запись. Перейдите на страницу курсов и нажмите "Записаться на курс".'}
                </p>
                <button
                  onClick={() => navigate('/courses')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('lms.course.goToCourses') || 'Перейти к курсам'}
                </button>
              </div>
            )}
            
            <button
              onClick={() => navigate('/student/dashboard')}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              {t('lms.course.backToDashboard') || 'Вернуться в личный кабинет'}
            </button>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <Header />
      <CoursePlayer
        course={course}
        onLessonComplete={handleLessonComplete}
        onCourseComplete={handleCourseComplete}
      />
      <SiteFooter />
    </>
  );
}
