import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { TestEditor } from '../components/admin/TestEditor';
import { Test } from '../types/lms';
import { testsService } from '../services/tests';
import { toast } from 'sonner';

export function CreateTestPage() {
  const navigate = useNavigate();

  const handleSave = async (testData: Partial<Test>) => {
    try {
      const savedTest = await testsService.createTest(testData);
      toast.success('Тест успешно создан');
      // Перенаправляем на страницу редактирования созданного теста
      navigate(`/admin/tests/${savedTest.id}/edit`);
    } catch (error: any) {
      toast.error(`Ошибка создания теста: ${error.message || 'Неизвестная ошибка'}`);
      console.error('Failed to create test:', error);
    }
  };

  const handleCancel = () => {
    navigate('/admin/dashboard');
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-20 pb-12">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <TestEditor test={undefined} onSave={handleSave} onCancel={handleCancel} />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
