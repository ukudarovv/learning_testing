import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, Filter, X, Download } from 'lucide-react';
import { vacanciesService, Vacancy } from '../../services/vacancies';
import { toast } from 'sonner';

interface VacancyManagementProps {
  onCreate: () => void;
  onEdit: (vacancy: Vacancy) => void;
  refreshTrigger?: number;
}

export function VacancyManagement({ onCreate, onEdit, refreshTrigger }: VacancyManagementProps) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchVacancies = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const data = await vacanciesService.getVacancies(params);
      setVacancies(data);
    } catch (error: any) {
      console.error('Failed to fetch vacancies:', error);
      toast.error('Ошибка загрузки вакансий');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    fetchVacancies();
  }, [fetchVacancies, refreshTrigger]);

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту вакансию?')) {
      return;
    }

    try {
      await vacanciesService.deleteVacancy(id);
      toast.success('Вакансия успешно удалена');
      fetchVacancies();
    } catch (error: any) {
      console.error('Failed to delete vacancy:', error);
      toast.error('Ошибка удаления вакансии');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: 'Черновик', className: 'bg-gray-100 text-gray-700' },
      published: { label: 'Опубликована', className: 'bg-green-100 text-green-700' },
      closed: { label: 'Закрыта', className: 'bg-red-100 text-red-700' },
    };
    const statusInfo = statusMap[status] || statusMap.draft;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  const filteredVacancies = vacancies.filter(vacancy => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        vacancy.title.toLowerCase().includes(query) ||
        vacancy.description.toLowerCase().includes(query) ||
        vacancy.location.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Управление вакансиями</h2>
          <p className="text-gray-600 mt-1">Создание и редактирование вакансий</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await vacanciesService.exportVacancies();
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
          <button
            onClick={onCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Создать вакансию</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Поиск по названию, описанию, местоположению..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showFilters
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Фильтры</span>
            </button>
            {showFilters && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Все статусы</option>
                <option value="draft">Черновик</option>
                <option value="published">Опубликована</option>
                <option value="closed">Закрыта</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredVacancies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Вакансии не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Местоположение
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Откликов
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата создания
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVacancies.map((vacancy) => (
                  <tr key={vacancy.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{vacancy.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{vacancy.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(vacancy.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vacancy.applications_count ?? 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vacancy.created_at
                          ? new Date(vacancy.created_at).toLocaleDateString('ru-RU')
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(vacancy)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(vacancy.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

