import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, BookOpen, FileQuestion, MessageSquare, Calendar, RefreshCw, X, AlertCircle, Eye } from 'lucide-react';
import { CourseEnrollmentRequest, TestEnrollmentRequest } from '../../types/lms';
import { coursesService } from '../../services/courses';
import { testsService } from '../../services/tests';
import { toast } from 'sonner';
import { ApiError } from '../../services/api';
import { useTranslation } from 'react-i18next';

export function EnrollmentRequests() {
  const { t } = useTranslation();
  const [courseRequests, setCourseRequests] = useState<CourseEnrollmentRequest[]>([]);
  const [testRequests, setTestRequests] = useState<TestEnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'courses' | 'tests'>('all');
  const [selectedRequest, setSelectedRequest] = useState<RequestWithType | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching enrollment requests...');
      const [courseData, testData] = await Promise.all([
        coursesService.getEnrollmentRequests(),
        testsService.getEnrollmentRequests()
      ]);
      console.log('Course requests received:', courseData);
      console.log('Test requests received:', testData);
      // Ensure data is an array
      const safeCourseData = Array.isArray(courseData) ? courseData : [];
      const safeTestData = Array.isArray(testData) ? testData : [];
      console.log('Safe course data:', safeCourseData);
      console.log('Safe test data:', safeTestData);
      setCourseRequests(safeCourseData);
      setTestRequests(safeTestData);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ошибка загрузки запросов';
      setError(message);
      console.error('Failed to fetch enrollment requests:', err);
      if (err instanceof ApiError) {
        console.error('API Error status:', err.status);
        console.error('API Error data:', err.data);
      }
      setCourseRequests([]);
      setTestRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  type RequestWithType = (CourseEnrollmentRequest & { type: 'course' }) | (TestEnrollmentRequest & { type: 'test' });
  
  // Ensure courseRequests and testRequests are arrays before mapping
  const safeCourseRequests = Array.isArray(courseRequests) ? courseRequests : [];
  const safeTestRequests = Array.isArray(testRequests) ? testRequests : [];
  
  const allRequests: RequestWithType[] = [
    ...safeCourseRequests.map(r => ({ ...r, type: 'course' as const })),
    ...safeTestRequests.map(r => ({ ...r, type: 'test' as const }))
  ];

  const filteredRequests = allRequests.filter(r => {
    const statusMatch = statusFilter === 'all' || r.status === statusFilter;
    const typeMatch = typeFilter === 'all' || 
      (typeFilter === 'courses' && r.type === 'course') ||
      (typeFilter === 'tests' && r.type === 'test');
    return statusMatch && typeMatch;
  });

  const handleApprove = async (request: CourseEnrollmentRequest | TestEnrollmentRequest) => {
    try {
      setProcessing(true);
      if (request.type === 'course') {
        await coursesService.approveEnrollmentRequest(request.id);
      } else {
        await testsService.approveEnrollmentRequest(request.id);
      }
      toast.success('Запрос одобрен');
      await fetchRequests();
      setSelectedRequest(null);
    } catch (err: any) {
      toast.error(err.message || 'Ошибка при одобрении запроса');
      console.error('Failed to approve request:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    try {
      setProcessing(true);
      if (selectedRequest.type === 'course') {
        await coursesService.rejectEnrollmentRequest(selectedRequest.id, rejectReason.trim() || 'Запрос отклонен администратором');
      } else {
        await testsService.rejectEnrollmentRequest(selectedRequest.id, rejectReason.trim() || 'Запрос отклонен администратором');
      }
      toast.success('Запрос отклонен');
      await fetchRequests();
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка при отклонении запроса');
      console.error('Failed to reject request:', err);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusText = (status: string) => {
    const texts = {
      pending: 'На рассмотрении',
      approved: 'Одобрен',
      rejected: 'Отклонен',
    };
    return texts[status as keyof typeof texts] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка запросов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">Ошибка загрузки запросов: {error}</p>
        <button
          onClick={fetchRequests}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Запросы на запись</h2>
          <p className="text-gray-600 mt-1">Управление запросами студентов на запись на курсы и тесты</p>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Всего запросов</p>
              <p className="text-2xl font-bold text-gray-900">{allRequests.length}</p>
            </div>
            <FileQuestion className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">На рассмотрении</p>
              <p className="text-2xl font-bold text-yellow-600">
                {allRequests.filter(r => r.status === 'pending').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Одобрено</p>
              <p className="text-2xl font-bold text-green-600">
                {allRequests.filter(r => r.status === 'approved').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Отклонено</p>
              <p className="text-2xl font-bold text-red-600">
                {allRequests.filter(r => r.status === 'rejected').length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Тип:</span>
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setTypeFilter('courses')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === 'courses'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Курсы
            </button>
            <button
              onClick={() => setTypeFilter('tests')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === 'tests'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Тесты
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Статус:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              На рассмотрении
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Одобрено
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'rejected'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Отклонено
            </button>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <FileQuestion className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Запросы не найдены</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredRequests.map((request) => {
              const isCourse = request.type === 'course';
              const title = isCourse 
                ? (typeof request.course === 'object' ? request.course?.title : 'Курс')
                : (typeof request.test === 'object' ? request.test?.title : 'Тест');
              const userName = typeof request.user === 'object' 
                ? (request.user?.full_name || request.user?.fullName || request.user?.phone || 'Студент')
                : 'Студент';
              const userPhone = typeof request.user === 'object' ? request.user?.phone : '';
              
              return (
                <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`px-3 py-1 rounded-full border text-sm font-medium flex items-center gap-1 ${getStatusBadge(request.status)}`}>
                          {getStatusIcon(request.status)}
                          {getStatusText(request.status)}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          {isCourse ? <BookOpen className="w-4 h-4" /> : <FileQuestion className="w-4 h-4" />}
                          {isCourse ? 'Курс' : 'Тест'}
                        </div>
                        <div className="text-sm text-gray-500">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {new Date(request.created_at || request.createdAt || '').toLocaleString('ru-RU')}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-start gap-2">
                          <User className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{userName}</p>
                            {userPhone && <p className="text-xs text-gray-500">{userPhone}</p>}
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          {isCourse ? (
                            <BookOpen className="w-5 h-5 text-gray-400 mt-0.5" />
                          ) : (
                            <FileQuestion className="w-5 h-5 text-gray-400 mt-0.5" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{title}</p>
                          </div>
                        </div>
                      </div>

                      {request.admin_response || request.adminResponse ? (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Ответ администратора:</p>
                              <p className="text-sm text-gray-900">{request.admin_response || request.adminResponse}</p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {request.processed_by && (
                        <div className="mt-2 text-xs text-gray-500">
                          Обработано: {typeof request.processed_by === 'object' 
                            ? (request.processed_by.full_name || request.processed_by.fullName || request.processed_by.phone)
                            : 'Администратор'} 
                          {request.processed_at || request.processedAt 
                            ? ` (${new Date(request.processed_at || request.processedAt).toLocaleString('ru-RU')})`
                            : ''}
                        </div>
                      )}
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleApprove(request)}
                          disabled={processing}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Одобрить
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRejectModal(true);
                          }}
                          disabled={processing}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Отклонить запрос</h3>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedRequest(null);
                    setRejectReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Укажите причину отклонения запроса (необязательно):
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Причина отклонения..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
              />
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedRequest(null);
                    setRejectReason('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Отклонить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
