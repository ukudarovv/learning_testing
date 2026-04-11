import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, X, Save, Plus, Trash2, GripVertical, Edit2, Video, FileText, CheckCircle, Upload, Layers } from 'lucide-react';
import { Course, Module, Lesson } from '../../types/lms';
import { testsService } from '../../services/tests';
import { categoriesService, Category } from '../../services/categories';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/api';

interface CourseEditorProps {
  course?: Course;
  onSave: (course: Partial<Course>) => void;
  onCancel: () => void;
}

export function CourseEditor({ course, onSave, onCancel }: CourseEditorProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Course>>(course || {
    title: '',
    description: '',
    category: 'industrial_safety',
    duration: 0,
    modules: [],
    status: 'in_development',
    language: 'ru',
  });

  // Обновляем formData при изменении course (для редактирования)
  useEffect(() => {
    if (course) {
      // Обрабатываем category: может быть объектом (из API) или строкой (старый формат)
      const categoryId = typeof course.category === 'object' 
        ? course.category?.id 
        : course.categoryId || course.category;
      
      setFormData({
        title: course.title || '',
        description: course.description || '',
        category: course.category,
        categoryId: categoryId,
        duration: course.duration || 0,
        status: course.status || 'draft',
        language: course.language || 'ru',
        passingScore: course.passingScore || course.passing_score,
        maxAttempts: course.maxAttempts || course.max_attempts,
        hasTimer: course.hasTimer || course.has_timer,
        timerMinutes: course.timerMinutes || course.timer_minutes,
        pdekCommission: course.pdekCommission || course.pdek_commission,
        final_test_id: course.final_test_id || course.finalTestId || null,
        isStandaloneTest: course.is_standalone_test || course.isStandaloneTest || false,
        is_standalone_test: course.is_standalone_test || course.isStandaloneTest || false,
      });
    }
  }, [course?.id]);

  // Инициализируем модули из курса, убеждаясь что это массив
  const initialModules = course?.modules && Array.isArray(course.modules) 
    ? course.modules 
    : [];
  
  const [modules, setModules] = useState<Module[]>(initialModules);
  
  // Обновляем модули при изменении курса (например, при редактировании)
  useEffect(() => {
    if (course?.modules && Array.isArray(course.modules)) {
      console.log('CourseEditor - updating modules from course:', course.modules);
      setModules(course.modules);
    } else if (course && !course.modules) {
      // Если курс есть, но модулей нет - устанавливаем пустой массив
      console.log('CourseEditor - course has no modules, setting empty array');
      setModules([]);
    }
  }, [course?.id, course?.modules]);
  
  // Логируем для отладки
  useEffect(() => {
    console.log('CourseEditor - course:', course);
    console.log('CourseEditor - modules state:', modules);
  }, [course, modules]);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ moduleId: string; lesson: Lesson | null } | null>(null);
  const [availableTests, setAvailableTests] = useState<any[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoadingTests(true);
        const response = await testsService.getTests();
        // testsService.getTests() возвращает PaginatedResponse<Test>
        const tests = Array.isArray(response) ? response : (response?.results || []);
        setAvailableTests(tests);
      } catch (error) {
        console.error('Failed to fetch tests:', error);
        setAvailableTests([]);
      } finally {
        setLoadingTests(false);
      }
    };
    fetchTests();
  }, []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Финальный тест в форме — только standalone; но если в БД уже привязан другой тест, показываем его в списке, чтобы было видно привязку и можно было снять.
  const availableFinalTests = useMemo(() => {
    const standalone = availableTests.filter(
      (test) => test.is_standalone === true || test.isStandalone === true
    );
    const id = formData.final_test_id ?? formData.finalTestId;
    if (id == null) return standalone;
    const linked = availableTests.find((x) => String(x.id) === String(id));
    if (!linked) return standalone;
    if (standalone.some((s) => String(s.id) === String(id))) return standalone;
    return [linked, ...standalone];
  }, [availableTests, formData.final_test_id, formData.finalTestId]);

  // Загружаем категории из API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const loadedCategories = await categoriesService.getCategories({ is_active: true });
        setCategories(loadedCategories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const getLessonTypeName = (type: string): string => {
    const names: Record<string, string> = {
      'text': t('admin.courses.lessonTypes.text'),
      'video': t('admin.courses.lessonTypes.video'),
      'pdf': t('admin.courses.lessonTypes.pdf'),
      'ppt': t('admin.courses.lessonTypes.ppt'),
      'quiz': t('admin.courses.lessonTypes.quiz'),
      'combined': t('admin.courses.lessonTypes.combined'),
    };
    return names[type] || type;
  };

  const handleAddModule = () => {
    const newModule: Module = {
      id: `module-${Date.now()}`,
      title: t('admin.courses.newModule'),
      description: '',
      order: modules.length + 1,
      lessons: [],
      completed: false,
    };
    setModules([...modules, newModule]);
    setExpandedModule(newModule.id);
  };

  const handleUpdateModule = (moduleId: string, updates: Partial<Module>) => {
    setModules(modules.map(m => m.id === moduleId ? { ...m, ...updates } : m));
  };

  const handleDeleteModule = (moduleId: string) => {
    setModules(modules.filter(m => m.id !== moduleId));
  };

  const handleAddLesson = (moduleId: string) => {
    setEditingLesson({
      moduleId,
      lesson: {
        id: `lesson-${Date.now()}`,
        moduleId,
        title: '',
        type: 'text',
        order: 1,
        completed: false,
        duration: 0,
        description: '',
        content: '',
        required: true,
      }
    });
  };

  const handleEditLesson = (moduleId: string, lesson: Lesson) => {
    setEditingLesson({ moduleId, lesson: { ...lesson } });
  };

  const handleSaveLesson = (moduleId: string, lesson: Lesson) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        const existingIndex = m.lessons.findIndex(l => l.id === lesson.id);
        if (existingIndex >= 0) {
          // Update existing
          const newLessons = [...m.lessons];
          newLessons[existingIndex] = lesson;
          return { ...m, lessons: newLessons };
        } else {
          // Add new
          return { ...m, lessons: [...m.lessons, lesson] };
        }
      }
      return m;
    }));
    setEditingLesson(null);
  };

  const handleDeleteLesson = (moduleId: string, lessonId: string) => {
    setModules(modules.map(m => {
      if (m.id === moduleId) {
        return { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) };
      }
      return m;
    }));
  };

  const handleSave = () => {
    // Преобразуем isStandaloneTest в is_standalone_test для backend
    const saveData: any = {
      ...formData,
      modules,
    };
    
    // Убеждаемся, что is_standalone_test передается в правильном формате
    if (saveData.isStandaloneTest !== undefined) {
      saveData.is_standalone_test = saveData.isStandaloneTest;
    }
    
    onSave(saveData);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={onCancel} 
            className="text-gray-600 hover:text-gray-900 transition-colors"
            title={t('common.back')}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            {course ? t('admin.courses.editCourse') : t('admin.courses.createCourse')}
          </h2>
        </div>
      </div>

      <div className="p-6">
          {/* Basic Info */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.courses.basicInfo')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.courses.courseTitle')} *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('admin.courses.courseTitlePlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.tests.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('admin.courses.courseDescriptionPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.courses.category')} *
                  </label>
                  <select
                    value={typeof formData.category === 'object' ? formData.category?.id : formData.category || ''}
                    onChange={(e) => {
                      const categoryId = e.target.value;
                      const selectedCategory = categories.find(c => String(c.id) === categoryId);
                      setFormData({ 
                        ...formData, 
                        category: selectedCategory ? selectedCategory.id : categoryId,
                        categoryId: categoryId || undefined
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loadingCategories}
                  >
                    <option value="">-- {t('admin.courses.selectCategory')} --</option>
                    {loadingCategories ? (
                      <option disabled>{t('admin.courses.loadingCategories')}</option>
                    ) : (
                      categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.courses.duration')}
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.courses.courseStatus')}
                  </label>
                  <select
                    value={formData.status || 'in_development'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="in_development">{t('admin.courses.inDevelopment')}</option>
                    <option value="draft">{t('admin.courses.draft')}</option>
                    <option value="published">{t('admin.courses.published')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Язык курса *
                  </label>
                  <select
                    value={formData.language || 'ru'}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value as 'ru' | 'kz' | 'en' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ru">Русский</option>
                    <option value="kz">Қазақша</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.courses.finalTest')}
                  </label>
                  <select
                    value={formData.final_test_id || formData.finalTestId || ''}
                    onChange={(e) => setFormData({ ...formData, final_test_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loadingTests}
                  >
                    <option value="">-- {t('admin.courses.noFinalTest')} --</option>
                    {loadingTests ? (
                      <option disabled>{t('admin.courses.loadingTests')}</option>
                    ) : (
                      availableFinalTests.map((test) => (
                        <option key={test.id} value={test.id}>
                          {test.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Modules */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{t('admin.courses.modulesAndLessons')}</h3>
              <button
                onClick={handleAddModule}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('admin.courses.addModule')}
              </button>
            </div>

            <div className="space-y-4">
              {modules.map((module, moduleIndex) => (
                <div key={module.id} className="border border-gray-300 rounded-lg">
                  {/* Module Header */}
                  <div className="bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-5 h-5 text-gray-400 mt-2 cursor-move" />
                      <div className="flex-1">
                        <input
                          type="text"
                          value={module.title}
                          onChange={(e) => handleUpdateModule(module.id, { title: e.target.value })}
                          placeholder={t('admin.courses.moduleTitlePlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 font-medium"
                        />
                        <textarea
                          value={module.description}
                          onChange={(e) => handleUpdateModule(module.id, { description: e.target.value })}
                          placeholder={t('admin.courses.moduleDescriptionPlaceholder')}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
                          className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium"
                        >
                          {expandedModule === module.id ? t('common.collapse') : t('admin.courses.expand')}
                        </button>
                        <button
                          onClick={() => handleDeleteModule(module.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Lessons */}
                  {expandedModule === module.id && (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          {t('admin.courses.lessons')} ({module.lessons && Array.isArray(module.lessons) ? module.lessons.length : 0})
                        </span>
                        <button
                          onClick={() => handleAddLesson(module.id)}
                          className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Plus className="w-3 h-3" />
                          {t('admin.courses.addLesson')}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(module.lessons && Array.isArray(module.lessons) ? module.lessons : []).map((lesson, lessonIndex) => (
                          <div key={lesson.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-move flex-shrink-0" />
                            {getLessonIcon(lesson.type)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{lesson.title || t('admin.courses.noTitle')}</p>
                              <p className="text-xs text-gray-500">
                                {getLessonTypeName(lesson.type)} • {lesson.duration || 0} {t('admin.courses.minutes')}
                              </p>
                            </div>
                            {lesson.required && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">
                                {t('admin.courses.required')}
                              </span>
                            )}
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEditLesson(module.id, lesson)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteLesson(module.id, lesson.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {module.lessons.length === 0 && (
                          <div className="text-center py-6 text-gray-500 text-sm">
                            {t('admin.courses.noLessons')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {modules.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {t('admin.courses.noModules')}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          {t('admin.courses.saveCourse')}
        </button>
      </div>

      {/* Lesson Editor Modal */}
      {editingLesson && (
        <LessonEditorModal
          key={String(editingLesson.lesson?.id ?? 'new-lesson')}
          lesson={editingLesson.lesson}
          onSave={(lesson) => handleSaveLesson(editingLesson.moduleId, lesson)}
          onCancel={() => setEditingLesson(null)}
          availableTests={availableTests}
          loadingTests={loadingTests}
        />
      )}
    </div>
  );
}

// Lesson Editor Modal Component
interface LessonEditorModalProps {
  lesson: Lesson | null;
  onSave: (lesson: Lesson) => void;
  onCancel: () => void;
  availableTests?: any[];
  loadingTests?: boolean;
}

function LessonEditorModal({ lesson, onSave, onCancel, availableTests = [], loadingTests = false }: LessonEditorModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<Lesson>(lesson || {
    id: `lesson-${Date.now()}`,
    moduleId: '',
    title: '',
    type: 'text',
    order: 1,
    completed: false,
    duration: 0,
    description: '',
    content: '',
    required: true,
  });

  useEffect(() => {
    if (!lesson) return;
    const L = lesson as Lesson & {
      video_url?: string;
      pdf_url?: string;
      thumbnail_url?: string;
      test_id?: string;
      passing_score?: number;
      max_attempts?: number;
      allow_download?: boolean;
      track_progress?: boolean;
    };
    setFormData({
      ...L,
      language: L.language || 'ru',
      videoUrl: L.videoUrl || L.video_url || '',
      pdfUrl: L.pdfUrl || L.pdf_url || '',
      thumbnailUrl: L.thumbnailUrl || L.thumbnail_url || '',
      testId: L.testId || L.test_id || '',
      passingScore: L.passingScore ?? L.passing_score ?? 80,
      maxAttempts: L.maxAttempts ?? L.max_attempts ?? 3,
      allowDownload: L.allowDownload ?? L.allow_download ?? false,
      trackProgress: L.trackProgress ?? L.track_progress ?? false,
    });
  }, [lesson?.id]);

  const lessonTypes = [
    { value: 'text', label: t('admin.courses.lessonTypes.text'), icon: FileText },
    { value: 'video', label: t('admin.courses.lessonTypes.video'), icon: Video },
    { value: 'pdf', label: t('admin.courses.lessonTypes.pdf'), icon: FileText },
    { value: 'combined', label: t('admin.courses.lessonTypes.combined'), icon: Layers },
    { value: 'quiz', label: t('admin.courses.lessonTypes.quiz'), icon: CheckCircle },
  ];

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');

    // Проверяем тип файла в зависимости от типа урока
    if ((formData.type === 'pdf' || formData.type === 'combined') && !isPdf) {
      alert(t('admin.courses.pdfOnly') || 'Пожалуйста, выберите PDF файл');
      return;
    }

    setUploading(true);
    try {
      console.log('Uploading file:', file.name, file.size, 'bytes');
      const response = await apiClient.upload<{ file_url?: string; file?: string; name: string }>(
        '/files/upload/',
        file,
        { name: file.name }
      );
      
      console.log('Upload response:', response);
      
      // Обновляем URL в зависимости от типа урока
      const fileUrl = response.file_url || response.file;
      if (fileUrl) {
        // Если URL относительный, добавляем базовый URL API
        let fullUrl = fileUrl;
        if (!fileUrl.startsWith('http')) {
          const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          fullUrl = `${baseUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
        }
        console.log('Setting file URL:', fullUrl);
        
        if (formData.type === 'pdf' || formData.type === 'combined') {
          setFormData({ ...formData, pdfUrl: fullUrl });
        }
        
        alert(t('admin.courses.fileUploaded') || 'Файл успешно загружен');
      } else {
        console.error('No file URL in response:', response);
        throw new Error('URL файла не получен от сервера');
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      const errorMessage = error.message || error.statusText || 'Неизвестная ошибка';
      alert(t('admin.courses.uploadError') || `Ошибка загрузки файла: ${errorMessage}`);
    } finally {
      setUploading(false);
      // Очищаем input для возможности повторной загрузки того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert(t('admin.courses.enterLessonTitle'));
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">
            {lesson && String(lesson.id).startsWith('lesson-') && lesson.title === '' ? t('admin.courses.createLesson') : t('admin.courses.editLesson')}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h4 className="font-bold text-gray-900 mb-4">{t('admin.courses.basicInfo')}</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.courses.lessonTitle')} *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('admin.courses.lessonTitlePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.courses.lessonDescription')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('admin.courses.lessonDescriptionPlaceholder')}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('admin.courses.lessonType')} *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {lessonTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('admin.courses.durationMinutes')}
                    </label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.required}
                      onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{t('admin.courses.requiredLesson')}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Content based on type */}
            <div>
              <h4 className="font-bold text-gray-900 mb-4">{t('admin.courses.lessonContent')}</h4>
              
              {formData.type === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.courses.textContent')}
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={t('admin.courses.textContentPlaceholder')}
                    rows={10}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    💡 {t('admin.courses.markdownTip')}
                  </p>
                </div>
              )}

              {formData.type === 'video' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('admin.courses.videoUrl')} *
                    </label>
                    <input
                      type="url"
                      value={formData.videoUrl || ''}
                      onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                      placeholder={t('admin.courses.videoUrlPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.courses.videoSupported')}
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.trackProgress || false}
                        onChange={(e) => setFormData({ ...formData, trackProgress: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">{t('admin.courses.trackProgress')}</span>
                    </label>
                  </div>
                </div>
              )}

              {formData.type === 'pdf' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('admin.courses.pdfUrl')} *
                    </label>
                    <input
                      type="url"
                      value={formData.pdfUrl || ''}
                      onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('admin.courses.uploadPdf')}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={handleFileSelect}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload className="w-4 h-4" />
                        {uploading ? (t('admin.courses.uploading') || 'Загрузка...') : t('admin.courses.selectFile')}
                      </button>
                      <span className="text-sm text-gray-500">{t('admin.courses.orEnterUrl')}</span>
                    </div>
                    {formData.pdfUrl && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ {t('admin.courses.fileUploaded') || 'Файл загружен'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {formData.type === 'combined' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('admin.courses.textContent')}
                    </label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder={t('admin.courses.textContentPlaceholder')}
                      rows={8}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      💡 {t('admin.courses.markdownTip')}
                    </p>
                  </div>

                  <div className="space-y-4 border-t border-gray-200 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.courses.videoUrl')}
                      </label>
                      <input
                        type="url"
                        value={formData.videoUrl || ''}
                        onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                        placeholder={t('admin.courses.videoUrlPlaceholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t('admin.courses.videoSupported')}
                      </p>
                    </div>
                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.trackProgress || false}
                          onChange={(e) => setFormData({ ...formData, trackProgress: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{t('admin.courses.trackProgress')}</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-gray-200 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.courses.pdfUrl')}
                      </label>
                      <input
                        type="url"
                        value={formData.pdfUrl || ''}
                        onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.courses.uploadPdf')}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={handleFileSelect}
                          disabled={uploading}
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Upload className="w-4 h-4" />
                          {uploading ? (t('admin.courses.uploading') || 'Загрузка...') : t('admin.courses.selectFile')}
                        </button>
                        <span className="text-sm text-gray-500">{t('admin.courses.orEnterUrl')}</span>
                      </div>
                      {formData.pdfUrl && (
                        <p className="text-xs text-green-600 mt-2">
                          ✓ {t('admin.courses.fileUploaded') || 'Файл загружен'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {formData.type === 'quiz' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('admin.courses.selectTest')}
                    </label>
                    <select
                      value={formData.testId || ''}
                      onChange={(e) => setFormData({ ...formData, testId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loadingTests}
                    >
                      <option value="">-- {t('admin.courses.selectTestOption')} --</option>
                      {Array.isArray(availableTests) && availableTests.map((test) => (
                        <option key={test.id} value={test.id}>
                          {test.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.courses.testsCreatedInAdmin')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.tests.passingScore')}
                      </label>
                      <input
                        type="number"
                        value={formData.passingScore || 80}
                        onChange={(e) => setFormData({ ...formData, passingScore: parseInt(e.target.value) })}
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.courses.maxAttempts')}
                      </label>
                      <input
                        type="number"
                        value={formData.maxAttempts || 3}
                        onChange={(e) => setFormData({ ...formData, maxAttempts: parseInt(e.target.value) })}
                        min="1"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            {t('admin.courses.saveLesson')}
          </button>
        </div>
      </div>
    </div>
  );
}

function getLessonIcon(type: string) {
  const iconClass = "w-5 h-5 flex-shrink-0";
  switch (type) {
    case 'video':
      return <Video className={`${iconClass} text-purple-600`} />;
    case 'pdf':
      return <FileText className={`${iconClass} text-red-600`} />;
    case 'ppt':
      return <FileText className={`${iconClass} text-orange-600`} />;
    case 'quiz':
      return <CheckCircle className={`${iconClass} text-green-600`} />;
    case 'combined':
      return <Layers className={`${iconClass} text-indigo-600`} />;
    default:
      return <FileText className={`${iconClass} text-blue-600`} />;
  }
}
