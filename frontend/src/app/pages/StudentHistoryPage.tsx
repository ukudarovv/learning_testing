import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { useMyEnrollments } from '../hooks/useMyEnrollments';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Award, FileQuestion, Video, Eye, X, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { TestAttempt } from '../types/lms';
import { examsService } from '../services/exams';

function getCategoryName(category: any, t: any): string {
  if (typeof category === 'object' && category !== null) {
    return category.name || category.name_kz || category.name_en || '—';
  }
  const names: Record<string, string> = {
    'industrial_safety': t('lms.student.historyPage.categories.industrial_safety'),
    'fire_safety': t('lms.student.historyPage.categories.fire_safety'),
    'electrical_safety': t('lms.student.historyPage.categories.electrical_safety'),
    'labor_protection': t('lms.student.historyPage.categories.labor_protection'),
    'professions': t('lms.student.historyPage.categories.professions'),
  };
  return names[category] || category || '—';
}

export function StudentHistoryPage() {
  const { t } = useTranslation();
  const { courses, loading, error } = useMyEnrollments();
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<TestAttempt | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'courses' | 'tests'>('courses');

  const completedCourses = Array.isArray(courses) ? courses.filter(c => c.status === 'completed' || c.status === 'exam_passed') : [];

  useEffect(() => {
    const fetchTestAttempts = async () => {
      try {
        setLoadingAttempts(true);
        const attempts = await examsService.getMyAttempts();
        // Фильтруем только завершенные попытки
        const completed = attempts.filter(attempt => {
          const completedAt = attempt.completed_at || attempt.completedAt;
          return completedAt && attempt.passed !== null && attempt.passed !== undefined;
        });
        setTestAttempts(completed);
      } catch (error) {
        console.error('Failed to fetch test attempts:', error);
        setTestAttempts([]);
      } finally {
        setLoadingAttempts(false);
      }
    };
    fetchTestAttempts();
  }, []);

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('lms.student.historyPage.loading')}</p>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('lms.student.historyPage.loadError')}</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link
              to="/student/dashboard"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('lms.student.historyPage.backToDashboardButton')}
            </Link>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              to="/student/dashboard"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
            >
              {t('lms.student.historyPage.backToDashboard')}
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('lms.student.historyPage.title')}</h1>
            <p className="text-gray-600">{t('lms.student.historyPage.subtitle')}</p>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex space-x-8">
              <button 
                onClick={() => setActiveTab('courses')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'courses'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('lms.student.historyPage.courses') || 'Курсы'}
              </button>
              <button 
                onClick={() => setActiveTab('tests')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'tests'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('lms.student.historyPage.tests') || 'Тесты'}
              </button>
            </div>
          </div>

          {/* Completed Courses */}
          {activeTab === 'courses' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('lms.student.historyPage.completedCourses') || 'Завершенные курсы'}</h2>
            {completedCourses.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {completedCourses.map(course => (
                  <div key={course.id} className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-green-500">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full mb-2">
                            {getCategoryName(course.category, t)}
                          </span>
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{course.title}</h3>
                          <p className="text-sm text-gray-600 mb-4">{course.duration} {t('lms.student.coursesPage.hours')}</p>
                          <div className="flex items-center text-sm text-green-600 mb-4">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            <span>{t('lms.student.historyPage.courseCompleted')}</span>
                          </div>
                          {course.progress === 100 && (
                            <div className="flex items-center text-sm text-purple-600 mb-4">
                              <Award className="w-4 h-4 mr-1" />
                              <span>{t('lms.student.historyPage.progress100')}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          to={`/student/course/${course.id}`}
                          className="flex-1 text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                          {t('lms.student.historyPage.viewCourse')}
                        </Link>
                        <Link
                          to="/student/documents"
                          className="flex-1 text-center px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors"
                        >
                          {t('lms.student.historyPage.certificates')}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('lms.student.historyPage.noHistory')}</h3>
                <p className="text-gray-600 mb-4">{t('lms.student.historyPage.noHistoryDesc')}</p>
                <Link
                  to="/student/courses"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('lms.student.historyPage.goToCourses')}
                </Link>
              </div>
            )}
          </div>
          )}

          {/* Test Attempts History */}
          {activeTab === 'tests' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('lms.student.historyPage.testHistory') || 'История тестов'}</h2>
            {loadingAttempts ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">{t('lms.student.historyPage.loadingTests') || 'Загрузка истории тестов...'}</p>
              </div>
            ) : testAttempts.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {testAttempts.map(attempt => {
                  const test = typeof attempt.test === 'object' ? attempt.test : null;
                  const completedAt = attempt.completed_at || attempt.completedAt;
                  const completedDate = completedAt ? new Date(completedAt) : null;
                  const hasVideo = !!(attempt.video_recording || attempt.videoRecording);
                  const videoUrl = attempt.video_recording || attempt.videoRecording;

                  return (
                    <div key={attempt.id} className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-orange-500">
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            {test?.category && (
                              <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full mb-2">
                                {getCategoryName(test.category, t)}
                              </span>
                            )}
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{test?.title || t('lms.student.historyPage.test')}</h3>
                            {completedDate && (
                              <div className="flex items-center text-sm text-gray-600 mb-2">
                                <Calendar className="w-4 h-4 mr-1" />
                                <span>{formatDate(completedDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Test Result */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">{t('lms.student.historyPage.result') || 'Результат'}</span>
                            <span className={`text-sm font-semibold ${attempt.passed ? 'text-green-600' : 'text-red-600'}`}>
                              {attempt.score !== null && attempt.score !== undefined ? `${attempt.score.toFixed(1)}%` : '—'}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${attempt.passed ? 'bg-green-600' : 'bg-red-600'}`}
                              style={{ width: `${Math.min(attempt.score || 0, 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center mt-2">
                            {attempt.passed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3" />
                                {t('lms.student.historyPage.passed') || 'Пройдено'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <X className="w-3 h-3" />
                                {t('lms.student.historyPage.failed') || 'Не пройдено'}
                              </span>
                            )}
                            {hasVideo && (
                              <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Video className="w-3 h-3" />
                                {t('lms.student.historyPage.hasVideo') || 'Есть видео'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {test && (
                            <Link
                              to={`/student/test/${test.id}`}
                              state={{ attemptId: attempt.id, viewResults: true }}
                              className="flex-1 text-center px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
                            >
                              {t('lms.student.historyPage.viewDetails') || 'Детали'}
                            </Link>
                          )}
                          {hasVideo && videoUrl && (
                            <button
                              onClick={() => {
                                setSelectedAttempt(attempt);
                                setShowVideoModal(true);
                              }}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              {t('lms.student.historyPage.viewVideo') || 'Видео'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <FileQuestion className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('lms.student.historyPage.noTestHistory') || 'Нет истории тестов'}</h3>
                <p className="text-gray-600 mb-4">{t('lms.student.historyPage.noTestHistoryDesc') || 'У вас пока нет пройденных тестов'}</p>
                <Link
                  to="/student/tests"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('lms.student.historyPage.goToTests') || 'Перейти к тестам'}
                </Link>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Video Modal */}
      {showVideoModal && selectedAttempt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {t('lms.student.historyPage.videoRecording') || 'Видеозапись теста'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {typeof selectedAttempt.test === 'object' ? selectedAttempt.test?.title : t('lms.student.historyPage.test')}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowVideoModal(false);
                  setSelectedAttempt(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {selectedAttempt.video_recording || selectedAttempt.videoRecording ? (
                <div className="space-y-4">
                  <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      src={selectedAttempt.video_recording || selectedAttempt.videoRecording || ''}
                      controls
                      className="w-full h-full"
                      style={{ maxHeight: '600px' }}
                    >
                      {t('lms.student.historyPage.videoNotSupported') || 'Ваш браузер не поддерживает воспроизведение видео.'}
                    </video>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{t('lms.student.historyPage.score') || 'Балл'}:</span>{' '}
                      {selectedAttempt.score !== null && selectedAttempt.score !== undefined 
                        ? `${selectedAttempt.score.toFixed(1)}%`
                        : '—'}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{t('lms.student.historyPage.result') || 'Результат'}:</span>{' '}
                      {selectedAttempt.passed !== null && selectedAttempt.passed !== undefined
                        ? (selectedAttempt.passed 
                            ? t('lms.student.historyPage.passed') || 'Пройдено'
                            : t('lms.student.historyPage.failed') || 'Не пройдено')
                        : '—'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">{t('lms.student.historyPage.videoNotAvailable') || 'Видеозапись недоступна'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </>
  );
}

function formatDate(date: Date): string {
  try {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

