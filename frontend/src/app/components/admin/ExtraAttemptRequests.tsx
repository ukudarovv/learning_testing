import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, FileQuestion, MessageSquare, Calendar, RefreshCw, X, AlertCircle, Eye } from 'lucide-react';
import { ExtraAttemptRequest } from '../../types/lms';
import { examsService } from '../../services/exams';
import { toast } from 'sonner';
import { ApiError } from '../../services/api';
import { useTranslation } from 'react-i18next';

export function ExtraAttemptRequests() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<ExtraAttemptRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<ExtraAttemptRequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const allRequests = await examsService.getExtraAttemptRequests();
      setRequests(allRequests);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ошибка загрузки запросов';
      setError(message);
      console.error('Failed to fetch extra attempt requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter);

  const handleApprove = async (request: ExtraAttemptRequest) => {
    try {
      setProcessing(true);
      await examsService.approveExtraAttemptRequest(request.id);
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
      await examsService.rejectExtraAttemptRequest(selectedRequest.id, rejectReason.trim() || 'Запрос отклонен администратором');
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

  const getAttemptsCount = (request: ExtraAttemptRequest): number => {
    return request.attempts_count || request.attemptsCount || 0;
  };

  const getMaxAttempts = (request: ExtraAttemptRequest): number => {
    return request.max_attempts || request.maxAttempts || 0;
  };

  const getApprovedExtraAttempts = (request: ExtraAttemptRequest): number => {
    return request.approved_extra_attempts || request.approvedExtraAttempts || 0;
  };

  const getLimitReached = (request: ExtraAttemptRequest): boolean => {
    if (request.limit_reached !== undefined) return request.limit_reached;
    if (request.limitReached !== undefined) return request.limitReached;
    const attemptsCount = getAttemptsCount(request);
    const maxAttempts = getMaxAttempts(request);
    const approvedExtra = getApprovedExtraAttempts(request);
    return attemptsCount >= (maxAttempts + approvedExtra);
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
          <h2 className="text-2xl font-bold text-gray-900">Запросы на дополнительные попытки</h2>
          <p className="text-gray-600 mt-1">Управление запросами студентов на дополнительные попытки прохождения тестов</p>
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
              <p className="text-2xl font-bold text-gray-900">{requests.length}</p>
            </div>
            <FileQuestion className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">На рассмотрении</p>
              <p className="text-2xl font-bold text-yellow-600">
                {requests.filter(r => r.status === 'pending').length}
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
                {requests.filter(r => r.status === 'approved').length}
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
                {requests.filter(r => r.status === 'rejected').length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Фильтр по статусу:</span>
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
              const testTitle = typeof request.test === 'object' ? request.test?.title : 'Тест';
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
                        <div className="text-sm text-gray-500">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {new Date(request.created_at || request.createdAt || '').toLocaleString('ru-RU')}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-start gap-2">
                          <User className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Студент</p>
                            <p className="font-medium text-gray-900">{userName}</p>
                            {userPhone && (
                              <p className="text-sm text-gray-600">{userPhone}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <FileQuestion className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Тест</p>
                            <p className="font-medium text-gray-900">{testTitle}</p>
                          </div>
                        </div>
                      </div>

                      {/* Statistics */}
                      <div className="mb-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">Статистика попыток</p>
                          {getLimitReached(request) && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              <AlertCircle className="w-3 h-3" />
                              {t('admin.extraAttempts.limitReached') || 'Лимит исчерпан'}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Использовано попыток</p>
                            <p className={`text-lg font-bold ${
                              getLimitReached(request) ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {getAttemptsCount(request)} / {getMaxAttempts(request) + getApprovedExtraAttempts(request)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Лимит теста</p>
                            <p className="text-lg font-bold text-gray-900">
                              {getMaxAttempts(request)}
                              {getApprovedExtraAttempts(request) > 0 && (
                                <span className="text-sm text-green-600 ml-1">
                                  (+{getApprovedExtraAttempts(request)} доп.)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-500 mb-1">Причина запроса</p>
                            <p className="text-gray-900 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{request.reason}</p>
                          </div>
                        </div>
                      </div>

                      {request.admin_response && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-1">Ответ администратора</p>
                          <p className="text-gray-900 bg-blue-50 p-3 rounded-lg whitespace-pre-wrap">{request.admin_response}</p>
                        </div>
                      )}

                      {request.processed_by && request.processed_at && (
                        <div className="text-xs text-gray-500">
                          Обработано: {typeof request.processed_by === 'object' ? (request.processed_by.full_name || request.processed_by.phone) : 'Администратором'} • {' '}
                          {new Date(request.processed_at).toLocaleString('ru-RU')}
                        </div>
                      )}
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleApprove(request)}
                          disabled={processing}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Отклонить запрос</h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectReason('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Причина отклонения (необязательно)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Укажите причину отклонения запроса..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectReason('');
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Отклонение...' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

