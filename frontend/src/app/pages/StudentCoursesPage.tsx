import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { useMyEnrollments } from '../hooks/useMyEnrollments';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Play, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function getCategoryName(category: any, t: any): string {
  if (typeof category === 'object' && category !== null) {
    return category.name || category.name_kz || category.name_en || '—';
  }
  const names: Record<string, string> = {
    'industrial_safety': t('lms.student.coursesPage.categories.industrial_safety'),
    'fire_safety': t('lms.student.coursesPage.categories.fire_safety'),
    'electrical_safety': t('lms.student.coursesPage.categories.electrical_safety'),
    'labor_protection': t('lms.student.coursesPage.categories.labor_protection'),
    'professions': t('lms.student.coursesPage.categories.professions'),
  };
  return names[category] || category || '—';
}

function getStatusText(status: string, t: any): string {
  const statusMap: Record<string, string> = {
    'assigned': t('lms.student.status.assigned'),
    'in_progress': t('lms.student.status.inProgress'),
    'exam_available': t('lms.student.status.examAvailable'),
    'pending_pdek': t('lms.student.status.pendingPdek'),
    'completed': t('lms.student.status.completed'),
    'exam_passed': t('lms.student.status.examPassed'),
    'exam_failed': t('lms.student.status.failed'),
  };
  return statusMap[status] || status;
}

export function StudentCoursesPage() {
  const { t } = useTranslation();
  const { courses, loading, error } = useMyEnrollments();

  const activeCourses = Array.isArray(courses) ? courses.filter(c => 
    c.status === 'in_progress' || 
    c.status === 'exam_available' || 
    c.status === 'assigned' || 
    c.status === 'pending_pdek' ||
    c.status === 'exam_passed'
  ) : [];
  const completedCourses = Array.isArray(courses) ? courses.filter(c => c.status === 'completed') : [];

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('lms.student.coursesPage.loading')}</p>
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
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('lms.student.coursesPage.loadError')}</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link
              to="/student/dashboard"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('lms.student.coursesPage.backToDashboardButton')}
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
              {t('lms.student.coursesPage.backToDashboard')}
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('lms.student.coursesPage.title')}</h1>
            <p className="text-gray-600">{t('lms.student.coursesPage.subtitle')}</p>
          </div>

          {/* Active Courses */}
          {activeCourses.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('lms.student.coursesPage.activeCoursesTitle')}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeCourses.map(course => (
                  <div key={course.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full mb-2">
                            {getCategoryName(course.category, t)}
                          </span>
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{course.title}</h3>
                          <p className="text-sm text-gray-600 mb-2">{course.duration} {t('lms.student.coursesPage.hours')}</p>
                          <div className="flex items-center text-sm text-gray-600 mb-4">
                            <Clock className="w-4 h-4 mr-1" />
                            <span>{getStatusText(course.status || '', t)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">{t('lms.student.progress')}</span>
                          <span className="text-sm font-semibold text-gray-900">{course.progress || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${course.progress || 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Button */}
                      <Link
                        to={`/student/course/${course.id}`}
                        className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        {course.status === 'exam_available' 
                          ? t('lms.student.coursesPage.goToExam')
                          : course.status === 'pending_pdek'
                          ? t('lms.student.coursesPage.viewStatus')
                          : t('lms.student.coursesPage.continueLearning')}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Courses */}
          {completedCourses.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('lms.student.coursesPage.completedCoursesTitle')}</h2>
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
                          <p className="text-sm text-gray-600 mb-2">{course.duration} {t('lms.student.coursesPage.hours')}</p>
                          <div className="flex items-center text-sm text-green-600 mb-4">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            <span>{t('lms.student.status.completed')}</span>
                          </div>
                        </div>
                      </div>

                      <Link
                        to={`/student/course/${course.id}`}
                        className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                      >
                        {t('lms.student.coursesPage.viewCourse')}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {activeCourses.length === 0 && completedCourses.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow-md">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('lms.student.coursesPage.noCourses')}</h3>
              <p className="text-gray-600 mb-4">{t('lms.student.coursesPage.noCoursesDesc')}</p>
              <Link
                to="/student/dashboard"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('lms.student.coursesPage.backToDashboardButton')}
              </Link>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

