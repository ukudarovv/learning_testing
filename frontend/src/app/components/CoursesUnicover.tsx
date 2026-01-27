import { Shield, Flame, Zap, Briefcase, Wrench, Filter, Globe, FileQuestion } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { coursesService } from '../services/courses';
import { categoriesService, Category } from '../services/categories';
import { testsService } from '../services/tests';
import { Course, Test } from '../types/lms';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useEnrollmentRequests } from '../hooks/useEnrollmentRequests';

// Fallback иконки для категорий, если в базе нет icon
const categoryIcons: Record<string, typeof Shield> = {
  'industrial_safety': Shield,
  'fire_safety': Flame,
  'electrical_safety': Zap,
  'labor_protection': Briefcase,
  'professions': Wrench,
};

export function CoursesUnicover() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { i18n, t } = useTranslation();
  const { courseRequests, testRequests, refresh: refreshEnrollmentRequests } = useEnrollmentRequests();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null); // null = использовать язык интерфейса
  const [courses, setCourses] = useState<Course[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  
  // Получаем текущий язык интерфейса
  const currentInterfaceLanguage = i18n.language || localStorage.getItem('language') || 'ru';
  // Используем выбранный язык фильтра или язык интерфейса
  const languageToUse = selectedLanguage || currentInterfaceLanguage;

  // Загружаем категории из API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesData = await categoriesService.getCategories({ is_active: true });
        // Сортируем категории по полю order
        const sortedCategories = [...categoriesData].sort((a, b) => {
          if (a.order !== b.order) {
            return a.order - b.order;
          }
          return a.name.localeCompare(b.name);
        });
        setCategories(sortedCategories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  // Загружаем курсы и тесты с учетом языка
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Получаем курсы с фильтрацией по языку - API возвращает пагинированный ответ
        const coursesResponse = await coursesService.getCourses({ 
          status: 'published',
          language: languageToUse
        });
        // Извлекаем массив курсов из пагинированного ответа
        let coursesList: Course[] = [];
        
        // coursesService.getCourses() всегда возвращает PaginatedResponse<Course>
        if (coursesResponse && typeof coursesResponse === 'object') {
          if ('results' in coursesResponse && Array.isArray(coursesResponse.results)) {
            coursesList = coursesResponse.results;
          } else if (Array.isArray(coursesResponse)) {
            // Fallback на случай, если вернулся массив напрямую
            coursesList = coursesResponse;
          }
        }
        
        // Фильтруем только опубликованные курсы на frontend
        const activeCourses = coursesList.filter(course => 
          course && course.status && course.status !== 'draft' && course.status !== 'annulled'
        );
        setCourses(activeCourses);
        
        // Получаем тесты с категориями и фильтрацией по языку
        const testsResponse = await testsService.getTests({ 
          page_size: 1000, // Получаем все тесты
          language: languageToUse // Фильтруем по языку
        });
        let testsList: Test[] = [];
        
        if (testsResponse && typeof testsResponse === 'object') {
          if ('results' in testsResponse && Array.isArray(testsResponse.results)) {
            testsList = testsResponse.results;
          } else if (Array.isArray(testsResponse)) {
            testsList = testsResponse;
          }
        }
        
        // Фильтруем активные тесты с категориями и is_standalone=false
        // Показываем только тесты, которые имеют категорию И НЕ используются в курсах (автономные тесты)
        const activeTests = testsList.filter(test => 
          test && 
          test.is_active !== false && 
          test.category && // Должна быть категория
          (!test.is_standalone && !test.isStandalone) // Тест НЕ используется в курсах (автономный)
        );
        setTests(activeTests);
      } catch (error) {
        console.error('Failed to fetch courses and tests:', error);
        setCourses([]);
        setTests([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [languageToUse]);
  
  // Сбрасываем выбранный язык фильтра при изменении языка интерфейса
  useEffect(() => {
    // Если выбранный язык фильтра совпадает со старым языком интерфейса, сбрасываем его
    // чтобы использовать новый язык интерфейса
    if (selectedLanguage === null || selectedLanguage === currentInterfaceLanguage) {
      setSelectedLanguage(null);
    }
  }, [currentInterfaceLanguage]);

  // Фильтруем курсы по выбранной категории
  const filteredCourses = selectedCategory === 'all' 
    ? courses 
    : courses.filter(course => {
        if (!course.category) return false;
        
        // course.category может быть строкой (старый формат) или объектом (новый формат)
        if (typeof course.category === 'string') {
          // Если category - строка, сравниваем с ID или name категорий
          return course.category === selectedCategory || 
                 categories.some(cat => (cat.id === selectedCategory && (cat.id === course.category || cat.name === course.category)));
        } else if (course.category && typeof course.category === 'object') {
          // Если category - объект, сравниваем по ID
          const categoryId = course.category.id || String(course.category.id);
          return categoryId === selectedCategory || String(categoryId) === selectedCategory;
        }
        return false;
      });

  // Фильтруем тесты по выбранной категории
  const filteredTests = selectedCategory === 'all'
    ? tests
    : tests.filter(test => {
        if (!test.category) return false;
        
        const categoryId = test.category.id || String(test.category.id);
        return categoryId === selectedCategory || String(categoryId) === selectedCategory;
      });

  // Получаем курсы-тесты (курсы с is_standalone_test=true)
  const standaloneTestCourses = filteredCourses.filter(course => 
    course.is_standalone_test || course.isStandaloneTest
  );

  // Получаем обычные курсы (без is_standalone_test)
  const regularCourses = filteredCourses.filter(course => 
    !course.is_standalone_test && !course.isStandaloneTest
  );

  // Получаем иконку для категории
  const getCategoryIcon = (category: string | { id?: string; name?: string; icon?: string } | null) => {
    if (!category) return Briefcase;
    
    // Если category - объект, используем icon из базы или name для поиска в fallback
    if (typeof category === 'object') {
      if (category.icon) {
        // Можно добавить логику для отображения иконок из базы данных
        // Пока используем fallback по name
      }
      const categoryName = category.name || '';
      return categoryIcons[categoryName.toLowerCase().replace(/\s+/g, '_')] || Briefcase;
    }
    
    // Если category - строка, ищем в fallback иконках
    return categoryIcons[category] || Briefcase;
  };

  // Получаем название категории для отображения с учетом языка
  const getCategoryName = (category: Category | null | undefined): string => {
    if (!category) return t('education.courses.unknownCategory');
    
    // Выбираем название в зависимости от текущего языка интерфейса
    // Используем i18n.language напрямую, чтобы всегда получать актуальный язык
    const lang = i18n.language || localStorage.getItem('language') || 'ru';
    if (lang === 'kz' && category.name_kz) {
      return category.name_kz;
    } else if (lang === 'en' && category.name_en) {
      return category.name_en;
    }
    // Fallback на русское название или основное
    return category.name || t('education.courses.unknownCategory');
  };

  // Получаем название категории по ID
  const getCategoryNameById = (categoryId: string | null | undefined): string => {
    if (!categoryId || categoryId === 'all') return t('education.courses.allCourses');
    const category = categories.find(cat => cat.id === categoryId);
    return getCategoryName(category);
  };

  const handleEnrollClick = async (course: Course) => {
    if (!user) {
      // Если пользователь не авторизован, перенаправляем на страницу входа
      toast.info(t('education.courses.loginRequired'));
      navigate('/login', { state: { returnTo: `/student/course/${course.id}` } });
      return;
    }

    if (user.role !== 'student') {
      toast.info(t('education.courses.studentsOnly'));
      return;
    }

    // Проверяем, есть ли уже запрос на запись
    const existingRequest = courseRequests.find(r => r.courseId === course.id || (typeof r.course === 'object' && r.course?.id === course.id));
    
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        toast.info(t('education.courses.requestPending') || 'Запрос на запись уже подан и ожидает подтверждения');
        return;
      } else if (existingRequest.status === 'approved') {
        // Если запрос одобрен, переходим к курсу
        navigate(`/student/course/${course.id}`);
        return;
      }
    }

    // Проверяем, есть ли уже запись
    try {
      const enrollments = await coursesService.getMyEnrollments();
      const isEnrolled = enrollments.some(e => e.courseId === course.id || (typeof e.course === 'object' && e.course?.id === course.id));
      
      if (isEnrolled) {
        navigate(`/student/course/${course.id}`);
        return;
      }
    } catch (error) {
      // Игнорируем ошибку, продолжаем создавать запрос
    }

    // Создаем запрос на запись
    try {
      setEnrollingCourseId(course.id);
      const result = await coursesService.selfEnroll(course.id);
      
      if (result.request_id || result.status === 'pending') {
        toast.success(t('education.courses.requestCreated') || 'Запрос на запись создан. Ожидайте подтверждения администратора.');
        await refreshEnrollmentRequests();
      } else if (result.enrollment_id) {
        // Если сразу создалась запись (старая логика для обратной совместимости)
        toast.success(t('education.courses.enrolled') || 'Вы успешно записаны на курс');
        navigate(`/student/course/${course.id}`);
      }
    } catch (error: any) {
      if (error.message?.includes('already') || error.message?.includes('уже')) {
        // Если уже записан или запрос уже существует
        navigate(`/student/course/${course.id}`);
      } else {
        toast.error(error.message || t('education.courses.enrollError') || 'Ошибка при создании запроса');
      }
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const handleTestClick = async (testId: string | number) => {
    if (!user) {
      // Если пользователь не авторизован, перенаправляем на страницу входа
      toast.info(t('education.courses.loginRequired'));
      navigate('/login', { state: { returnTo: `/student/test/${testId}` } });
      return;
    }

    if (user.role !== 'student') {
      toast.info(t('education.courses.studentsOnly'));
      return;
    }

    // Проверяем, есть ли уже запрос на запись для теста
    const test = tests.find(t => t.id === String(testId));
    const existingRequest = testRequests.find(r => r.testId === String(testId) || (typeof r.test === 'object' && r.test?.id === String(testId)));
    
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        toast.info(t('education.tests.requestPending') || 'Запрос на запись уже подан и ожидает подтверждения');
        return;
      } else if (existingRequest.status === 'approved') {
        // Если запрос одобрен, переходим к тесту
        navigate(`/student/test/${testId}`);
        return;
      }
    }

    // Создаем запрос на запись для всех тестов
    try {
      await testsService.createEnrollmentRequest(String(testId));
      toast.success(t('education.tests.requestCreated') || 'Запрос на запись создан. Ожидайте подтверждения администратора.');
      await refreshEnrollmentRequests();
    } catch (error: any) {
      if (error.message?.includes('already') || error.message?.includes('уже')) {
        // Если запрос уже существует
        toast.info(t('education.tests.requestPending') || 'Запрос на запись уже подан');
      } else {
        toast.error(error.message || t('education.tests.requestError') || 'Ошибка при создании запроса');
      }
    }
  };

  const handleStandaloneTestCourseClick = (course: Course) => {
    // Для курсов-тестов переходим напрямую к финальному тесту
    const testId = course.final_test_id || course.finalTestId;
    if (testId) {
      handleTestClick(testId);
    } else {
      toast.error(t('education.courses.testNotLinked') || 'Тест не привязан к курсу');
    }
  };

  if (loading) {
    return (
      <section id="courses" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('education.courses.loading')}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="courses" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-block bg-blue-100 text-blue-600 px-4 py-2 rounded-full mb-4">
            {t('education.courses.badge')}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t('education.courses.title')}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {t('education.courses.subtitle')}
          </p>
        </div>

        {/* Language Filter */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 text-gray-700">
            <Globe className="w-5 h-5" />
            <span className="font-medium">{t('education.courses.languageFilter')}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedLanguage(null)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                selectedLanguage === null
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
              }`}
              title={`${t('education.courses.auto')}: ${currentInterfaceLanguage === 'ru' ? t('education.courses.russian') : currentInterfaceLanguage === 'kz' ? t('education.courses.kazakh') : t('education.courses.english')}`}
            >
              {t('education.courses.auto')} ({currentInterfaceLanguage === 'ru' ? 'РУ' : currentInterfaceLanguage === 'kz' ? 'ҚЗ' : 'EN'})
            </button>
            <button
              onClick={() => setSelectedLanguage('ru')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                selectedLanguage === 'ru'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
              }`}
            >
              {t('education.courses.russian')}
            </button>
            <button
              onClick={() => setSelectedLanguage('kz')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                selectedLanguage === 'kz'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
              }`}
            >
              {t('education.courses.kazakh')}
            </button>
            <button
              onClick={() => setSelectedLanguage('en')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                selectedLanguage === 'en'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
              }`}
            >
              {t('education.courses.english')}
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4 text-gray-700">
            <Filter className="w-5 h-5" />
            <span className="font-medium">{t('education.courses.categoryFilter')}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Кнопка "Все курсы" */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
              }`}
            >
              {t('education.courses.allCourses')}
            </button>
            {/* Динамические категории из API */}
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                }`}
              >
                {getCategoryName(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Courses and Tests Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Обычные курсы */}
          {regularCourses.map((course) => {
            // Получаем иконку для категории курса
            const categoryObj = typeof course.category === 'object' 
              ? course.category 
              : categories.find(cat => cat.id === course.category || cat.name === course.category);
            const Icon = getCategoryIcon(categoryObj || course.category);
            return (
              <div
                key={course.id}
                className="bg-white p-8 rounded-xl shadow-sm hover:shadow-xl transition-shadow border border-gray-200"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 bg-blue-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{course.title}</h3>
                    <p className="text-sm text-blue-600 font-medium">{course.duration} {t('education.courses.hours')}</p>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-6">{course.description || t('education.courses.defaultDescription')}</p>
                
                {course.modules && course.modules.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">{t('education.courses.courseModules')}</h4>
                    <ul className="space-y-2">
                      {course.modules.slice(0, 4).map((module, idx) => (
                        <li key={module.id || idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></span>
                          <span>{module.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {(() => {
                  const existingRequest = courseRequests.find(r => r.courseId === course.id || (typeof r.course === 'object' && r.course?.id === course.id));
                  const isEnrolling = enrollingCourseId === course.id;
                  
                  if (existingRequest) {
                    if (existingRequest.status === 'pending') {
                      return (
                        <button 
                          disabled
                          className="mt-6 w-full bg-yellow-100 text-yellow-800 px-6 py-3 rounded-lg font-medium cursor-not-allowed"
                        >
                          {t('education.courses.requestPending') || 'Ожидает подтверждения'}
                        </button>
                      );
                    } else if (existingRequest.status === 'approved') {
                      return (
                        <button 
                          onClick={() => navigate(`/student/course/${course.id}`)}
                          className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                          {t('education.courses.goToCourse') || 'Перейти к курсу'}
                        </button>
                      );
                    }
                  }
                  
                  return (
                    <button 
                      onClick={() => handleEnrollClick(course)}
                      disabled={isEnrolling}
                      className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isEnrolling 
                        ? (t('education.courses.creatingRequest') || 'Создание запроса...')
                        : user 
                        ? (t('education.courses.requestEnrollment') || 'Записаться на курс')
                        : t('education.courses.enroll')}
                    </button>
                  );
                })()}
              </div>
            );
          })}

          {/* Курсы-тесты */}
          {standaloneTestCourses.map((course) => {
            // Получаем иконку для категории курса
            const categoryObj = typeof course.category === 'object' 
              ? course.category 
              : categories.find(cat => cat.id === course.category || cat.name === course.category);
            const Icon = FileQuestion;
            return (
              <div
                key={`test-course-${course.id}`}
                className="bg-white p-8 rounded-xl shadow-sm hover:shadow-xl transition-shadow border border-orange-200"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 bg-orange-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{course.title}</h3>
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">
                        {t('education.courses.test') || 'Тест'}
                      </span>
                    </div>
                    <p className="text-sm text-orange-600 font-medium">{t('education.courses.standaloneTest') || 'Автономный тест'}</p>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-6">{course.description || t('education.courses.defaultDescription')}</p>
                
                <button 
                  onClick={() => handleStandaloneTestCourseClick(course)}
                  className="mt-6 w-full bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
                >
                  {user ? (t('education.courses.startTest') || 'Начать тест') : t('education.courses.enroll')}
                </button>
              </div>
            );
          })}

          {/* Отдельные тесты */}
          {filteredTests.map((test) => {
            const categoryObj = test.category;
            const Icon = FileQuestion;
            return (
              <div
                key={`test-${test.id}`}
                className="bg-white p-8 rounded-xl shadow-sm hover:shadow-xl transition-shadow border border-orange-200"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 bg-orange-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{test.title}</h3>
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">
                        {t('education.courses.test') || 'Тест'}
                      </span>
                    </div>
                    <p className="text-sm text-orange-600 font-medium">
                      {test.questions_count || test.questionsCount || 0} {t('education.courses.questions') || 'вопросов'}
                    </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{t('education.courses.passingScore') || 'Проходной балл'}: {test.passing_score || test.passingScore || 80}%</span>
                    {test.time_limit || test.timeLimit ? (
                      <span>{t('education.courses.timeLimit') || 'Время'}: {test.time_limit || test.timeLimit} {t('education.courses.minutes') || 'мин'}</span>
                    ) : null}
                  </div>
                </div>
                
                {(() => {
                  if (!user) {
                    return (
                      <button 
                        onClick={() => handleTestClick(test.id)}
                        className="mt-6 w-full bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
                      >
                        {t('education.courses.enroll')}
                      </button>
                    );
                  }

                  // Проверяем статус запроса на запись
                  const existingRequest = testRequests.find(r => r.testId === test.id || (typeof r.test === 'object' && r.test?.id === test.id));
                  
                  if (existingRequest) {
                    if (existingRequest.status === 'pending') {
                      return (
                        <button 
                          disabled
                          className="mt-6 w-full bg-yellow-500 text-white px-6 py-3 rounded-lg font-medium cursor-not-allowed opacity-75"
                        >
                          {t('education.courses.requestPending') || 'Ожидает подтверждения'}
                        </button>
                      );
                    } else if (existingRequest.status === 'approved') {
                      return (
                        <button 
                          onClick={() => handleTestClick(test.id)}
                          className="mt-6 w-full bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
                        >
                          {t('education.courses.startTest') || 'Начать тест'}
                        </button>
                      );
                    }
                  }

                  // Нет запроса или запрос отклонен - показываем кнопку создания запроса
                  return (
                    <button 
                      onClick={() => handleTestClick(test.id)}
                      className="mt-6 w-full bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
                    >
                      {t('education.courses.startTest') || 'Начать тест'}
                    </button>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {regularCourses.length === 0 && standaloneTestCourses.length === 0 && filteredTests.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">{t('education.courses.noCoursesInCategory')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
