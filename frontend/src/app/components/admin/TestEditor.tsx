import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { Test, Question } from '../../types/lms';
import { testsService } from '../../services/tests';
import { categoriesService, Category } from '../../services/categories';
import { useTranslation } from 'react-i18next';

interface TestEditorProps {
  test?: Test;
  onSave: (test: Partial<Test>) => void;
  onCancel: () => void;
}

// Функция для нормализации вопросов: преобразует объекты options в строки
function normalizeQuestions(questions: Question[]): Question[] {
  return questions.map(q => {
    if (q.type === 'single_choice' || q.type === 'multiple_choice') {
      if (Array.isArray(q.options) && q.options.length > 0) {
        // Если options - это объекты, извлекаем text
        if (typeof q.options[0] === 'object' && q.options[0] !== null) {
          const optionsAsStrings = (q.options as Array<{ id?: string; text: string }>).map(opt => opt.text);
          // Для correctAnswer: если это id, находим соответствующий text
          let correctAnswer = q.correctAnswer;
          if (q.type === 'single_choice' && typeof correctAnswer === 'string') {
            const correctOption = (q.options as Array<{ id?: string; text: string }>).find(
              opt => String(opt.id) === correctAnswer
            );
            correctAnswer = correctOption?.text || correctAnswer;
          } else if (q.type === 'multiple_choice' && Array.isArray(correctAnswer)) {
            correctAnswer = correctAnswer.map(ca => {
              const correctOption = (q.options as Array<{ id?: string; text: string }>).find(
                opt => String(opt.id) === ca
              );
              return correctOption?.text || ca;
            });
          }
          return {
            ...q,
            options: optionsAsStrings,
            correctAnswer
          };
        }
      }
    }
    return q;
  });
}

