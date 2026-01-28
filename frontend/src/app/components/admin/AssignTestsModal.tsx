import { useState, useEffect } from 'react';
import { X, Search, FileText, CheckCircle, Users } from 'lucide-react';
import { testsService } from '../../services/tests';
import { ApiError } from '../../services/api';
import { useTranslation } from 'react-i18next';

interface AssignTestsModalProps {
  user?: any;
  users?: any[];
  onClose: () => void;
  onAssign?: (userIds: string[], testIds: string[]) => void;
}

export function AssignTestsModal({ user, users, onClose, onAssign }: AssignTestsModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState('all');
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine which users to work with
  const targetUsers = users || (user ? [user] : []);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true);
        const response = await testsService.getTests({ page_size: 1000 });
        // getTests возвращает PaginatedResponse, нужно извлечь results
        const testsList = response?.results || (Array.isArray(response) ? response : []);
        setTests(Array.isArray(testsList) ? testsList : []);
        setError(null);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Ошибка загрузки тестов';
        setError(message);
        console.error('Failed to fetch tests:', err);
        setTests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, []);

  const getCategoryName = (cat: any) => {
    // Если category - объект, используем name напрямую
    if (cat && typeof cat === 'object') {
      return cat.name || cat.name_kz || cat.name_en || '—';
    }
    
    // Если category - строка (ID или название)
    const names: Record<string, string> = {
      'industrial_safety': 'Промбезопасность',
      'fire_safety': 'Пожарная безопасность',
      'electrical_safety': 'Электробезопасность',
      'labor_protection': 'Охрана труда',
      'professions': 'Рабочие профессии',
    };
    return names[cat] || cat || '—';
  };

  const filteredTests = Array.isArray(tests) ? tests.filter(test => {
    const matchesSearch = test.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? true;
    const categoryName = getCategoryName(test.category);
    const matchesCategory = filterCategory === 'all' || categoryName === filterCategory;
    return matchesSearch && matchesCategory;
  }) : [];

  const handleToggleTest = (testId: string) => {
    const newSelected = new Set(selectedTests);
    if (newSelected.has(testId)) {
      newSelected.delete(testId);
    } else {
      newSelected.add(testId);
    }
    setSelectedTests(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTests.size === filteredTests.length) {
      setSelectedTests(new Set());
    } else {
      setSelectedTests(new Set(filteredTests.map(t => t.id)));
    }
  };

  const handleAssign = () => {
    if (selectedTests.size === 0) {
      alert(t('admin.users.noTestsSelected') || 'Выберите хотя бы один тест');
      return;
    }
    onAssign(targetUsers.map(u => u.id), Array.from(selectedTests));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {t('admin.users.assignTests') || 'Назначить тесты'}
              </h2>
              <p className="text-gray-600">
                {t('admin.users.selectedUsers') || 'Выбрано пользователей'}: {targetUsers.length}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Selected Users */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">{t('admin.users.students') || 'Студенты'}:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {targetUsers.slice(0, 5).map(user => (
                <span key={user.id} className="px-2 py-1 bg-white text-blue-700 text-xs font-medium rounded">
                  {user.full_name || user.fullName || 'Неизвестно'}
                </span>
              ))}
              {targetUsers.length > 5 && (
                <span className="px-2 py-1 bg-blue-200 text-blue-700 text-xs font-medium rounded">
                  +{targetUsers.length - 5} {t('common.more') || 'еще'}
                </span>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('admin.users.searchTests') || 'Поиск тестов...'}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('admin.users.allCategories') || 'Все категории'}</option>
              <option value="Промбезопасность">Промбезопасность</option>
              <option value="Пожарная безопасность">Пожарная безопасность</option>
              <option value="Электробезопасность">Электробезопасность</option>
              <option value="Охрана труда">Охрана труда</option>
              <option value="Рабочие профессии">Рабочие профессии</option>
            </select>
          </div>
        </div>

        {/* Tests List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('admin.users.loadingTests') || 'Загрузка тестов...'}</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{t('common.error') || 'Ошибка'}: {error}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">
                  {t('admin.users.availableTests') || 'Доступные тесты'} ({filteredTests.length})
                </h3>
                {filteredTests.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selectedTests.size === filteredTests.length 
                      ? (t('admin.users.deselectAll') || 'Снять все')
                      : (t('admin.users.selectAll') || 'Выбрать все')}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {filteredTests.map((test) => {
                  const categoryName = getCategoryName(test.category);
                  
                  return (
                    <div
                      key={test.id}
                      onClick={() => handleToggleTest(test.id)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedTests.has(test.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center h-6">
                          <input
                            type="checkbox"
                            checked={selectedTests.has(test.id)}
                            onChange={() => handleToggleTest(test.id)}
                            className="w-5 h-5 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-900">{test.title}</h4>
                              <p className="text-sm text-gray-600">{categoryName}</p>
                            </div>
                            {selectedTests.has(test.id) && (
                              <CheckCircle className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              {test.questions_count || test.questionsCount || 0} {t('admin.tests.questions') || 'вопросов'}
                            </span>
                            {test.time_limit || test.timeLimit ? (
                              <span>
                                {test.time_limit || test.timeLimit} {t('admin.tests.minutes') || 'мин'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredTests.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{t('admin.users.noTestsFound') || 'Тесты не найдены'}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {searchQuery 
                      ? (t('admin.users.tryDifferentSearch') || 'Попробуйте изменить параметры поиска')
                      : (t('admin.users.noAvailableTests') || 'Нет доступных тестов')}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {t('admin.users.selectedTests') || 'Выбрано тестов'}: <span className="font-semibold text-gray-900">{selectedTests.size}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
              >
                {t('common.cancel') || 'Отмена'}
              </button>
              <button
                onClick={handleAssign}
                disabled={selectedTests.size === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('admin.users.assign') || 'Назначить'} {selectedTests.size > 0 && `(${selectedTests.size})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
