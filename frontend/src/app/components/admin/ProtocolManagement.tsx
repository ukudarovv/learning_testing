import { useState, useEffect } from 'react';
import { FileText, Eye, Search, Filter, Calendar, User, CheckCircle, XCircle, Clock, RefreshCw, Video, Monitor, ChevronDown, ChevronUp, X, Download, Upload } from 'lucide-react';
import { Protocol, TestAttempt } from '../../types/lms';
import { protocolsService } from '../../services/protocols';
import { examsService } from '../../services/exams';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function ProtocolManagement() {
  const { t } = useTranslation();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [testAttempt, setTestAttempt] = useState<TestAttempt | null>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [protocolForUpload, setProtocolForUpload] = useState<Protocol | null>(null);

  const fetchProtocols = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await protocolsService.getProtocols();
      setProtocols(data);
    } catch (err: any) {
      const message = err.message || 'Ошибка загрузки протоколов';
      setError(message);
      console.error('Failed to fetch protocols:', err);
      setProtocols([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProtocols();
  }, []);

  const filteredProtocols = protocols.filter(protocol => {
    // Поиск по номеру, имени студента, названию курса/теста
    const userName = protocol.userName || '';
    const courseName = protocol.courseName || protocol.testName || '';
    const number = protocol.number || '';
    const matchesSearch = !searchQuery || 
      userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      number.toLowerCase().includes(searchQuery.toLowerCase());

    // Фильтр по статусу
    const matchesStatus = statusFilter === 'all' || protocol.status === statusFilter;

    // Фильтр по результату
    const matchesResult = resultFilter === 'all' || 
      (resultFilter === 'passed' && protocol.result === 'passed') ||
      (resultFilter === 'failed' && protocol.result === 'failed');

    // Фильтр по дате
    let matchesDate = true;
    if (dateFilter !== 'all' && protocol.examDate) {
      const date = protocol.examDate instanceof Date ? protocol.examDate : new Date(protocol.examDate);
      const now = new Date();
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      switch (dateFilter) {
        case 'today':
          matchesDate = diffDays === 0;
          break;
        case 'week':
          matchesDate = diffDays <= 7;
          break;
        case 'month':
          matchesDate = diffDays <= 30;
          break;
      }
    }

    return matchesSearch && matchesStatus && matchesResult && matchesDate;
  });

  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '—';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'signed_chairman':
        return 'bg-green-100 text-green-800';
      case 'signed_members':
        return 'bg-blue-100 text-blue-800';
      case 'pending_pdek':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string): string => {
    const statusKeyMap: Record<string, string> = {
      'generated': 'admin.protocols.statusLabels.generated',
      'pending_pdek': 'admin.protocols.statusLabels.pendingPdek',
      'signed_members': 'admin.protocols.statusLabels.signedMembers',
      'signed_chairman': 'admin.protocols.statusLabels.signedChairman',
      'rejected': 'admin.protocols.statusLabels.rejected',
      'annulled': 'admin.protocols.statusLabels.rejected',
    };
    const key = statusKeyMap[status];
    return key ? t(key) : status;
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t('admin.protocols.loading') || 'Загрузка протоколов...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">{t('admin.protocols.error') || 'Ошибка'}</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchProtocols}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              {t('admin.protocols.retry') || 'Повторить'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('admin.protocols.title') || 'Протоколы'}</h2>
          <p className="text-gray-600 mt-1">{t('admin.protocols.subtitle') || 'Управление всеми протоколами экзаменов'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await protocolsService.exportProtocols();
                toast.success(t('admin.protocols.exportSuccess') || 'Экспорт выполнен');
              } catch (err: any) {
                toast.error(err.message || (t('admin.protocols.exportError') || 'Ошибка экспорта'));
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('admin.protocols.export') || 'Экспорт'}
          </button>
          <button
            onClick={fetchProtocols}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('admin.protocols.refresh') || 'Обновить'}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={t('admin.protocols.searchPlaceholder') || 'Поиск по номеру, студенту, курсу...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {t('admin.protocols.filters') || 'Фильтры'}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('admin.protocols.allStatuses') || 'Все статусы'}</option>
              <option value="generated">{t('admin.protocols.status.generated') || 'Создан'}</option>
              <option value="pending_pdek">{t('admin.protocols.status.pendingPdek') || 'Ожидает ЭК'}</option>
              <option value="signed_members">{t('admin.protocols.status.signedMembers') || 'Подписан членами'}</option>
              <option value="signed_chairman">{t('admin.protocols.status.signedChairman') || 'Подписан председателем'}</option>
              <option value="rejected">{t('admin.protocols.status.rejected') || 'Отклонен'}</option>
            </select>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as 'all' | 'passed' | 'failed')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('admin.protocols.allResults') || 'Все результаты'}</option>
              <option value="passed">{t('admin.protocols.passed') || 'Сдал'}</option>
              <option value="failed">{t('admin.protocols.failed') || 'Не сдал'}</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('admin.protocols.allDates') || 'Все даты'}</option>
              <option value="today">{t('admin.protocols.today') || 'Сегодня'}</option>
              <option value="week">{t('admin.protocols.week') || 'За неделю'}</option>
              <option value="month">{t('admin.protocols.month') || 'За месяц'}</option>
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.protocols.number') || 'Номер'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.protocols.student') || 'Студент'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.protocols.course') || 'Курс/Тест'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.protocols.examDate') || 'Дата экзамена'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.protocols.score') || 'Балл'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.protocols.result') || 'Результат'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.protocols.status') || 'Статус'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.protocols.file') || 'Файл'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.protocols.actions') || 'Действия'}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProtocols.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery || statusFilter !== 'all' || resultFilter !== 'all' || dateFilter !== 'all'
                      ? t('admin.protocols.noResults') || 'Протоколы не найдены'
                      : t('admin.protocols.noProtocols') || 'Нет протоколов'}
                  </td>
                </tr>
              ) : (
                filteredProtocols.map((protocol) => (
                  <tr key={protocol.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{protocol.number}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {protocol.userName && protocol.userName !== 'Не указано' ? protocol.userName : '—'}
                          </div>
                          {protocol.userIIN && protocol.userIIN !== 'Не указано' && (
                            <div className="text-xs text-gray-500">ИИН: {protocol.userIIN}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {protocol.courseName && protocol.courseName !== 'Не указано' 
                          ? protocol.courseName 
                          : (protocol.testName && protocol.testName !== 'Не указано' 
                              ? protocol.testName 
                              : '—')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-2" />
                        {formatDate(protocol.examDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        protocol.result === 'passed' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {protocol.score?.toFixed(2) || '0.00'}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {protocol.result === 'passed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          {t('admin.protocols.passed') || 'Сдал'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          {t('admin.protocols.failed') || 'Не сдал'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(protocol.status)}`}>
                        {protocol.status === 'signed_chairman' && <CheckCircle className="w-3 h-3" />}
                        {protocol.status === 'pending_pdek' && <Clock className="w-3 h-3" />}
                        {getStatusText(protocol.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {protocolsService.getFileUrl(protocol) ? (
                          <>
                            <a
                              href={protocolsService.getFileUrl(protocol)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                            >
                              <FileText className="w-4 h-4" />
                              {t('admin.protocols.open') || 'Открыть'}
                            </a>
                            <a
                              href={protocolsService.getFileUrl(protocol)!}
                              download
                              className="text-blue-600 hover:text-blue-800"
                              title={t('admin.protocols.download') || 'Скачать'}
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">{t('admin.protocols.noFile') || 'Нет файла'}</span>
                        )}
                        <button
                          onClick={() => {
                            setProtocolForUpload(protocol);
                            setShowUploadModal(true);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          title={t('admin.protocols.uploadProtocol') || 'Загрузить протокол'}
                        >
                          <Upload className="w-4 h-4" />
                          {protocol.file ? (t('admin.protocols.replace') || 'Заменить') : (t('admin.protocols.upload') || 'Загрузить')}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={async () => {
                          try {
                            const fullProtocol = await protocolsService.getProtocol(protocol.id);
                            setSelectedProtocol(fullProtocol);
                            
                            const attemptId = fullProtocol.attemptId 
                              ? String(fullProtocol.attemptId) 
                              : (fullProtocol.attempt?.id ? String(fullProtocol.attempt.id) : null);
                            
                            if (attemptId) {
                              setLoadingAttempt(true);
                              try {
                                const attempt = await examsService.getTestAttempt(attemptId);
                                setTestAttempt(attempt);
                              } catch (error) {
                                console.error('Failed to load test attempt:', error);
                                setTestAttempt(null);
                              } finally {
                                setLoadingAttempt(false);
                              }
                            } else {
                              setTestAttempt(null);
                            }
                          } catch (error) {
                            console.error('Failed to load protocol details:', error);
                            toast.error(t('admin.protocols.loadError') || 'Ошибка загрузки протокола');
                            setSelectedProtocol(protocol);
                            setTestAttempt(null);
                          }
                        }}
                        className="text-gray-600 hover:text-gray-900"
                        title={t('admin.protocols.view') || 'Просмотр'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {t('admin.protocols.total') || 'Всего протоколов'}: <span className="font-semibold text-gray-900">{protocols.length}</span>
          </span>
          <span className="text-gray-600">
            {t('admin.protocols.filtered') || 'Отфильтровано'}: <span className="font-semibold text-gray-900">{filteredProtocols.length}</span>
          </span>
        </div>
      </div>

      {/* Protocol Details Modal */}
      {selectedProtocol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  {t('admin.protocols.protocolNumber', { number: selectedProtocol.number }) || `Протокол №${selectedProtocol.number}`}
                </h2>
                <button
                  onClick={() => {
                    setSelectedProtocol(null);
                    setTestAttempt(null);
                    setShowDetails(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Student Info */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">{t('admin.protocols.studentInfo') || 'Информация о студенте'}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{t('admin.protocols.fullName') || 'ФИО'}:</span>
                    <p className="font-medium">{selectedProtocol.userName && selectedProtocol.userName !== 'Не указано' ? selectedProtocol.userName : '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('admin.protocols.iin') || 'ИИН'}:</span>
                    <p className="font-medium">{selectedProtocol.userIIN && selectedProtocol.userIIN !== 'Не указано' ? selectedProtocol.userIIN : '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('admin.protocols.phone') || 'Телефон'}:</span>
                    <p className="font-medium">{selectedProtocol.userPhone && selectedProtocol.userPhone !== 'Не указано' ? selectedProtocol.userPhone : '—'}</p>
                  </div>
                </div>
              </div>

              {/* Exam Info */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">{t('admin.protocols.examInfo') || 'Информация об экзамене'}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{t('admin.protocols.course') || 'Курс/Тест'}:</span>
                    <p className="font-medium">
                      {selectedProtocol.courseName && selectedProtocol.courseName !== 'Не указано' 
                        ? selectedProtocol.courseName 
                        : (selectedProtocol.testName && selectedProtocol.testName !== 'Не указано' 
                            ? selectedProtocol.testName 
                            : '—')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('admin.protocols.examDate') || 'Дата экзамена'}:</span>
                    <p className="font-medium">
                      {selectedProtocol.examDate
                        ? formatDate(selectedProtocol.examDate)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('admin.protocols.score') || 'Балл'}:</span>
                    <p className="font-medium text-green-600">{Number(selectedProtocol.score || 0).toFixed(2)}%</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('admin.protocols.passingScore') || 'Проходной балл'}:</span>
                    <p className="font-medium">
                      {selectedProtocol.passingScore != null && selectedProtocol.passingScore !== undefined
                        ? `${selectedProtocol.passingScore}%`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('admin.protocols.result') || 'Результат'}:</span>
                    <p className={`font-medium ${selectedProtocol.result === 'passed' ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedProtocol.result === 'passed' ? (t('admin.protocols.passed') || 'Сдал') : 
                       selectedProtocol.result === 'failed' ? (t('admin.protocols.failed') || 'Не сдал') : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('admin.protocols.status') || 'Статус'}:</span>
                    <p className="font-medium">{getStatusText(selectedProtocol.status)}</p>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              {selectedProtocol.signatures && selectedProtocol.signatures.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">{t('admin.protocols.signatures') || 'Подписи ЭК'}</h3>
                  <div className="space-y-3">
                    {selectedProtocol.signatures.map((sig, index) => (
                      <div key={sig.userId || sig.id || `sig-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{sig.userName || '—'}</p>
                          <p className="text-sm text-gray-600">
                            {sig.role === 'chairman' 
                              ? (t('admin.protocols.chairmanRole') || 'Председатель ЭК')
                              : (t('admin.protocols.memberRole') || 'Член ЭК')}
                            {sig.signType === 'eds' && (
                              <span className="ml-2 text-emerald-600">(ЭЦП)</span>
                            )}
                          </p>
                          {sig.phone && (
                            <p className="text-xs text-gray-500 mt-1">{sig.phone}</p>
                          )}
                          {sig.signType === 'eds' && sig.edsCertificateInfo && (
                            <div className="mt-2 p-2 bg-white rounded border border-emerald-100 text-xs">
                              <p className="font-medium text-gray-700 mb-1">Сертификат:</p>
                              {sig.edsCertificateInfo.full_name && <p>{sig.edsCertificateInfo.full_name}</p>}
                              {sig.edsCertificateInfo.iin && <p>ИИН: {sig.edsCertificateInfo.iin}</p>}
                              {sig.edsCertificateInfo.serial_number && <p>Серийный №: {sig.edsCertificateInfo.serial_number}</p>}
                              {sig.edsCertificateInfo.issuer && <p>УЦ: {sig.edsCertificateInfo.issuer}</p>}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {sig.otpVerified && sig.signedAt ? (
                            <>
                              <CheckCircle className="w-6 h-6 text-green-600 ml-auto mb-1" />
                              <p className="text-xs text-gray-500">
                                {formatDate(sig.signedAt)}
                              </p>
                            </>
                          ) : (
                            <>
                              <Clock className="w-6 h-6 text-gray-400 ml-auto mb-1" />
                              <p className="text-xs text-gray-500">{t('admin.protocols.awaitingSignature') || 'Ожидает подписи'}</p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Attempt Details */}
              {loadingAttempt ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">{t('admin.protocols.loadingAttemptDetails') || 'Загрузка деталей попытки...'}</p>
                </div>
              ) : testAttempt && (
                <>
                  {/* Video Recording Section */}
                  {(testAttempt.video_recording || testAttempt.videoRecording) && (
                    <div className="mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Video className="w-5 h-5 text-blue-600" />
                          <h4 className="font-semibold text-gray-900">
                            {t('admin.protocols.videoRecording') || 'Видеозапись попытки'}
                          </h4>
                        </div>
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                          <video
                            src={testAttempt.video_recording || testAttempt.videoRecording || ''}
                            controls
                            className="w-full h-full"
                            style={{ maxHeight: '400px' }}
                          >
                            {t('admin.protocols.videoNotSupported') || 'Ваш браузер не поддерживает воспроизведение видео.'}
                          </video>
                        </div>
                      </div>
                    </div>
                  )}

                  {(testAttempt.screen_recording || testAttempt.screenRecording) && (
                    <div className="mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Monitor className="w-5 h-5 text-amber-700" />
                          <h4 className="font-semibold text-gray-900">
                            {t('admin.protocols.screenRecording') || 'Запись экрана'}
                          </h4>
                        </div>
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                          <video
                            src={testAttempt.screen_recording || testAttempt.screenRecording || ''}
                            controls
                            className="w-full h-full"
                            style={{ maxHeight: '400px' }}
                          >
                            {t('admin.protocols.videoNotSupported') || 'Ваш браузер не поддерживает воспроизведение видео.'}
                          </video>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detailed Answers Section */}
                  {(() => {
                    const answerDetails = testAttempt.answer_details || testAttempt.answerDetails || [];
                    if (answerDetails.length === 0) return null;
                    
                    return (
                      <div className="mb-6">
                        <button
                          onClick={() => setShowDetails(!showDetails)}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <span className="font-semibold text-gray-900">
                            {t('admin.protocols.detailedResults', { 
                              correct: answerDetails.filter((d: any) => d.is_correct).length, 
                              total: answerDetails.length 
                            }) || `Детальные результаты (${answerDetails.filter((d: any) => d.is_correct).length} из ${answerDetails.length} правильно)`}
                          </span>
                          {showDetails ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </button>

                        {showDetails && (
                          <div className="mt-4 space-y-4">
                            {answerDetails.map((detail: any, index: number) => (
                              <div
                                key={detail.question_id || index}
                                className={`border-2 rounded-lg p-4 ${
                                  detail.is_correct
                                    ? 'border-green-200 bg-green-50'
                                    : 'border-red-200 bg-red-50'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-start gap-3 flex-1">
                                    {detail.is_correct ? (
                                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                                    ) : (
                                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-900 mb-2 text-lg">
                                        {t('admin.protocols.questionNumber', { number: index + 1 }) || `Вопрос ${index + 1}`}: {detail.question_text || detail.questionText || ''}
                                      </p>
                                      
                                      <div className="space-y-2 text-sm">
                                        <div>
                                          <span className="font-medium text-gray-700">{t('admin.protocols.studentAnswer') || 'Ответ студента'}: </span>
                                          <span className={`${
                                            detail.is_correct ? 'text-green-700' : 'text-red-700'
                                          } font-medium`}>
                                            {detail.user_answer_display || detail.userAnswerDisplay || t('admin.protocols.notAnswered') || 'Не отвечено'}
                                          </span>
                                        </div>
                                        
                                        {!detail.is_correct && (
                                          <div>
                                            <span className="font-medium text-gray-700">{t('admin.protocols.correctAnswer') || 'Правильный ответ'}: </span>
                                            <span className="text-green-700 font-medium">
                                              {detail.correct_answer_display || detail.correctAnswerDisplay || ''}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Protocol Modal */}
      {showUploadModal && protocolForUpload && (
        <UploadProtocolModal
          protocol={protocolForUpload}
          onClose={() => {
            setShowUploadModal(false);
            setProtocolForUpload(null);
          }}
          onSuccess={() => {
            setShowUploadModal(false);
            setProtocolForUpload(null);
            fetchProtocols();
          }}
        />
      )}
    </div>
  );
}

interface UploadProtocolModalProps {
  protocol: Protocol;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadProtocolModal({ protocol, onClose, onSuccess }: UploadProtocolModalProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error(t('admin.protocols.selectFile') || 'Выберите файл для загрузки');
      return;
    }
    try {
      setLoading(true);
      await protocolsService.uploadProtocolFile(protocol.id, file);
      toast.success(t('admin.protocols.uploadSuccess') || 'Протокол загружен');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to upload protocol:', error);
      toast.error(error.message || (t('admin.protocols.uploadError') || 'Ошибка при загрузке протокола'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {t('admin.protocols.uploadProtocol') || 'Загрузить протокол'}
              </h2>
              <p className="text-gray-600">
                {t('admin.protocols.protocolNumber', { number: protocol.number }) || `Протокол №${protocol.number}`}
              </p>
              <p className="text-gray-600">
                {t('admin.protocols.student') || 'Студент'}: <span className="font-semibold">{protocol.userName || '—'}</span>
              </p>
              <p className="text-gray-600">
                {t('admin.protocols.course') || 'Курс/Тест'}: <span className="font-semibold">{protocol.courseName || protocol.testName || '—'}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('admin.protocols.protocolFile') || 'Файл протокола'} *
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600 justify-center">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                    <span>{t('admin.protocols.chooseFile') || 'Выберите файл'}</span>
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setFile(f);
                      }}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                    />
                  </label>
                  <p className="pl-1">{t('admin.protocols.orDrag') || 'или перетащите сюда'}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {t('admin.protocols.anyFormat') || 'PDF, DOC, DOCX, JPG, PNG, XLS, XLSX до 10MB'}
                </p>
                {file && (
                  <p className="text-sm text-gray-900 mt-2">
                    {t('admin.protocols.selected') || 'Выбран'}: <span className="font-medium">{file.name}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            {t('admin.protocols.cancel') || 'Отмена'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                {t('admin.protocols.uploading') || 'Загрузка...'}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {t('admin.protocols.upload') || 'Загрузить'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
