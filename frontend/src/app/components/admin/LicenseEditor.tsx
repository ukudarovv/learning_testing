import { useState, useEffect } from 'react';
import { X, Save, Upload, FileText, Trash2 } from 'lucide-react';
import { License, licenseCategoriesService, LicenseCategory } from '../../services/licenses';
import { toast } from 'sonner';

interface LicenseEditorProps {
  license?: License;
  onSave: (license: Partial<License>, file?: File) => void;
  onCancel: () => void;
}

export function LicenseEditor({ license, onSave, onCancel }: LicenseEditorProps) {
  const [formData, setFormData] = useState<Partial<License>>({
    title: '',
    number: '',
    category_id: undefined,
    description: '',
    issued_date: '',
    valid_until: '',
    is_active: true,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<LicenseCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const data = await licenseCategoriesService.getCategories();
        setCategories(data.filter(c => c.is_active));
      } catch (error: any) {
        console.error('Failed to fetch license categories:', error);
        toast.error('Ошибка загрузки категорий');
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (license) {
      // Если category - объект, используем его ID
      let categoryId: string | number | undefined;
      if (license.category) {
        if (typeof license.category === 'object' && 'id' in license.category) {
          categoryId = license.category.id;
        } else if (typeof license.category === 'string' || typeof license.category === 'number') {
          categoryId = license.category;
        }
      }
      // Также проверяем category_id
      if (license.category_id) {
        categoryId = license.category_id;
      }

      setFormData({
        title: license.title || '',
        number: license.number || '',
        category_id: categoryId,
        description: license.description || '',
        issued_date: license.issued_date ? license.issued_date.split('T')[0] : '',
        valid_until: license.valid_until ? license.valid_until.split('T')[0] : undefined,
        is_active: license.is_active !== undefined ? license.is_active : true,
      });
      if (license.file_url) {
        setExistingFileUrl(license.file_url);
      }
    } else {
      // Для новой лицензии устанавливаем первую категорию по умолчанию
      if (categories.length > 0 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: categories[0].id }));
      }
    }
  }, [license, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация
    if (!formData.title || !formData.number || !formData.issued_date) {
      alert('Пожалуйста, заполните все обязательные поля');
      return;
    }

    if (!license && !selectedFile) {
      const proceed = window.confirm('Вы не выбрали файл для загрузки. Продолжить без файла?');
      if (!proceed) {
        return;
      }
    }

    // Очищаем valid_until если поле пустое
    // Преобразуем category_id в category для отправки на сервер
    const dataToSave: any = {
      ...formData,
      valid_until: formData.valid_until || undefined,
    };
    
    // Если есть category_id, отправляем его как category
    if (dataToSave.category_id) {
      dataToSave.category = dataToSave.category_id;
      delete dataToSave.category_id;
    }

    onSave(dataToSave, selectedFile || undefined);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Проверяем тип файла (допустим только PDF)
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Пожалуйста, выберите PDF файл');
        return;
      }
      setSelectedFile(file);
      setExistingFileUrl(null); // Скрываем старый файл при выборе нового
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setExistingFileUrl(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {license ? 'Редактировать лицензию' : 'Добавить лицензию'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название лицензии <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Номер лицензии <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.number || ''}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Категория <span className="text-red-500">*</span>
            </label>
            {loadingCategories ? (
              <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                Загрузка категорий...
              </div>
            ) : (
              <select
                value={formData.category_id || ''}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {categories.length === 0 ? (
                  <option value="">Нет доступных категорий</option>
                ) : (
                  categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Описание
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Issued Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Дата выдачи <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.issued_date || ''}
              onChange={(e) => setFormData({ ...formData, issued_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Valid Until */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Действует до
            </label>
            <input
              type="date"
              value={formData.valid_until || ''}
              onChange={(e) => setFormData({ ...formData, valid_until: e.target.value || undefined })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Is Active */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active !== undefined ? formData.is_active : true}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">
              Активна
            </label>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Файл лицензии (PDF)
              {!license && <span className="text-red-500"> *</span>}
            </label>
            
            {existingFileUrl && !selectedFile && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Текущий файл</p>
                    <a
                      href={existingFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Открыть в новой вкладке
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Удалить файл"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {selectedFile && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  {selectedFile || existingFileUrl ? 'Изменить файл' : 'Выберите файл'}
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">Только PDF файлы</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

