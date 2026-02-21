import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Eye, X, Phone, Mail, Calendar, User, FileText, CheckCircle, Clock, XCircle, MessageSquare } from 'lucide-react';
import { vacanciesService, VacancyApplication, Vacancy } from '../../services/vacancies';
import { toast } from 'sonner';

export function VacancyApplications() {
  const [applications, setApplications] = useState<VacancyApplication[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterVacancy, setFilterVacancy] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<VacancyApplication | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      if (filterVacancy !== 'all') {
        params.vacancy = filterVacancy;
      }
      const data = await vacanciesService.getApplications(params);
      setApplications(data);
    } catch (error: any) {
      console.error('Failed to fetch applications:', error);
      toast.error('Ошибка загрузки откликов');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterVacancy]);

  const fetchVacancies = useCallback(async () => {
    try {
      const data = await vacanciesService.getVacancies();
      setVacancies(data);
    } catch (error: any) {
      console.error('Failed to fetch vacancies:', error);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
    fetchVacancies();
  }, [fetchApplications, fetchVacancies]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await vacanciesService.updateApplication(id, { status: newStatus as any });
      toast.success('Статус отклика обновлен');
      fetchApplications();
      if (selectedApplication?.id === id) {
        const updated = await vacanciesService.getApplication(id);
        setSelectedApplication(updated);
      }
    } catch (error: any) {
      console.error('Failed to update application:', error);
      toast.error('Ошибка обновления статуса');
    }
  };

  const getStatusBadge = (status: string, withIcon: boolean = false) => {
    const statusMap: Record<string, { label: string; className: string; icon: any }> = {
      pending: { 
        label: 'Ожидает рассмотрения', 
        className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        icon: Clock
      },
      reviewed: { 
        label: 'Рассмотрено', 
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: Eye
      },
      contacted: { 
        label: 'Связались', 
        className: 'bg-green-50 text-green-700 border-green-200',
        icon: CheckCircle
      },
      rejected: { 
        label: 'Отклонено', 
        className: 'bg-red-50 text-red-700 border-red-200',
        icon: XCircle
      },
    };
    const statusInfo = statusMap[status] || statusMap.pending;
    const Icon = statusInfo.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusInfo.className}`}>
        {withIcon && <Icon className="w-3.5 h-3.5" />}
        {statusInfo.label}
      </span>
    );
  };

  // Calculate statistics
  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    reviewed: applications.filter(a => a.status === 'reviewed').length,
    contacted: applications.filter(a => a.status === 'contacted').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const filteredApplications = applications.filter(app => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        app.full_name.toLowerCase().includes(query) ||
        app.phone.toLowerCase().includes(query) ||
        (app.email && app.email.toLowerCase().includes(query)) ||
        (app.vacancy_title && app.vacancy_title.toLowerCase().includes(query))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Отклики на вакансии</h2>
          <p className="text-gray-600 mt-1">Просмотр и управление откликами</p>
        </div>
        <button
          onClick={async () => {
            try {
              await vacanciesService.exportApplications();
              toast.success('Экспорт выполнен');
            } catch (err: any) {
              toast.error(err.message || 'Ошибка экспорта');
            }
          }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Экспорт
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Всего откликов</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-blue-100 rounded-lg p-3">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ожидают</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
            </div>
            <div className="bg-yellow-100 rounded-lg p-3">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Рассмотрено</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.reviewed}</p>
            </div>
            <div className="bg-blue-100 rounded-lg p-3">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Связались</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.contacted}</p>
            </div>
            <div className="bg-green-100 rounded-lg p-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Отклонено</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</p>
            </div>
            <div className="bg-red-100 rounded-lg p-3">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Поиск по ФИО, телефону, email, вакансии..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 border rounded-lg transition-all font-medium ${
                showFilters
                  ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Фильтры</span>
            </button>
            {showFilters && (
              <div className="flex items-center gap-3">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-700"
                >
                  <option value="all">Все статусы</option>
                  <option value="pending">Ожидает рассмотрения</option>
                  <option value="reviewed">Рассмотрено</option>
                  <option value="contacted">Связались</option>
                  <option value="rejected">Отклонено</option>
                </select>
                <select
                  value={filterVacancy}
                  onChange={(e) => setFilterVacancy(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-gray-700 min-w-[200px]"
                >
                  <option value="all">Все вакансии</option>
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Загрузка откликов...</p>
            </div>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium">Отклики не найдены</p>
            <p className="text-gray-500 text-sm mt-2">
              {searchQuery || filterStatus !== 'all' || filterVacancy !== 'all'
                ? 'Попробуйте изменить параметры поиска'
                : 'Пока нет откликов на вакансии'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Кандидат
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Вакансия
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Контакты
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Дата
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredApplications.map((app) => (
                  <tr 
                    key={app.id} 
                    className="hover:bg-blue-50/50 transition-colors duration-150 group"
                  >
                    <td className="px-6 py-5">
                      <div className="text-sm font-semibold text-gray-900">{app.full_name}</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 line-clamp-2">
                          {app.vacancy_title || 'Неизвестно'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <a 
                            href={`tel:${app.phone}`}
                            className="hover:text-blue-600 transition-colors"
                          >
                            {app.phone}
                          </a>
                        </div>
                        {app.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <a 
                              href={`mailto:${app.email}`}
                              className="hover:text-blue-600 transition-colors truncate max-w-[200px]"
                            >
                              {app.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-2">
                        {getStatusBadge(app.status, true)}
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value)}
                          className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-gray-400 transition-colors"
                        >
                          <option value="pending">Ожидает рассмотрения</option>
                          <option value="reviewed">Рассмотрено</option>
                          <option value="contacted">Связались</option>
                          <option value="rejected">Отклонено</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium">
                            {app.created_at
                              ? new Date(app.created_at).toLocaleDateString('ru-RU', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : '-'}
                          </div>
                          {app.created_at && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {new Date(app.created_at).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedApplication(app)}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                          title="Просмотр деталей"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {app.resume_file_url && (
                          <a
                            href={app.resume_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all"
                            title="Скачать резюме"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white">Детали отклика</h3>
                <p className="text-blue-100 text-sm mt-1">{selectedApplication.vacancy_title || 'Неизвестная вакансия'}</p>
              </div>
              <button
                onClick={() => setSelectedApplication(null)}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-2 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Candidate Info */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                    {selectedApplication.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-gray-900 mb-2">{selectedApplication.full_name}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a 
                          href={`tel:${selectedApplication.phone}`}
                          className="hover:text-blue-600 transition-colors font-medium"
                        >
                          {selectedApplication.phone}
                        </a>
                      </div>
                      {selectedApplication.email && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <a 
                            href={`mailto:${selectedApplication.email}`}
                            className="hover:text-blue-600 transition-colors"
                          >
                            {selectedApplication.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    {getStatusBadge(selectedApplication.status, true)}
                  </div>
                </div>
              </div>

              {/* Status Change */}
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Изменить статус</label>
                <select
                  value={selectedApplication.status}
                  onChange={(e) => handleStatusChange(selectedApplication.id, e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium"
                >
                  <option value="pending">Ожидает рассмотрения</option>
                  <option value="reviewed">Рассмотрено</option>
                  <option value="contacted">Связались</option>
                  <option value="rejected">Отклонено</option>
                </select>
              </div>

              {/* Message */}
              {selectedApplication.message && (
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <MessageSquare className="w-4 h-4" />
                    Сообщение от кандидата
                  </label>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">{selectedApplication.message}</p>
                  </div>
                </div>
              )}

              {/* Resume */}
              {selectedApplication.resume_file_url && (
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Резюме</label>
                  <a
                    href={selectedApplication.resume_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-all border border-blue-200 hover:border-blue-300"
                  >
                    <Download className="w-5 h-5" />
                    <span>Скачать резюме</span>
                  </a>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4" />
                    Дата создания
                  </label>
                  <p className="text-gray-900 font-medium">
                    {selectedApplication.created_at
                      ? new Date(selectedApplication.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '-'}
                  </p>
                </div>
                {selectedApplication.reviewed_at && (
                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      Дата рассмотрения
                    </label>
                    <p className="text-gray-900 font-medium">
                      {new Date(selectedApplication.reviewed_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {selectedApplication.reviewed_by_name && (
                      <p className="text-sm text-gray-600 mt-1">
                        Рассмотрел: {selectedApplication.reviewed_by_name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedApplication(null)}
                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

