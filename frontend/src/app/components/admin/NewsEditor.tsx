import { useState, useEffect } from 'react';
import { X, Save, Upload, Trash2, Settings } from 'lucide-react';
import { News, NewsDetail, newsService } from '../../services/news';
import { NewsCategory } from '../../types/news';
import { toast } from 'sonner';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { NewsCategoryEditor } from './NewsCategoryEditor';

interface NewsEditorProps {
  news?: News | NewsDetail;
  onSave: (news: Partial<News>, imageFile?: File) => Promise<News>;
  onCancel: () => void;
}

export function NewsEditor({ news, onSave, onCancel }: NewsEditorProps) {
  const [formData, setFormData] = useState<Partial<News>>({
    title: '',
    title_kz: '',
    title_en: '',
    excerpt: '',
    excerpt_kz: '',
    excerpt_en: '',
    content: '',
    content_kz: '',
    content_en: '',
    category_id: undefined,
    is_published: true,
    published_at: '',
    order: 0,
  });
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState<NewsCategory | undefined>(undefined);

  const fetchCategories = async () => {
    try {
      const data = await newsService.getNewsCategories();
      setCategories(data);
    } catch (error: any) {
      console.error('Failed to fetch categories:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (news) {
      const publishedAt = news.published_at
        ? new Date(news.published_at).toISOString().slice(0, 16)
        : '';
      setFormData({
        title: news.title || '',
        title_kz: news.title_kz || '',
        title_en: news.title_en || '',
        excerpt: news.excerpt || '',
        excerpt_kz: news.excerpt_kz || '',
        excerpt_en: news.excerpt_en || '',
        content: news.content || '',
        content_kz: news.content_kz || '',
        content_en: news.content_en || '',
        category_id: news.category?.id ? parseInt(news.category.id) : undefined,
        is_published: news.is_published !== undefined ? news.is_published : true,
        published_at: publishedAt,
        order: news.order || 0,
      });

      if (news.image_url || news.image) {
        setImagePreview(news.image_url || news.image);
      }
    }
  }, [news]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCategory = () => {
    setEditingCategory(undefined);
    setShowCategoryEditor(true);
  };

  const handleSaveCategory = async (category: Partial<NewsCategory>) => {
    try {
      if (editingCategory) {
        await newsService.updateCategory(editingCategory.id, category);
      } else {
        await newsService.createCategory(category);
      }
      await fetchCategories();
      setShowCategoryEditor(false);
      setEditingCategory(undefined);
    } catch (error: any) {
      console.error('Failed to save category:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title?.trim()) {
      toast.error('Заголовок новости обязателен');
      return;
    }

    try {
      setLoading(true);
      const dataToSave = { ...formData };
      if (formData.published_at) {
        dataToSave.published_at = new Date(formData.published_at).toISOString();
      } else {
        dataToSave.published_at = null;
      }
      await onSave(dataToSave, imageFile || undefined);
    } catch (error: any) {
      console.error('Failed to save news:', error);
      toast.error('Ошибка сохранения новости');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            {news ? 'Редактировать новость' : 'Создать новость'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Категория
            </label>
            <button
              type="button"
              onClick={handleCreateCategory}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              title="Управление категориями"
            >
              <Settings className="w-4 h-4" />
              <span>Управление</span>
            </button>
          </div>
          <select
            id="category_id"
            value={formData.category_id || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              category_id: e.target.value ? parseInt(e.target.value) : undefined
            }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Без категории</option>
            {categories.filter(cat => cat.is_active).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Заголовок (RU) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="title_kz" className="block text-sm font-medium text-gray-700 mb-1">
                Заголовок (KZ)
              </label>
              <input
                type="text"
                id="title_kz"
                value={formData.title_kz || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title_kz: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="title_en" className="block text-sm font-medium text-gray-700 mb-1">
                Заголовок (EN)
              </label>
              <input
                type="text"
                id="title_en"
                value={formData.title_en || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title_en: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 mb-1">
              Краткое описание (RU)
            </label>
            <textarea
              id="excerpt"
              value={formData.excerpt || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="excerpt_kz" className="block text-sm font-medium text-gray-700 mb-1">
                Краткое описание (KZ)
              </label>
              <textarea
                id="excerpt_kz"
                value={formData.excerpt_kz || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, excerpt_kz: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="excerpt_en" className="block text-sm font-medium text-gray-700 mb-1">
                Краткое описание (EN)
              </label>
              <textarea
                id="excerpt_en"
                value={formData.excerpt_en || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, excerpt_en: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Содержание (RU) <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              value={formData.content || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="content_kz" className="block text-sm font-medium text-gray-700 mb-1">
                Содержание (KZ)
              </label>
              <textarea
                id="content_kz"
                value={formData.content_kz || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, content_kz: e.target.value }))}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="content_en" className="block text-sm font-medium text-gray-700 mb-1">
                Содержание (EN)
              </label>
              <textarea
                id="content_en"
                value={formData.content_en || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, content_en: e.target.value }))}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Изображение
            </label>
            {imagePreview && (
              <div className="mb-4 relative inline-block">
                <ImageWithFallback
                  src={imagePreview}
                  alt="Preview"
                  className="w-48 h-32 object-cover rounded-lg border border-gray-300"
                />
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                <Upload className="w-4 h-4" />
                <span>Загрузить изображение</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Удалить</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
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
              <label htmlFor="published_at" className="block text-sm font-medium text-gray-700 mb-1">
                Дата публикации
              </label>
              <input
                type="datetime-local"
                id="published_at"
                value={formData.published_at || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, published_at: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center pt-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_published}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Опубликована</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Сохранение...' : 'Сохранить'}</span>
            </button>
          </div>
        </form>
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
