import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { CourseEditor } from '../components/admin/CourseEditor';
import { Course } from '../types/lms';
import { coursesService } from '../services/courses';
import { toast } from 'sonner';

export function EditCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const isCreating = courseId === 'new';

  useEffect(() => {
    const loadCourse = async () => {
      if (!courseId) {
        toast.error('ID курса не указан');
        navigate('/admin/dashboard');
        return;
      }

      // Если создаем новый курс, не загружаем данные
      if (isCreating) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const loadedCourse = await coursesService.getCourse(courseId);
        setCourse(loadedCourse);
      } catch (error: any) {
        toast.error(`Ошибка загрузки курса: ${error.message || 'Неизвестная ошибка'}`);
        console.error('Failed to load course:', error);
        navigate('/admin/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [courseId, navigate, isCreating]);

  const handleSave = async (courseData: Partial<Course>) => {
    if (!courseId) return;

    try {
      if (isCreating) {
        // Создаем новый курс
        const newCourse = await coursesService.createCourse(courseData);
        toast.success('Курс успешно создан');
        // Перенаправляем на страницу редактирования созданного курса
        navigate(`/admin/courses/${newCourse.id}/edit`);
      } else {
        // Обновляем существующий курс
        await coursesService.updateCourse(courseId, courseData);
        toast.success('Курс успешно обновлен');
        // Перезагружаем курс и остаемся на странице
        const updatedCourse = await coursesService.getCourse(courseId);
        setCourse(updatedCourse);
        setRefreshKey(prev => prev + 1); // Обновляем key для перезагрузки CourseEditor
      }
    } catch (error: any) {
      toast.error(`Ошибка сохранения курса: ${error.message || 'Неизвестная ошибка'}`);
      console.error('Failed to save course:', error);
    }
  };

  const handleCancel = () => {
    navigate('/admin/dashboard');
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Загрузка курса...</p>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  if (!isCreating && !course) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Курс не найден</h1>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Вернуться к дашборду
            </button>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-20 pb-12">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <CourseEditor 
            key={isCreating ? 'new' : `${course?.id}-${refreshKey}`} 
            course={course || undefined} 
            onSave={handleSave} 
            onCancel={handleCancel} 
          />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
