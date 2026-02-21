import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { NewsCategory } from '../../types/news';
import { toast } from 'sonner';

interface NewsCategoryEditorProps {
  category?: NewsCategory;
  onSave: (category: Partial<NewsCategory>) => Promise<void>;
  onCancel: () => void;
}

export function NewsCategoryEditor({ category, onSave, onCancel }: NewsCategoryEditorProps) {
  const [formData, setFormData] = useState<Partial<NewsCategory>>({
    name: '',
    name_kz: '',
    name_en: '',
    description: '',
    order: 0,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        name_kz: category.name_kz || '',
        name_en: category.name_en || '',
        description: category.description || '',
        order: category.order || 0,
        is_active: category.is_active !== undefined ? category.is_active : true,
      });
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toast.error('Название категории обязательно');
      return;
    }

    try {
      setLoading(true);
      await onSave(formData);
      toast.success(category ? 'Категория успешно обновлена' : 'Категория успешно создана');
    } catch (error: any) {
      console.error('Failed to save category:', error);
      toast.error('Ошибка сохранения категории');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            {category ? 'Редактировать категорию' : 'Создать категорию'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Название (RU) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="name_kz" className="block text-sm font-medium text-gray-700 mb-1">
              Название (KZ)
            </label>
            <input
              type="text"
              id="name_kz"
              value={formData.name_kz || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name_kz: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="name_en" className="block text-sm font-medium text-gray-700 mb-1">
              Название (EN)
            </label>
            <input
              type="text"
              id="name_en"
              value={formData.name_en || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-1">
                Порядок отображения
              </label>
              <input
                type="number"
                id="order"
                value={formData.order}
                onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Статус
              </label>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Активна</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Сохранение...' : 'Сохранить'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