export function TestEditor({ test, onSave, onCancel }: TestEditorProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Test>>({
    title: test?.title || '',
    description: test?.description || '',
    timeLimit: test?.timeLimit || test?.time_limit || 30,
    passingScore: test?.passingScore || test?.passing_score || 80,
    maxAttempts: test?.maxAttempts || test?.max_attempts || 3,
    language: test?.language || 'ru',
    shuffleQuestions: true,
    showResults: test?.showResults !== undefined ? test.showResults : (test?.show_results !== undefined ? test.show_results : false),
    questions: [],
    category: test?.category,
    categoryId: typeof test?.category === 'object' ? test?.category?.id : test?.categoryId,
    isStandalone: test?.is_standalone !== undefined ? test.is_standalone : (test?.isStandalone !== undefined ? test.isStandalone : true),
    is_standalone: test?.is_standalone !== undefined ? test.is_standalone : (test?.isStandalone !== undefined ? test.isStandalone : true),
    requiresVideoRecording: test?.requiresVideoRecording !== undefined ? test.requiresVideoRecording : (test?.requires_video_recording !== undefined ? test.requires_video_recording : false),
    requires_video_recording: test?.requires_video_recording !== undefined ? test.requires_video_recording : (test?.requiresVideoRecording !== undefined ? test.requiresVideoRecording : false),
  });

  const [questions, setQuestions] = useState<Question[]>(test?.questions || []);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  
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

  // Загружаем вопросы при редактировании теста
  useEffect(() => {
    const loadQuestions = async () => {
      if (test?.id) {
        try {
          setLoading(true);
          const loadedQuestions = await testsService.getTestQuestions(test.id);
          // Нормализуем options: преобразуем объекты {id, text} в строки для работы редактора
          const normalizedQuestions = normalizeQuestions(loadedQuestions);
          setQuestions(normalizedQuestions);
        } catch (error) {
          console.error('Failed to load questions:', error);
          setQuestions([]);
        } finally {
          setLoading(false);
        }
      }
    };
    loadQuestions();
  }, [test?.id]);

  // Обновляем formData при изменении test (для редактирования)
  useEffect(() => {
    if (test) {
      // Обрабатываем category: может быть объектом (из API) или строкой (старый формат)
      const categoryId = typeof test.category === 'object' 
        ? test.category?.id 
        : test.categoryId || test.category;
      
      setFormData(prev => ({
        ...prev,
        title: test.title || prev.title,
        description: test.description || prev.description,
        timeLimit: test.timeLimit || test.time_limit || prev.timeLimit,
        passingScore: test.passingScore || test.passing_score || prev.passingScore,
        maxAttempts: test.maxAttempts || test.max_attempts || prev.maxAttempts,
        language: test.language || prev.language || 'ru',
        category: test.category,
        categoryId: categoryId,
        isStandalone: test.is_standalone !== undefined ? test.is_standalone : (test.isStandalone !== undefined ? test.isStandalone : true),
        is_standalone: test.is_standalone !== undefined ? test.is_standalone : (test.isStandalone !== undefined ? test.isStandalone : true),
        requiresVideoRecording: test.requiresVideoRecording !== undefined ? test.requiresVideoRecording : (test.requires_video_recording !== undefined ? test.requires_video_recording : false),
        requires_video_recording: test.requires_video_recording !== undefined ? test.requires_video_recording : (test.requiresVideoRecording !== undefined ? test.requiresVideoRecording : false),
        shuffleQuestions: test.shuffleQuestions !== undefined ? test.shuffleQuestions : (test.shuffle_questions !== undefined ? test.shuffle_questions : prev.shuffleQuestions),
        showResults: test.showResults !== undefined ? test.showResults : (test.show_results !== undefined ? test.show_results : false),
      }));
    }
  }, [test?.id, test?.title, test?.description, test?.timeLimit, test?.time_limit, test?.passingScore, test?.passing_score, test?.maxAttempts, test?.max_attempts, test?.category, test?.is_standalone, test?.isStandalone, test?.requires_video_recording, test?.requiresVideoRecording]);

  const questionTypes = [
    { value: 'single_choice', label: t('admin.tests.questionTypes.singleChoice') },
    { value: 'multiple_choice', label: t('admin.tests.questionTypes.multipleChoice') },
    { value: 'yes_no', label: t('admin.tests.questionTypes.yesNo') },
    { value: 'short_answer', label: t('admin.tests.questionTypes.shortAnswer') },
  ];

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      type: 'single_choice',
      text: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      order: questions.length + 1,
      weight: 1,
    };
    setQuestions([...questions, newQuestion]);
    setExpandedQuestion(newQuestion.id);
  };

  const handleUpdateQuestion = (questionId: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const updated = { ...q, ...updates };
        
        // При изменении типа вопроса нужно обновить options и correctAnswer
        if (updates.type && updates.type !== q.type) {
          if (updates.type === 'yes_no') {
            updated.options = [t('common.yes'), t('common.no')];
            updated.correctAnswer = '';
          } else if (updates.type === 'short_answer') {
            updated.options = undefined;
            updated.correctAnswer = '';
          } else if (updates.type === 'single_choice' || updates.type === 'multiple_choice') {
            if (!updated.options || updated.options.length === 0) {
              updated.options = ['', '', '', ''];
            }
            if (updates.type === 'single_choice') {
              updated.correctAnswer = '';
            } else {
              updated.correctAnswer = [];
            }
          }
        }
        
        return updated;
      }
      return q;
    }));
  };

  const handleDeleteQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const handleAddOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        // Убеждаемся, что options - это массив строк
        const currentOptions = Array.isArray(q.options) 
          ? q.options.filter((opt): opt is string => typeof opt === 'string')
          : [];
        return { ...q, options: [...currentOptions, ''] };
      }
      return q;
    }));
  };

  const handleUpdateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const handleDeleteOption = (questionId: string, optionIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        // Убеждаемся, что options - это массив строк
        const currentOptions = Array.isArray(q.options) 
          ? q.options.filter((opt): opt is string => typeof opt === 'string')
          : [];
        const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
        
        // Если удаляем правильный ответ, нужно обновить correctAnswer
        const deletedOption = currentOptions[optionIndex];
        let newCorrectAnswer = q.correctAnswer;
        if (q.type === 'single_choice' && q.correctAnswer === deletedOption) {
          newCorrectAnswer = '';
        } else if (q.type === 'multiple_choice' && Array.isArray(q.correctAnswer)) {
          newCorrectAnswer = q.correctAnswer.filter(a => a !== deletedOption);
        }
        
        return { ...q, options: newOptions, correctAnswer: newCorrectAnswer };
      }
      return q;
    }));
  };

  const handleSave = () => {
    // Валидация: название теста обязательно
    if (!formData.title || formData.title.trim() === '') {
      alert(t('admin.tests.testTitleRequired') || 'Название теста обязательно');
      return;
    }

    // Валидация: если is_standalone=false (не используется в курсах), должна быть выбрана категория
    if (!formData.isStandalone && !formData.is_standalone) {
      const categoryId = typeof formData.category === 'object' ? formData.category?.id : formData.categoryId;
      if (!categoryId) {
        alert(t('admin.tests.standaloneTestRequiresCategory') || 'Для теста, не используемого в курсах, необходимо выбрать категорию');
        return;
      }
    }

    // Убеждаемся, что числовые значения не NaN
    const cleanFormData: any = {
      ...formData,
      timeLimit: formData.timeLimit && !isNaN(formData.timeLimit) ? formData.timeLimit : 30,
      passingScore: formData.passingScore && !isNaN(formData.passingScore) ? formData.passingScore : 80,
      maxAttempts: formData.maxAttempts && !isNaN(formData.maxAttempts) ? formData.maxAttempts : 3,
    };

    // Преобразуем isStandalone в is_standalone для backend
    if (cleanFormData.isStandalone !== undefined) {
      cleanFormData.is_standalone = cleanFormData.isStandalone;
    }

    // Преобразуем requiresVideoRecording в requires_video_recording для backend
    // Важно: проверяем оба варианта имени поля и явно устанавливаем значение
    if (cleanFormData.requiresVideoRecording !== undefined) {
      cleanFormData.requires_video_recording = cleanFormData.requiresVideoRecording;
    } else if (cleanFormData.requires_video_recording !== undefined) {
      // Если requiresVideoRecording не определен, но requires_video_recording есть, используем его
      cleanFormData.requires_video_recording = cleanFormData.requires_video_recording;
    } else {
      // Если ни одно значение не определено, устанавливаем false явно
      cleanFormData.requires_video_recording = false;
    }

    // Убеждаемся, что categoryId передается правильно
    const categoryId = typeof cleanFormData.category === 'object' ? cleanFormData.category?.id : cleanFormData.categoryId;
    if (categoryId) {
      cleanFormData.categoryId = categoryId;
    }

    console.log('TestEditor.handleSave - Before onSave:', {
      requiresVideoRecording: cleanFormData.requiresVideoRecording,
      requires_video_recording: cleanFormData.requires_video_recording,
      formData_requiresVideoRecording: formData.requiresVideoRecording,
      formData_requires_video_recording: formData.requires_video_recording,
    });

    onSave({
      ...cleanFormData,
      questions,
    });
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
            {test ? t('admin.tests.editTest') : t('admin.tests.createTest')}
          </h2>
        </div>
      </div>

      <div className="p-6">
          {/* Basic Info */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.tests.testSettings')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.tests.testTitle')} *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('admin.tests.testTitlePlaceholder')}
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
                  placeholder={t('admin.tests.descriptionPlaceholder')}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.tests.category') || 'Категория'}
                  </label>
                  <select
                    value={typeof formData.category === 'object' ? formData.category?.id : formData.categoryId || ''}
                    onChange={(e) => {
                      const categoryId = e.target.value;
                      const selectedCategory = categories.find(c => String(c.id) === categoryId);
                      setFormData({ 
                        ...formData, 
                        category: selectedCategory ? selectedCategory : null,
                        categoryId: categoryId || undefined
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loadingCategories}
                  >
                    <option value="">-- {t('admin.tests.selectCategory') || 'Выберите категорию'} --</option>
                    {loadingCategories ? (
                      <option disabled>{t('admin.tests.loadingCategories') || 'Загрузка категорий...'}</option>
                    ) : (
                      categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.tests.language') || 'Язык теста'} <span className="text-red-500">*</span>
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.tests.timeLimit')}
                  </label>
                  <input
                    type="number"
                    value={formData.timeLimit ?? ''}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value);
                      const value = isNaN(parsed) ? 30 : parsed;
                      setFormData({ ...formData, timeLimit: value });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.tests.passingScore')}
                  </label>
                  <input
                    type="number"
                    value={formData.passingScore ?? ''}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value);
                      const value = isNaN(parsed) ? 80 : parsed;
                      setFormData({ ...formData, passingScore: value });
                    }}
                    min="0"
                    max="100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.tests.maxAttempts')}
                  </label>
                  <input
                    type="number"
                    value={formData.maxAttempts ?? ''}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value);
                      const value = isNaN(parsed) ? 3 : parsed;
                      setFormData({ ...formData, maxAttempts: value });
                    }}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.shuffleQuestions}
                    onChange={(e) => setFormData({ ...formData, shuffleQuestions: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{t('admin.tests.shuffleQuestions')}</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.showResults}
                    onChange={(e) => setFormData({ ...formData, showResults: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{t('admin.tests.showResults')}</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.requiresVideoRecording || formData.requires_video_recording || false}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      requiresVideoRecording: e.target.checked,
                      requires_video_recording: e.target.checked
                    })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">{t('admin.tests.requiresVideoRecording') || 'Требуется видеозапись'}</span>
                </label>
              </div>

              {/* Standalone Test Checkbox */}
              <div className="mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isStandalone !== undefined ? formData.isStandalone : (formData.is_standalone !== undefined ? formData.is_standalone : true)}
                    onChange={(e) => setFormData({ ...formData, isStandalone: e.target.checked, is_standalone: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {t('admin.tests.isStandalone') || 'Использовать в курсах'}
                  </span>
                </label>
                {(!formData.isStandalone && !formData.is_standalone) && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      {t('admin.tests.standaloneTestWarning') || '⚠️ Для теста, не используемого в курсах, необходимо выбрать категорию. Тест будет отображаться на странице Training Programs.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {t('admin.tests.questions')} ({questions.length})
              </h3>
              <button
                onClick={handleAddQuestion}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('admin.tests.addQuestion')}
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id} className="border border-gray-300 rounded-lg">
                  {/* Question Header */}
                  <div className="bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-5 h-5 text-gray-400 mt-2 cursor-move" />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-sm font-semibold text-gray-700">{t('admin.tests.question')} {index + 1}</span>
                          <select
                            value={question.type}
                            onChange={(e) => handleUpdateQuestion(question.id, { type: e.target.value as any })}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                          >
                            {questionTypes.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={question.weight}
                            onChange={(e) => handleUpdateQuestion(question.id, { weight: parseInt(e.target.value) })}
                            placeholder={t('admin.tests.points')}
                            className="w-20 px-3 py-1 border border-gray-300 rounded-lg text-sm"
                            min="1"
                          />
                        </div>
                        <textarea
                          value={question.text}
                          onChange={(e) => handleUpdateQuestion(question.id, { text: e.target.value })}
                          placeholder={t('admin.tests.questionText')}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedQuestion(expandedQuestion === question.id ? null : question.id)}
                          className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium"
                        >
                          {expandedQuestion === question.id ? t('common.collapse') : t('admin.tests.options')}
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Question Options */}
                  {expandedQuestion === question.id && (question.type === 'single_choice' || question.type === 'multiple_choice') && (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">{t('admin.tests.answerOptions')}</span>
                        <button
                          onClick={() => handleAddOption(question.id)}
                          className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Plus className="w-3 h-3" />
                          {t('admin.tests.addOption')}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(Array.isArray(question.options) ? question.options.map((opt: any) => typeof opt === 'string' ? opt : (typeof opt === 'object' && opt !== null ? opt.text : String(opt))) : []).map((option: string, optionIndex: number) => (
                          <div key={optionIndex} className="flex items-center gap-3">
                            <input
                              type={question.type === 'single_choice' ? 'radio' : 'checkbox'}
                              name={`correct-${question.id}`}
                              checked={
                                question.type === 'single_choice'
                                  ? question.correctAnswer === option
                                  : Array.isArray(question.correctAnswer) && question.correctAnswer.includes(option)
                              }
                              onChange={(e) => {
                                if (question.type === 'single_choice') {
                                  handleUpdateQuestion(question.id, { correctAnswer: option });
                                } else {
                                  const current = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                                  const updated = e.target.checked
                                    ? [...current, option]
                                    : current.filter(a => a !== option);
                                  handleUpdateQuestion(question.id, { correctAnswer: updated });
                                }
                              }}
                              className="flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => handleUpdateOption(question.id, optionIndex, e.target.value)}
                              placeholder={t('admin.tests.option', { number: optionIndex + 1 })}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <button
                              onClick={() => handleDeleteOption(question.id, optionIndex)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-gray-500 mt-2">
                        {question.type === 'single_choice' 
                          ? t('admin.tests.selectOneCorrect')
                          : t('admin.tests.selectMultipleCorrect')}
                      </p>
                    </div>
                  )}

                  {/* Short Answer Question */}
                  {expandedQuestion === question.id && question.type === 'short_answer' && (
                    <div className="p-4">
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('admin.tests.correctAnswer')}
                        </label>
                        <input
                          type="text"
                          value={question.correctAnswer || ''}
                          onChange={(e) => handleUpdateQuestion(question.id, { correctAnswer: e.target.value })}
                          placeholder={t('admin.tests.correctAnswerPlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {t('admin.tests.shortAnswerHint')}
                      </p>
                    </div>
                  )}

                  {expandedQuestion === question.id && question.type === 'yes_no' && (
                    <div className="p-4">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={question.correctAnswer === t('common.yes')}
                            onChange={() => handleUpdateQuestion(question.id, { correctAnswer: t('common.yes') })}
                          />
                          <span>{t('common.yes')}</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={question.correctAnswer === t('common.no')}
                            onChange={() => handleUpdateQuestion(question.id, { correctAnswer: t('common.no') })}
                          />
                          <span>{t('common.no')}</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {questions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {t('admin.tests.noQuestions')}
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
          {t('admin.tests.saveTest')}
        </button>
      </div>
    </div>
  );
}
