import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, Tag } from 'lucide-react';
import { licenseCategoriesService, LicenseCategory } from '../../services/licenses';
import { toast } from 'sonner';
import { LicenseCategoryEditor } from './LicenseCategoryEditor';

interface LicenseCategoryManagementProps {
  refreshTrigger?: number;
}

export function LicenseCategoryManagement({ refreshTrigger }: LicenseCategoryManagementProps) {
  const [categories, setCategories] = useState<LicenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState<LicenseCategory | undefined>(undefined);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await licenseCategoriesService.getCategories();
      setCategories(data);
    } catch (error: any) {
      console.error('Failed to fetch license categories:', error);
      toast.error('Ошибка загрузки категорий');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories, refreshTrigger]);

  const handleCreate = () => {
    setEditingCategory(undefined);
    setShowCategoryEditor(true);
  };

  const handleEdit = (category: LicenseCategory) => {
    setEditingCategory(category);
    setShowCategoryEditor(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту категорию? Лицензии с этой категорией не будут удалены, но им нужно будет назначить новую категорию.')) {
      return;
    }

    try {
      await licenseCategoriesService.deleteCategory(id);
      toast.success('Категория успешно удалена');
      fetchCategories();
    } catch (error: any) {
      console.error('Failed to delete license category:', error);
      toast.error(error.message || 'Ошибка удаления категории');
    }
  };

  const handleSaveCategory = async (category: Partial<LicenseCategory>) => {
    try {
      if (editingCategory) {
        await licenseCategoriesService.updateCategory(editingCategory.id, category);
        toast.success('Категория успешно обновлена');
      } else {
        await licenseCategoriesService.createCategory(category);
        toast.success('Категория успешно создана');
      }
      setShowCategoryEditor(false);
      setEditingCategory(undefined);
      fetchCategories();
    } catch (error: any) {
      console.error('Failed to save license category:', error);
      throw error;
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.name_kz && category.name_kz.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (category.name_en && category.name_en.toLowerCase().includes(searchQuery.toLowerCase())) ||
    category.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Управление категориями лицензий</h2>
          <p className="text-gray-600 mt-1">Создание и редактирование категорий лицензий</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Создать категорию</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Поиск по названию или slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchQuery ? 'Категории не найдены' : 'Категории не созданы'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название (RU)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название (KZ)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название (EN)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Порядок
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{category.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{category.name_kz || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{category.name_en || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 font-mono">{category.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{category.order}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {category.is_active ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Активна
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          Неактивна
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
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

      {showCategoryEditor && (
        <LicenseCategoryEditor
          category={editingCategory}
          onSave={handleSaveCategory}
          onCancel={() => {
            setShowCategoryEditor(false);
            setEditingCategory(undefined);
          }}
        />
      )}
    </div>
  );
}
