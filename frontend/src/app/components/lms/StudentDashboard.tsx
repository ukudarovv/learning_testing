import { BookOpen, Award, FileText, TrendingUp, CheckCircle2, AlertCircle, Play, Clock, FileQuestion, Edit2, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMyEnrollments } from '../../hooks/useMyEnrollments';
import { useNotifications } from '../../hooks/useNotifications';
import { useEnrollmentRequests } from '../../hooks/useEnrollmentRequests';
import { certificatesService } from '../../services/certificates';
import { examsService } from '../../services/exams';
import { protocolsService } from '../../services/protocols';
import { testsService } from '../../services/tests';
import { useState, useEffect } from 'react';
import { Certificate, TestAttempt, Protocol, TestAssignment } from '../../types/lms';
import { useUser } from '../../contexts/UserContext';
import { ProfileEditor } from './ProfileEditor';
import { toast } from 'sonner';

export function StudentDashboard() {
  const { t } = useTranslation();
  const { user } = useUser();
  const navigate = useNavigate();
  const { courses, loading: coursesLoading } = useMyEnrollments();
  const { notifications, loading: notificationsLoading } = useNotifications({ read: false });
  const { courseRequests, testRequests, loading: requestsLoading } = useEnrollmentRequests();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certificatesLoading, setCertificatesLoading] = useState(true);
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [testAssignments, setTestAssignments] = useState<TestAssignment[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const data = await certificatesService.getCertificates();
        setCertificates(data);
      } catch (error) {
        console.error('Failed to fetch certificates:', error);
      } finally {
        setCertificatesLoading(false);
      }
    };
    fetchCertificates();
  }, []);

  useEffect(() => {
    const fetchTestData = async () => {
      try {
        setLoadingTests(true);
        const [attemptsData, protocolsData, assignmentsData] = await Promise.all([
          examsService.getMyAttempts(),
          protocolsService.getProtocols(),
          testsService.getMyTestAssignments().catch((err) => {
            console.error('Failed to fetch test assignments:', err);
            return [];
          })
        ]);
        setTestAttempts(attemptsData);
        setProtocols(protocolsData);
        console.log('Test assignments loaded:', assignmentsData);
        const assignedTests = assignmentsData.filter(a => a.status === 'assigned');
        console.log('Filtered assigned tests:', assignedTests);
        setTestAssignments(assignedTests);
      } catch (error) {
        console.error('Failed to fetch test attempts and protocols:', error);
        setTestAttempts([]);
        setProtocols([]);
        setTestAssignments([]);
      } finally {
        setLoadingTests(false);
      }
    };
    fetchTestData();
  }, []);

  const activeCourses = Array.isArray(courses) ? courses.filter(c => 
    c.status === 'in_progress' || 
    c.status === 'exam_available' || 
    c.status === 'assigned' || 
    c.status === 'pending_pdek' ||
    c.status === 'exam_passed'
  ) : [];
  const completedCourses = Array.isArray(courses) ? courses.filter(c => c.status === 'completed') : [];
  // Защита от случаев, когда notifications не является массивом
  const unreadNotifications = Array.isArray(notifications) ? notifications.filter(n => !n.read) : [];

  // Фильтруем пройденные standalone тесты (тесты, не используемые в курсах)
  const completedStandaloneTests = Array.isArray(testAttempts) ? testAttempts.filter(attempt => {
    // Проверяем, что test является объектом (не строкой)
    if (!attempt.test || typeof attempt.test === 'string') {
      return false;
    }
    
    // Проверяем, что тест НЕ используется в курсах (является автономным)
    const isStandalone = attempt.test.is_standalone || attempt.test.isStandalone;
    if (isStandalone) {
      return false; // Пропускаем тесты, используемые в курсах
    }
    
    // Проверяем, что тест пройден
    if (!attempt.passed) {
      return false;
    }
    
    // Проверяем, что тест завершен
    const completedAt = attempt.completed_at || attempt.completedAt;
    if (!completedAt) {
      return false;
    }
    
    return true;
  }) : [];

  // Связываем попытки с протоколами по attemptId
  const testsWithProtocols = completedStandaloneTests.map(attempt => {
    const attemptId = String(attempt.id);
    const protocol = protocols.find(p => p.attemptId === attemptId);
    return {
      attempt,
      protocol
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('lms.student.dashboard')}</h1>
              <p className="text-gray-600">{t('lms.student.dashboardWelcome')}</p>
            </div>
            {user && (
              <button
                onClick={() => setShowProfileEditor(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                <User className="w-4 h-4" />
                <Edit2 className="w-4 h-4" />
                <span>{t('lms.student.profile.edit') || 'Редактировать профиль'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-blue-600">{activeCourses.length}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">{t('lms.student.activeCourses')}</h3>
            <Link to="/student/courses" className="text-xs text-blue-600 hover:text-blue-700">
              {t('lms.student.goToCourses')}
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-green-600">{completedCourses.length}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">{t('lms.student.completedCourses')}</h3>
            <Link to="/student/history" className="text-xs text-green-600 hover:text-green-700">
              {t('lms.student.viewHistory')}
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-2xl font-bold text-purple-600">{certificates.length}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">{t('lms.student.certificates')}</h3>
            <Link to="/student/documents" className="text-xs text-purple-600 hover:text-purple-700">
              {t('lms.student.viewDocuments')}
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FileQuestion className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-2xl font-bold text-orange-600">{completedStandaloneTests.length}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">{t('lms.student.completedStandaloneTests') || 'Пройденные тесты'}</h3>
            <a href="#completed-tests" className="text-xs text-orange-600 hover:text-orange-700">
              {t('lms.student.viewTests') || 'Просмотреть тесты'}
            </a>
          </div>
        </div>

        {/* Notifications */}
        {unreadNotifications.length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-8">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  {t('lms.student.unreadNotifications', { count: unreadNotifications.length })}
                </h3>
                <div className="space-y-2">
                  {unreadNotifications.slice(0, 3).map(notif => (
                    <div key={notif.id} className="text-sm text-blue-800">
                      <span className="font-medium">{notif.title}:</span> {notif.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enrollment Requests */}
        {(courseRequests.length > 0 || testRequests.length > 0 || testAssignments.length > 0) && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('lms.student.enrollmentRequests') || 'Мои запросы на запись'}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {courseRequests.map(request => {
                const courseTitle = typeof request.course === 'object' ? request.course?.title : 'Курс';
                const courseId = typeof request.course === 'object' ? request.course?.id : request.courseId;
                const isApproved = request.status === 'approved';
                const isClickable = isApproved && courseId;
                
                const cardContent = (
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-gray-500">Курс</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{courseTitle}</h3>
                      <div className="mt-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          request.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                            : request.status === 'approved'
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {request.status === 'pending' 
                            ? (t('lms.student.requestStatus.pending') || 'Ожидает подтверждения')
                            : request.status === 'approved'
                            ? (t('lms.student.requestStatus.approved') || 'Одобрен')
                            : (t('lms.student.requestStatus.rejected') || 'Отклонен')}
                        </span>
                      </div>
                      {request.admin_response || request.adminResponse ? (
                        <p className="mt-2 text-sm text-gray-600">
                          {request.admin_response || request.adminResponse}
                        </p>
                      ) : null}
                      {isApproved && courseId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/student/course/${courseId}`);
                          }}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          {t('lms.student.goToCourse') || 'Перейти к курсу'}
                        </button>
                      )}
                    </div>
                  </div>
                );
                
                return (
                  <div 
                    key={request.id} 
                    className={`bg-white rounded-lg shadow-md p-6 ${isClickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
                    onClick={isClickable ? () => navigate(`/student/course/${courseId}`) : undefined}
                  >
                    {cardContent}
                  </div>
                );
              })}
              {testRequests.map(request => {
                const testTitle = typeof request.test === 'object' ? request.test?.title : 'Тест';
                const testId = typeof request.test === 'object' ? request.test?.id : request.testId;
                const isApproved = request.status === 'approved';
                const isClickable = isApproved && testId;
                
                const cardContent = (
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileQuestion className="w-5 h-5 text-orange-600" />
                        <span className="text-sm text-gray-500">Тест</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{testTitle}</h3>
                      <div className="mt-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          request.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                            : request.status === 'approved'
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {request.status === 'pending' 
                            ? (t('lms.student.requestStatus.pending') || 'Ожидает подтверждения')
                            : request.status === 'approved'
                            ? (t('lms.student.requestStatus.approved') || 'Одобрен')
                            : (t('lms.student.requestStatus.rejected') || 'Отклонен')}
                        </span>
                      </div>
                      {request.admin_response || request.adminResponse ? (
                        <p className="mt-2 text-sm text-gray-600">
                          {request.admin_response || request.adminResponse}
                        </p>
                      ) : null}
                      {isApproved && testId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/student/test/${testId}`);
                          }}
                          className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                        >
                          {t('lms.student.goToTest') || 'Перейти к тесту'}
                        </button>
                      )}
                    </div>
                  </div>
                );
                
                return (
                  <div 
                    key={request.id} 
                    className={`bg-white rounded-lg shadow-md p-6 ${isClickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
                    onClick={isClickable ? () => navigate(`/student/test/${testId}`) : undefined}
                  >
                    {cardContent}
                  </div>
                );
              })}
              {testAssignments.map(assignment => {
                const testTitle = typeof assignment.test === 'object' ? assignment.test?.title : 'Тест';
                const testId = typeof assignment.test === 'object' ? assignment.test?.id : assignment.testId;
                const isClickable = testId && assignment.status === 'assigned';
                
                const cardContent = (
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileQuestion className="w-5 h-5 text-purple-600" />
                        <span className="text-sm text-gray-500">Тест</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{testTitle}</h3>
                      <div className="mt-3">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                          {t('admin.users.assignedByAdmin') || 'Назначено администратором'}
                        </span>
                      </div>
                      {isClickable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/student/test/${testId}`);
                          }}
                          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                        >
                          {t('lms.student.goToTest') || 'Перейти к тесту'}
                        </button>
                      )}
                    </div>
                  </div>
                );
                
                return (
                  <div 
                    key={assignment.id} 
                    className={`bg-white rounded-lg shadow-md p-6 ${isClickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
                    onClick={isClickable ? () => navigate(`/student/test/${testId}`) : undefined}
                  >
                    {cardContent}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Standalone Tests */}
        <div id="completed-tests" className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{t('lms.student.completedStandaloneTests') || 'Пройденные тесты'}</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {testsWithProtocols.length > 0 ? testsWithProtocols.map(({ attempt, protocol }) => {
                const test = attempt.test as any;
                const completedAt = attempt.completed_at || attempt.completedAt;
                const completedDate = completedAt ? new Date(completedAt) : null;
                
                return (
                  <div key={attempt.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          {test.category && (
                            <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full mb-2">
                              {getCategoryName(test.category, t)}
                            </span>
                          )}
                          <h3 className="text-lg font-bold text-gray-900">{test.title}</h3>
                          {completedDate && (
                            <p className="text-sm text-gray-600 mt-1">
                              {t('lms.student.testCompletedDate') || 'Дата прохождения'}: {formatDate(completedDate, t)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Test Result */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">{t('lms.student.testResult') || 'Результат'}</span>
                          <span className={`text-sm font-semibold ${attempt.passed ? 'text-green-600' : 'text-red-600'}`}>
                            {attempt.score ? `${attempt.score.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${attempt.passed ? 'bg-green-600' : 'bg-red-600'}`}
                            style={{ width: `${Math.min(attempt.score || 0, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Protocol Status */}
                      {protocol && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{t('lms.student.protocolStatus') || 'Статус протокола'}:</span>
                            <span className={`text-xs font-semibold ${getProtocolStatusColor(protocol.status)}`}>
                              {getProtocolStatusText(protocol.status, t)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="flex items-center justify-end">
                        <Link
                          to={`/student/test/${test.id}`}
                          state={{ attemptId: attempt.id, viewResults: true }}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                        >
                          {t('lms.student.viewTestDetails') || 'Просмотреть детали'}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="col-span-2 text-center py-8 bg-white rounded-lg shadow-md">
                  <FileQuestion className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">{t('lms.student.noCompletedStandaloneTests') || 'У вас пока нет пройденных тестов'}</p>
                </div>
              )}
          </div>
        </div>

        {/* Active Courses */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{t('lms.student.activeCourses')}</h2>
            <Link to="/student/courses" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              {t('lms.student.allCourses')} →
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activeCourses.length > 0 ? activeCourses.map(course => (
              <div key={course.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full mb-2">
                        {getCategoryName(course.category, t)}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">{course.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{course.duration} {t('lms.student.coursesPage.hours')}</p>
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

                  {/* Status and Action */}
                  <div className="flex items-center justify-between">
                    {course.status === 'exam_available' ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        <span className="text-sm font-medium">{t('lms.student.status.examAvailable')}</span>
                      </div>
                    ) : course.status === 'pending_pdek' ? (
                      <div className="flex items-center text-orange-600">
                        <Clock className="w-4 h-4 mr-1" />
                        <span className="text-sm font-medium">{t('lms.student.status.pendingPdek')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-blue-600">
                        <Play className="w-4 h-4 mr-1" />
                        <span className="text-sm font-medium">{t('lms.student.status.inProgress')}</span>
                      </div>
                    )}
                    <Link
                      to={`/student/course/${course.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      {course.status === 'exam_available' ? t('lms.student.viewCourse') : course.status === 'pending_pdek' ? t('common.view') : t('lms.student.continue')}
                    </Link>
                  </div>
                </div>
              </div>
            )) : (
              <div className="col-span-2 text-center py-8 bg-white rounded-lg shadow-md">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">{t('lms.student.noActiveCourses')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/student/documents"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <FileText className="w-8 h-8 text-purple-600 mb-3" />
            <h3 className="font-bold text-gray-900 mb-2">{t('lms.student.documents')}</h3>
            <p className="text-sm text-gray-600">{t('lms.student.documentsDesc')}</p>
          </Link>

          <Link
            to="/student/history"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <TrendingUp className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-bold text-gray-900 mb-2">{t('lms.student.history')}</h3>
            <p className="text-sm text-gray-600">{t('lms.student.historyDesc')}</p>
          </Link>

          <Link
            to="/student/support"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <AlertCircle className="w-8 h-8 text-green-600 mb-3" />
            <h3 className="font-bold text-gray-900 mb-2">{t('navigation.support')}</h3>
            <p className="text-sm text-gray-600">{t('lms.student.supportDesc')}</p>
          </Link>
        </div>
      </div>

      {/* Profile Editor Modal */}
      {showProfileEditor && user && (
        <ProfileEditor
          user={user}
          onSave={() => {
            setShowProfileEditor(false);
            toast.success(t('lms.student.profile.saveSuccess') || 'Профиль успешно обновлен');
          }}
          onCancel={() => setShowProfileEditor(false)}
        />
      )}
    </div>
  );
}

function getCategoryName(category: any, t: any): string {
  // Если category - объект, извлекаем название
  if (category && typeof category === 'object') {
    return category.name || category.name_kz || category.name_en || '—';
  }
  
  // Если category - строка, используем маппинг
  if (typeof category === 'string') {
    const names: Record<string, string> = {
      'industrial_safety': t('lms.student.coursesPage.categories.industrial_safety'),
      'fire_safety': t('lms.student.coursesPage.categories.fire_safety'),
      'electrical_safety': t('lms.student.coursesPage.categories.electrical_safety'),
      'labor_protection': t('lms.student.coursesPage.categories.labor_protection'),
      'professions': t('lms.student.coursesPage.categories.professions'),
    };
    return names[category] || category;
  }
  
  return '—';
}

function formatDate(date: Date, t: any): string {
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

function getProtocolStatusText(status: string, t: any): string {
  const statusMap: Record<string, string> = {
    'generated': t('lms.pdek.status.generated') || t('lms.certificate.status.created') || 'Создан',
    'pending_pdek': t('lms.pdek.status.pendingPdek') || t('lms.certificate.status.pendingPdek') || 'Ожидает ПДЭК',
    'signed_members': t('lms.pdek.status.signedMembers') || 'Подписан членами',
    'signed_chairman': t('lms.pdek.status.signedChairman') || 'Подписан председателем',
    'rejected': t('lms.pdek.status.rejected') || t('lms.certificate.status.rejected') || 'Отклонен',
    'annulled': t('lms.pdek.status.annulled') || t('lms.student.status.annulled') || 'Аннулирован',
  };
  return statusMap[status] || status;
}

function getProtocolStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'generated': 'text-gray-600',
    'pending_pdek': 'text-orange-600',
    'signed_members': 'text-blue-600',
    'signed_chairman': 'text-green-600',
    'rejected': 'text-red-600',
    'annulled': 'text-gray-400',
  };
  return colorMap[status] || 'text-gray-600';
}
