import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, Tag } from 'lucide-react';
import { newsService } from '../../services/news';
import { NewsCategory } from '../../types/news';
import { toast } from 'sonner';
import { NewsCategoryEditor } from './NewsCategoryEditor';

interface NewsCategoryManagementProps {
  refreshTrigger?: number;
}

export function NewsCategoryManagement({ refreshTrigger }: NewsCategoryManagementProps) {
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState<NewsCategory | undefined>(undefined);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await newsService.getNewsCategories();
      setCategories(data);
    } catch (error: any) {
      console.error('Failed to fetch categories:', error);
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

  const handleEdit = (category: NewsCategory) => {
    setEditingCategory(category);
    setShowCategoryEditor(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту категорию?')) {
      return;
    }

    try {
      await newsService.deleteCategory(id);
      toast.success('Категория успешно удалена');
      fetchCategories();
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      toast.error('Ошибка удаления категории');
    }
  };

  const handleSaveCategory = async (category: Partial<NewsCategory>) => {
    if (editingCategory) {
      await newsService.updateCategory(editingCategory.id, category);
    } else {
      await newsService.createCategory(category);
    }
    setShowCategoryEditor(false);
    setEditingCategory(undefined);
    fetchCategories();
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.name_kz && category.name_kz.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (category.name_en && category.name_en.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Управление категориями новостей</h2>
          <p className="text-gray-600 mt-1">Создание и редактирование категорий новостей</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Создать категорию</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Категории не найдены</p>
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
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{category.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{category.order}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        category.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {category.is_active ? 'Активна' : 'Неактивна'}
                      </span>
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
        <NewsCategoryEditor
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
