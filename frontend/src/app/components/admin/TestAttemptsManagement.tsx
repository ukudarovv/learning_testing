import { useState, useEffect } from 'react';
import { Video, Download, Eye, Search, Filter, Calendar, User, FileQuestion, CheckCircle, XCircle, Clock, RefreshCw, X, Trash2 } from 'lucide-react';
import { TestAttempt, Test } from '../../types/lms';
import { examsService } from '../../services/exams';
import { testsService } from '../../services/tests';
import { toast } from 'sonner';
import { ApiError } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { SMSVerification } from '../lms/SMSVerification';
import { useUser } from '../../contexts/UserContext';

export function TestAttemptsManagement() {
  const { t } = useTranslation();
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [testFilter, setTestFilter] = useState<string>('all');
  const [passedFilter, setPassedFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [dateFilter, setDateFilter] = useState<string>('all'); // 'all', 'today', 'week', 'month'
  const [selectedAttempt, setSelectedAttempt] = useState<TestAttempt | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showDeleteSMSModal, setShowDeleteSMSModal] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState(false);
  const { user } = useUser();

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Для администратора используем стандартный list endpoint
      // Backend вернет все попытки для админа
      const data = await examsService.getAllAttempts();
      setAttempts(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ошибка загрузки попыток';
      setError(message);
      console.error('Failed to fetch test attempts:', err);
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTests = async () => {
    try {
      const allTests = await testsService.getTests();
      // getTests возвращает PaginatedResponse, нужно использовать results
      setTests(Array.isArray(allTests) ? allTests : (allTests.results || []));
    } catch (err) {
      console.error('Failed to fetch tests:', err);
      setTests([]);
    }
  };

  useEffect(() => {
    fetchAttempts();
    fetchTests();
  }, []);

  const handleRequestDeleteVideo = async () => {
    if (!selectedAttempt) return;

    try {
      setDeletingVideo(true);
      await examsService.requestDeleteVideoOTP(String(selectedAttempt.id));
      setShowDeleteSMSModal(true);
      toast.success(t('admin.testAttempts.smsSent') || 'SMS код отправлен');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ошибка запроса SMS кода';
      toast.error(message);
    } finally {
      setDeletingVideo(false);
    }
  };

  const handleDeleteVideoConfirmed = async (smsCode: string) => {
    if (!selectedAttempt) return;

    try {
      setDeletingVideo(true);
      await examsService.deleteVideoRecording(String(selectedAttempt.id), smsCode);
      toast.success(t('admin.testAttempts.videoDeleted') || 'Видеозапись успешно удалена');
      setShowDeleteSMSModal(false);
      setShowVideoModal(false);
      setSelectedAttempt(null);
      fetchAttempts(); // Обновить список
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ошибка удаления видеозаписи';
      toast.error(message);
    } finally {
      setDeletingVideo(false);
    }
  };

  const filteredAttempts = attempts.filter(attempt => {
    // Поиск по имени пользователя, телефону или названию теста
    const user = attempt.user;
    const userName = typeof user === 'object' 
      ? (user?.full_name || user?.fullName || user?.phone || '')
      : '';
    const testTitle = typeof attempt.test === 'object' ? attempt.test?.title || '' : '';
    const matchesSearch = !searchQuery || 
      userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      testTitle.toLowerCase().includes(searchQuery.toLowerCase());

    // Фильтр по тесту
    const testId = typeof attempt.test === 'object' ? attempt.test?.id : attempt.test;
    const matchesTest = testFilter === 'all' || String(testId) === testFilter;

    // Фильтр по результату
    const matchesPassed = passedFilter === 'all' || 
      (passedFilter === 'passed' && attempt.passed) ||
      (passedFilter === 'failed' && !attempt.passed);

    // Фильтр по дате
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const attemptDate = attempt.completed_at || attempt.completedAt || attempt.started_at || attempt.startedAt;
      if (attemptDate) {
        const date = typeof attemptDate === 'string' ? new Date(attemptDate) : attemptDate;
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
      } else {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesTest && matchesPassed && matchesDate;
  });

  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '—';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
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

  const handleViewVideo = (attempt: TestAttempt) => {
    setSelectedAttempt(attempt);
    setShowVideoModal(true);
  };

  const getTestTitle = (attempt: TestAttempt): string => {
    if (typeof attempt.test === 'object') {
      return attempt.test?.title || 'Тест';
    }
    return 'Тест';
  };

  const getUserName = (attempt: TestAttempt): string => {
    const user = attempt.user;
    if (typeof user === 'object') {
      return user?.full_name || user?.fullName || user?.phone || 'Студент';
    }
    return 'Студент';
  };

  const getUserPhone = (attempt: TestAttempt): string => {
    const user = attempt.user;
    if (typeof user === 'object') {
      return user?.phone || '';
    }
    return '';
  };

  const hasVideo = (attempt: TestAttempt): boolean => {
    return !!(attempt.video_recording || attempt.videoRecording);
  };

  const getVideoUrl = (attempt: TestAttempt): string | null => {
    return attempt.video_recording || attempt.videoRecording || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t('admin.testAttempts.loading') || 'Загрузка попыток...'}</p>
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
            <h3 className="font-semibold text-red-900">{t('admin.testAttempts.error') || 'Ошибка'}</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchAttempts}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              {t('common.retry') || 'Повторить'}
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
          <h2 className="text-2xl font-bold text-gray-900">
            {t('admin.testAttempts.title') || 'Видеозаписи'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('admin.testAttempts.subtitle') || 'Просмотр всех видеозаписей прохождения тестов'}
          </p>
        </div>
        <button
          onClick={fetchAttempts}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.refresh') || 'Обновить'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.testAttempts.searchPlaceholder') || 'Поиск по студенту или тесту...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Test Filter */}
          <select
            value={testFilter}
            onChange={(e) => setTestFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t('admin.testAttempts.allTests') || 'Все тесты'}</option>
            {tests.map(test => (
              <option key={test.id} value={String(test.id)}>{test.title}</option>
            ))}
          </select>

          {/* Passed Filter */}
          <select
            value={passedFilter}
            onChange={(e) => setPassedFilter(e.target.value as 'all' | 'passed' | 'failed')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t('admin.testAttempts.allResults') || 'Все результаты'}</option>
            <option value="passed">{t('admin.testAttempts.passed') || 'Пройдено'}</option>
            <option value="failed">{t('admin.testAttempts.failed') || 'Не пройдено'}</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t('admin.testAttempts.allDates') || 'Все даты'}</option>
            <option value="today">{t('admin.testAttempts.today') || 'Сегодня'}</option>
            <option value="week">{t('admin.testAttempts.week') || 'За неделю'}</option>
            <option value="month">{t('admin.testAttempts.month') || 'За месяц'}</option>
          </select>
        </div>
      </div>

      {/* Attempts List */}
      {filteredAttempts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FileQuestion className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">{t('admin.testAttempts.noAttempts') || 'Попытки не найдены'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.testAttempts.student') || 'Студент'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.testAttempts.test') || 'Тест'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.testAttempts.score') || 'Балл'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.testAttempts.result') || 'Результат'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.testAttempts.date') || 'Дата'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.testAttempts.video') || 'Видео'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.testAttempts.actions') || 'Действия'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAttempts.map((attempt) => {
                  const videoUrl = getVideoUrl(attempt);
                  return (
                    <tr key={attempt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{getUserName(attempt)}</div>
                            {getUserPhone(attempt) && (
                              <div className="text-xs text-gray-500">{getUserPhone(attempt)}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FileQuestion className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{getTestTitle(attempt)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {attempt.score !== null && attempt.score !== undefined 
                            ? `${attempt.score.toFixed(1)}%`
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {attempt.passed !== null && attempt.passed !== undefined ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            attempt.passed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {attempt.passed ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                {t('admin.testAttempts.passed') || 'Пройдено'}
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                {t('admin.testAttempts.failed') || 'Не пройдено'}
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {formatDate(attempt.completed_at || attempt.completedAt || attempt.started_at || attempt.startedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {hasVideo(attempt) ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <Video className="w-4 h-4" />
                            <span className="text-sm font-medium">{t('admin.testAttempts.hasVideo') || 'Есть'}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">{t('admin.testAttempts.noVideo') || 'Нет'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {hasVideo(attempt) && (
                            <button
                              onClick={() => handleViewVideo(attempt)}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                              <Eye className="w-4 h-4" />
                              {t('admin.testAttempts.view') || 'Просмотр'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && selectedAttempt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {t('admin.testAttempts.videoRecording') || 'Видеозапись попытки'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {getUserName(selectedAttempt)} - {getTestTitle(selectedAttempt)}
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
              {getVideoUrl(selectedAttempt) ? (
                <div className="space-y-4">
                  <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      src={getVideoUrl(selectedAttempt)!}
                      controls
                      className="w-full h-full"
                      style={{ maxHeight: '600px' }}
                    >
                      {t('admin.testAttempts.videoNotSupported') || 'Ваш браузер не поддерживает воспроизведение видео.'}
                    </video>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <a
                      href={getVideoUrl(selectedAttempt)!}
                      download
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      {t('admin.testAttempts.download') || 'Скачать видео'}
                    </a>
                    <button
                      onClick={handleRequestDeleteVideo}
                      disabled={deletingVideo}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('admin.testAttempts.deleteVideo') || 'Удалить видеозапись'}
                    </button>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{t('admin.testAttempts.score') || 'Балл'}:</span>{' '}
                      {selectedAttempt.score !== null && selectedAttempt.score !== undefined 
                        ? `${selectedAttempt.score.toFixed(1)}%`
                        : '—'}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{t('admin.testAttempts.result') || 'Результат'}:</span>{' '}
                      {selectedAttempt.passed !== null && selectedAttempt.passed !== undefined
                        ? (selectedAttempt.passed 
                            ? t('admin.testAttempts.passed') || 'Пройдено'
                            : t('admin.testAttempts.failed') || 'Не пройдено')
                        : '—'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">{t('admin.testAttempts.videoNotAvailable') || 'Видеозапись недоступна'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SMS Verification Modal for Video Deletion */}
      {showDeleteSMSModal && user && selectedAttempt && (
        <SMSVerification
          phone={user.phone}
          onVerified={handleDeleteVideoConfirmed}
          onCancel={() => {
            setShowDeleteSMSModal(false);
          }}
          title={t('admin.testAttempts.deleteVideoTitle') || 'Подтверждение удаления видеозаписи'}
          description={t('admin.testAttempts.deleteVideoDescription') || 'Введите SMS код для подтверждения удаления видеозаписи'}
          purpose="verification"
          onResend={async () => {
            if (selectedAttempt) {
              await examsService.requestDeleteVideoOTP(String(selectedAttempt.id));
              toast.success(t('admin.testAttempts.smsSent') || 'SMS код отправлен');
            }
          }}
        />
      )}
    </div>
  );
}
