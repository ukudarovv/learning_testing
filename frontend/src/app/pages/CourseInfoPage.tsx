import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { coursesService } from '../services/courses';
import { Course, Lesson, Module } from '../types/lms';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Info,
  Layers,
  Play,
  Award,
  CheckCircle2,
} from 'lucide-react';

function getLocalizedCourseTitle(course: Course, lang: string): string {
  if (lang.startsWith('kz') && course.title_kz) return course.title_kz;
  if (lang.startsWith('en') && course.title_en) return course.title_en;
  return course.title || '';
}

function getLocalizedCourseDescription(course: Course, lang: string): string {
  if (lang.startsWith('kz') && course.description_kz) return course.description_kz;
  if (lang.startsWith('en') && course.description_en) return course.description_en;
  return course.description || '';
}

function getLocalizedModuleTitle(m: Module, lang: string): string {
  if (lang.startsWith('kz') && m.title_kz) return m.title_kz;
  if (lang.startsWith('en') && m.title_en) return m.title_en;
  return m.title || '';
}

function getLocalizedLessonTitle(lesson: Lesson, lang: string): string {
  if (lang.startsWith('kz') && lesson.title_kz) return lesson.title_kz;
  if (lang.startsWith('en') && lesson.title_en) return lesson.title_en;
  return lesson.title || '';
}

function getCategoryLabel(
  category: Course['category'],
  t: (k: string) => string
): string {
  if (typeof category === 'object' && category !== null && 'name' in category) {
    return (category as { name?: string }).name || '—';
  }
  const key = typeof category === 'string' ? category : '';
  const names: Record<string, string> = {
    industrial_safety: t('lms.student.coursesPage.categories.industrial_safety'),
    fire_safety: t('lms.student.coursesPage.categories.fire_safety'),
    electrical_safety: t('lms.student.coursesPage.categories.electrical_safety'),
    labor_protection: t('lms.student.coursesPage.categories.labor_protection'),
    professions: t('lms.student.coursesPage.categories.professions'),
  };
  return names[key] || key || '—';
}

