import { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, Eye, Upload, Download, X, Search, Filter } from 'lucide-react';
import { licensesService, licenseCategoriesService, License, LicenseCategory } from '../../services/licenses';
import { toast } from 'sonner';

interface LicenseManagementProps {
  onCreate?: () => void;
  onEdit?: (license: License) => void;
  refreshTrigger?: number;
}

export function LicenseManagement({ onCreate, onEdit, refreshTrigger }: LicenseManagementProps) {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [categories, setCategories] = useState<LicenseCategory[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await licenseCategoriesService.getCategories();
        setCategories(data.filter(c => c.is_active));
      } catch (error: any) {
        console.error('Failed to fetch license categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterCategory !== 'all') {
        // Если фильтр - ID категории, отправляем как category
        params.category = filterCategory;
      }
      if (filterActive !== 'all') {
        params.is_active = filterActive === 'active';
      }
      const data = await licensesService.getLicenses(params);
      setLicenses(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to fetch licenses:', error);
      toast.error('Ошибка загрузки лицензий');
      setLicenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, [filterCategory, filterActive, refreshTrigger]);

  const handleDelete = async (license: License) => {
    if (!window.confirm(`Вы уверены, что хотите удалить лицензию "${license.title}"?`)) {
      return;
    }

    try {
      await licensesService.deleteLicense(license.id);
      toast.success('Лицензия удалена');
      fetchLicenses();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка при удалении лицензии');
    }
  };

  const handleDownload = async (license: License) => {
    try {
      const blob = await licensesService.downloadLicense(license.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${license.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Файл успешно скачан');
    } catch (error: any) {
      toast.error('Ошибка при скачивании файла');
    }
  };

  const filteredLicenses = licenses.filter(license => {
    const matchesSearch = 
      license.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      license.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (license.description && license.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Фильтр по категории
    if (filterCategory !== 'all') {
      const licenseCategoryId = license.category_id || 
        (license.category && typeof license.category === 'object' && 'id' in license.category ? license.category.id : 
         (typeof license.category === 'string' || typeof license.category === 'number' ? license.category : null));
      
      if (String(licenseCategoryId) !== String(filterCategory)) {
        return false;
      }
    }
    
    return matchesSearch;
  });

  const getCategoryLabel = (category: any): string => {
    // Если категория - объект LicenseCategory
    if (category && typeof category === 'object' && 'name' in category) {
      return category.name || category.name_kz || category.name_en || '—';
    }
    // Если категория - строка (slug) или число (ID), пытаемся найти в загруженных категориях
    if (typeof category === 'string' || typeof category === 'number') {
      const cat = categories.find(c => c.id === String(category) || c.slug === String(category));
      if (cat) {
        return cat.name;
      }
      // Fallback для старых значений
      const oldCategories: Record<string, string> = {
        'surveying': 'Изыскания и проектирование',
        'construction': 'Строительство',
        'other': 'Прочее',
      };
      return oldCategories[String(category)] || String(category);
    }
    return '—';
  };

  if (loading && licenses.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Загрузка лицензий...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Управление лицензиями</h2>
          <p className="text-gray-600 mt-1">Загрузка и управление лицензиями компании</p>
        </div>
        <button
          onClick={() => onCreate?.()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Добавить лицензию
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск по названию, номеру..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Все категории</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Active Filter */}
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Все статусы</option>
            <option value="active">Активные</option>
            <option value="inactive">Неактивные</option>
          </select>
        </div>
      </div>

      {/* Licenses Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Название</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Номер</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Категория</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Дата выдачи</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Действует до</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Статус</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Файл</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    {searchQuery || filterCategory !== 'all' || filterActive !== 'all' 
                      ? 'Лицензии не найдены' 
                      : 'Нет лицензий. Добавьте первую лицензию, нажав кнопку "Добавить лицензию"'}
                  </td>
                </tr>
              ) : (
                filteredLicenses.map(license => (
                  <tr key={license.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{license.title}</div>
                      {license.description && (
                        <div className="text-sm text-gray-500 mt-1 line-clamp-1">{license.description}</div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">{license.number}</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        {license.category_display || (license.category && typeof license.category === 'object' && 'name' in license.category ? license.category.name : getCategoryLabel(license.category))}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">
                      {new Date(license.issued_date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">
                      {license.valid_until ? new Date(license.valid_until).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td className="py-4 px-4">
                      {license.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                          Активна
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                          Неактивна
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {license.file_url ? (
                        <button
                          onClick={() => handleDownload(license)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                          title="Скачать файл"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Файл</span>
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400">Нет файла</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEdit?.(license)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(license)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

