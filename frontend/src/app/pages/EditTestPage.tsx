import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { TestEditor } from '../components/admin/TestEditor';
import { Test } from '../types/lms';
import { testsService } from '../services/tests';
import { toast } from 'sonner';

export function EditTestPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadTest = async () => {
      if (!testId) {
        toast.error('ID теста не указан');
        navigate('/admin/dashboard');
        return;
      }

      try {
        setLoading(true);
        const loadedTest = await testsService.getTest(testId);
        setTest(loadedTest);
      } catch (error: any) {
        toast.error(`Ошибка загрузки теста: ${error.message || 'Неизвестная ошибка'}`);
        console.error('Failed to load test:', error);
        navigate('/admin/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadTest();
  }, [testId, navigate]);

  const handleSave = async (testData: Partial<Test>) => {
    if (!testId) return;

    try {
      console.log('EditTestPage.handleSave - testData:', {
        requiresVideoRecording: testData.requiresVideoRecording,
        requires_video_recording: testData.requires_video_recording,
        allKeys: Object.keys(testData)
      });
      
      await testsService.updateTest(testId, testData);
      toast.success('Тест успешно обновлен');
      // Перезагружаем тест и остаемся на странице
      const updatedTest = await testsService.getTest(testId);
      setTest(updatedTest);
      setRefreshKey(prev => prev + 1); // Обновляем key для перезагрузки TestEditor
    } catch (error: any) {
      toast.error(`Ошибка сохранения теста: ${error.message || 'Неизвестная ошибка'}`);
      console.error('Failed to save test:', error);
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
            <p className="mt-4 text-gray-600">Загрузка теста...</p>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  if (!test) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Тест не найден</h1>
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
          <TestEditor key={`${test.id}-${refreshKey}`} test={test} onSave={handleSave} onCancel={handleCancel} />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