export function CourseInfoPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'ru';
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
        const data = await coursesService.getCourseWithProgress(courseId);
        setCourse(data);
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string; data?: Record<string, unknown> };
        if (e.status === 403 && e.data) {
          const errorData = e.data;
          if (
            errorData.request_status === 'pending' ||
            errorData.error === 'Enrollment request pending'
          ) {
            setAccessDenied(true);
            setRequestStatus('pending');
            setError(t('lms.course.accessPending') || '');
          } else if (
            errorData.request_status === 'rejected' ||
            errorData.error === 'Enrollment request rejected'
          ) {
            setAccessDenied(true);
            setRequestStatus('rejected');
            setError(
              (typeof errorData.admin_response === 'string' && errorData.admin_response) ||
                t('lms.course.accessRejected') ||
                ''
            );
          } else if (
            errorData.request_status === 'not_requested' ||
            errorData.error === 'Enrollment required'
          ) {
            setAccessDenied(true);
            setRequestStatus('not_requested');
            setError(t('lms.course.accessRequired') || '');
          } else {
            setError(e.message || t('lms.courseInfo.loadError'));
          }
        } else if (e.status === 404) {
          try {
            const data = await coursesService.getCourse(courseId);
            setCourse(data);
          } catch {
            setError(t('lms.courseInfo.notFound'));
          }
        } else {
          setError(e.message || t('lms.courseInfo.loadError'));
        }
        console.error('Failed to fetch course:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId, t]);

  const orderedModules = useMemo(() => {
    if (!course?.modules || !Array.isArray(course.modules)) return [];
    const byOrder = (a: { order?: number }, b: { order?: number }) =>
      (a.order ?? 0) - (b.order ?? 0);
    return [...course.modules].sort(byOrder).map((m) => ({
      ...m,
      lessons: [...(m.lessons || [])].sort(byOrder),
    }));
  }, [course]);

  const courseProgress =
    course?.progress !== undefined && course.progress !== null
      ? Math.round(Number(course.progress))
      : 0;

  const enrollmentLabel = course?.enrollment_status || course?.status;
  const finalTestId = course?.final_test_id ?? course?.finalTestId;

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">{t('lms.courseInfo.loading')}</p>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  if (error || !course) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center px-4">
          <div className="text-center max-w-md mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {error || t('lms.courseInfo.notFound')}
            </h1>

            {accessDenied && requestStatus === 'pending' && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                <p className="text-yellow-800 mb-4">
                  {t('lms.course.requestPendingMessage') ||
                    'Ваш запрос на запись на этот курс ожидает подтверждения администратора.'}
                </p>
              </div>
            )}

            {accessDenied && requestStatus === 'rejected' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                <p className="text-red-800 mb-4">
                  {t('lms.course.requestRejectedMessage') ||
                    'Ваш запрос на запись был отклонен администратором.'}
                </p>
              </div>
            )}

            {accessDenied && requestStatus === 'not_requested' && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
                <p className="text-blue-800 mb-4">
                  {t('lms.course.requestRequiredMessage') ||
                    'Для доступа к этому курсу необходимо подать запрос на запись.'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/courses')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('lms.course.goToCourses')}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/student/courses')}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              {t('lms.courseInfo.backToCourses')}
            </button>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  const title = getLocalizedCourseTitle(course, lang);
  const description = getLocalizedCourseDescription(course, lang);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Link
            to="/student/courses"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('lms.courseInfo.backToCourses')}
          </Link>

          <div className="bg-white rounded-lg shadow-md p-6 md:p-8 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{title}</h1>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                  {getCategoryLabel(course.category, t)}
                </span>
              </div>
            </div>

            {description ? (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-semibold text-gray-900 mb-2">{t('lms.courseInfo.description')}</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{description}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{t('lms.courseInfo.duration')}</p>
                  <p className="font-semibold text-gray-900">
                    {course.duration ?? 0}{' '}
                    {t('lms.student.coursesPage.hours')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <BookOpen className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{t('lms.courseInfo.format')}</p>
                  <p className="font-semibold text-gray-900">
                    {t(`lms.courseInfo.format_${course.format || 'online'}`)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Layers className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{t('lms.courseInfo.language')}</p>
                  <p className="font-semibold text-gray-900">
                    {course.language === 'kz'
                      ? t('lms.courseInfo.langKz')
                      : course.language === 'en'
                        ? t('lms.courseInfo.langEn')
                        : t('lms.courseInfo.langRu')}
                  </p>
                </div>
              </div>
              {(course.passing_score ?? course.passingScore) != null && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{t('lms.courseInfo.passingScore')}</p>
                    <p className="font-semibold text-gray-900">
                      {course.passing_score ?? course.passingScore}%
                    </p>
                  </div>
                </div>
              )}
              {(course.max_attempts ?? course.maxAttempts) != null && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">{t('lms.courseInfo.maxAttempts')}</p>
                    <p className="font-semibold text-gray-900">
                      {course.max_attempts ?? course.maxAttempts}
                    </p>
                  </div>
                </div>
              )}
              {(course.has_timer || course.hasTimer) &&
              (course.timer_minutes ?? course.timerMinutes) != null ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">{t('lms.courseInfo.timer')}</p>
                    <p className="font-semibold text-gray-900">
                      {course.timer_minutes ?? course.timerMinutes} {t('lms.courseInfo.minutes')}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span className="font-medium">{t('lms.courseInfo.progressLabel')}</span>
                <span>{courseProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, courseProgress))}%` }}
                />
              </div>
              {enrollmentLabel && (
                <p className="text-xs text-gray-500 mt-2">
                  {t('lms.courseInfo.status')}: {String(enrollmentLabel)}
                </p>
              )}
            </div>

            {finalTestId ? (
              <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-lg mb-6">
                <Award className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                <p className="text-sm text-gray-800">{t('lms.courseInfo.finalTestNote')}</p>
              </div>
            ) : null}

            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-gray-700" />
                {t('lms.courseInfo.programTitle')}
              </h2>
              <div className="space-y-4">
                {orderedModules.length === 0 ? (
                  <p className="text-gray-500 text-sm">{t('lms.courseInfo.noModules')}</p>
                ) : (
                  orderedModules.map((mod) => {
                    const lessons = mod.lessons || [];
                    return (
                      <div
                        key={mod.id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <h3 className="font-semibold text-gray-900">
                            {getLocalizedModuleTitle(mod, lang)}
                          </h3>
                          {mod.description ? (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{mod.description}</p>
                          ) : null}
                          <p className="text-xs text-gray-500 mt-1">
                            {lessons.length}{' '}
                            {lessons.length === 1
                              ? t('lms.courseInfo.lessonSingular')
                              : t('lms.courseInfo.lessonPlural')}
                          </p>
                        </div>
                        <ul className="divide-y divide-gray-100 bg-white">
                          {lessons.map((lesson) => (
                            <li
                              key={lesson.id}
                              className="px-4 py-2.5 text-sm text-gray-800 flex items-start gap-2"
                            >
                              <span className="text-gray-400 mt-0.5">•</span>
                              <span>{getLocalizedLessonTitle(lesson, lang)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
              <Link
                to={`/student/course/${courseId}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                {t('lms.courseInfo.goToLearning')}
              </Link>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
