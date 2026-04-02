import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { useTests } from '../hooks/useTests';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function StudentTestsPage() {
  const { t } = useTranslation();
  const { tests, loading, error } = useTests({ is_active: true });

  const availableTests = Array.isArray(tests) ? tests.filter(t => t.status === 'available') : [];

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('lms.student.testsPage.loading')}</p>
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
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('lms.student.testsPage.loadError')}</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link
              to="/student/dashboard"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('lms.student.testsPage.backToDashboardButton')}
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
              {t('lms.student.testsPage.backToDashboard')}
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('lms.student.testsPage.title')}</h1>
            <p className="text-gray-600">{t('lms.student.testsPage.subtitle')}</p>
          </div>

          {/* Tests List */}
          {availableTests.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {availableTests.map(test => (
                <div key={test.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{test.title}</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                      <span className="text-gray-600">{t('lms.student.testsPage.questions')}:</span>
                      <span className="ml-2 font-semibold text-gray-900">{test.questionsCount || 0}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 text-gray-600 mr-1" />
                      <span className="text-gray-600">{t('lms.student.testsPage.time')}:</span>
                      <span className="ml-2 font-semibold text-gray-900">{test.timeLimit || test.time_limit || 30} {t('lms.student.testsPage.minutes')}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('lms.student.testsPage.passingScore')}:</span>
                      <span className="ml-2 font-semibold text-gray-900">{test.passingScore || test.passing_score || 80}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('lms.student.testsPage.attempts')}:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {(test.attemptsTotal || test.attempts_total || 3) - (test.attemptsUsed || test.attempts_used || 0)} {t('lms.student.testsPage.attemptsRemaining')} {test.attemptsTotal || test.attempts_total || 3}
                      </span>
                    </div>
                  </div>

                  {test.description && (
                    <p className="text-sm text-gray-600 mb-6">{test.description}</p>
                  )}

                  <Link
                    to={`/student/test/${test.id}`}
                    className="block w-full text-center px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center justify-center"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {t('lms.student.testsPage.startTesting')}
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-md">
              <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('lms.student.testsPage.noTests')}</h3>
              <p className="text-gray-600 mb-4">{t('lms.student.testsPage.noTestsDesc')}</p>
              <Link
                to="/student/dashboard"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('lms.student.testsPage.backToDashboardButton')}
              </Link>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

