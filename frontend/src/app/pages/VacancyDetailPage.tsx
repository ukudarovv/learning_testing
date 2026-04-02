import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { Briefcase, MapPin, DollarSign, Clock, ArrowLeft, Loader2, Upload, X } from 'lucide-react';
import { vacanciesService, Vacancy, VacancyApplicationCreate } from '../services/vacancies';
import { toast } from 'sonner';

export function VacancyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<VacancyApplicationCreate>({
    vacancy: id || '',
    full_name: '',
    phone: '',
    email: '',
    message: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchVacancy = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await vacanciesService.getVacancy(id);
        setVacancy(data);
        setFormData(prev => ({ ...prev, vacancy: id }));
      } catch (error: any) {
        console.error('Failed to fetch vacancy:', error);
        toast.error('Ошибка загрузки вакансии');
        navigate('/construction/vacancies');
      } finally {
        setLoading(false);
      }
    };

    fetchVacancy();
  }, [id, navigate]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'ФИО обязательно для заполнения';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Телефон обязателен для заполнения';
    } else if (!/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Некорректный формат телефона';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Некорректный формат email';
    }

    if (resumeFile) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (resumeFile.size > maxSize) {
        newErrors.resume_file = 'Размер файла не должен превышать 10 МБ';
      }
      const allowedTypes = ['application/pdf', 'application/msword', 
                           'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                           'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(resumeFile.type)) {
        newErrors.resume_file = 'Разрешены только файлы: PDF, DOC, DOCX, JPG, PNG';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Пожалуйста, исправьте ошибки в форме');
      return;
    }

    try {
      setSubmitting(true);
      await vacanciesService.createApplication({
        ...formData,
        resume_file: resumeFile || undefined,
      });
      toast.success('Отклик успешно отправлен! Мы свяжемся с вами в ближайшее время.');
      
      // Reset form
      setFormData({
        vacancy: id || '',
        full_name: '',
        phone: '',
        email: '',
        message: '',
      });
      setResumeFile(null);
      setErrors({});
    } catch (error: any) {
      console.error('Failed to submit application:', error);
      toast.error(error.message || 'Ошибка отправки отклика. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
      setErrors(prev => ({ ...prev, resume_file: '' }));
    }
  };

  const formatSalary = (min?: number, max?: number): string => {
    if (!min && !max) return 'По договоренности';
    if (min && max) return `${min.toLocaleString('ru-RU')} - ${max.toLocaleString('ru-RU')} ₸`;
    if (min) return `от ${min.toLocaleString('ru-RU')} ₸`;
    if (max) return `до ${max.toLocaleString('ru-RU')} ₸`;
    return 'По договоренности';
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-4 py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-gray-600">Загрузка вакансии...</span>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!vacancy) {
    return (
      <>
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-4 py-12">
            <div className="text-center">
              <p className="text-gray-600">Вакансия не найдена</p>
              <Link to="/construction/vacancies" className="text-blue-600 hover:underline mt-4 inline-block">
                Вернуться к списку вакансий
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Breadcrumbs */}
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex items-center gap-2 text-sm text-gray-600">
              <Link to="/" className="hover:text-blue-600 transition-colors">Главная</Link>
              <span>/</span>
              <Link to="/construction" className="hover:text-blue-600 transition-colors">Строительство</Link>
              <span>/</span>
              <Link to="/construction/vacancies" className="hover:text-blue-600 transition-colors">Вакансии</Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">{vacancy.title}</span>
            </nav>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="mb-6">
            <Link
              to="/construction/vacancies"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Вернуться к списку вакансий</span>
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 mb-8">
                <div className="flex items-start justify-between mb-6">
                  <h1 className="text-3xl font-bold text-gray-900">{vacancy.title}</h1>
                  <span className="px-4 py-2 bg-green-50 text-green-600 text-sm font-semibold rounded-full">
                    Открыта
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-3 text-gray-600">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <span>{vacancy.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <span>{formatSalary(vacancy.salary_min, vacancy.salary_max)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span>{vacancy.employment_type_display || vacancy.employment_type}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    <span>Опубликована {vacancy.published_at ? new Date(vacancy.published_at).toLocaleDateString('ru-RU') : ''}</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">Описание</h2>
                    <p className="text-gray-700 whitespace-pre-line">{vacancy.description}</p>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">Обязанности</h2>
                    <p className="text-gray-700 whitespace-pre-line">{vacancy.responsibilities}</p>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">Требования</h2>
                    <p className="text-gray-700 whitespace-pre-line">{vacancy.requirements}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Form */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 sticky top-24">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Откликнуться на вакансию</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                      ФИО <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, full_name: e.target.value }));
                        setErrors(prev => ({ ...prev, full_name: '' }));
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.full_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Иванов Иван Иванович"
                    />
                    {errors.full_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Телефон <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, phone: e.target.value }));
                        setErrors(prev => ({ ...prev, phone: '' }));
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="+7 (XXX) XXX-XX-XX"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, email: e.target.value }));
                        setErrors(prev => ({ ...prev, email: '' }));
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="example@email.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                      Сообщение
                    </label>
                    <textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, message: e.target.value }));
                      }}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Расскажите о себе..."
                    />
                  </div>

                  <div>
                    <label htmlFor="resume_file" className="block text-sm font-medium text-gray-700 mb-1">
                      Резюме (PDF, DOC, DOCX, JPG, PNG)
                    </label>
                    <div className="mt-1">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Нажмите для загрузки</span> или перетащите файл
                          </p>
                          <p className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, PNG (макс. 10 МБ)</p>
                        </div>
                        <input
                          type="file"
                          id="resume_file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleFileChange}
                        />
                      </label>
                      {resumeFile && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-700 flex-1 truncate">{resumeFile.name}</span>
                          <button
                            type="button"
                            onClick={() => setResumeFile(null)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {errors.resume_file && (
                        <p className="mt-1 text-sm text-red-600">{errors.resume_file}</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Отправка...</span>
                      </>
                    ) : (
                      'Отправить отклик'
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

