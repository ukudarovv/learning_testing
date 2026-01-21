import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BookOpen, FileQuestion, Award, Settings, TrendingUp, Plus, Search, Filter, Download, Edit, Trash2, Eye, X, CheckCircle, XCircle, UserPlus, Tag, FileText, Mail, RotateCcw, Ban, Building2, Handshake, Video } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { UserEditor } from '../admin/UserEditor';
import { UserManagement } from '../admin/UserManagement';
import { LicenseManagement } from '../admin/LicenseManagement';
import { LicenseEditor } from '../admin/LicenseEditor';
import { ContactManagement } from '../admin/ContactManagement';
import { ExtraAttemptRequests } from '../admin/ExtraAttemptRequests';
import { TestAttemptsManagement } from '../admin/TestAttemptsManagement';
import { AddStudentsToCourseModal } from '../admin/AddStudentsToCourseModal';
import { VacancyManagement } from '../admin/VacancyManagement';
import { VacancyApplications } from '../admin/VacancyApplications';
import { VacancyStatistics } from '../admin/VacancyStatistics';
import { VacancyEditor } from '../admin/VacancyEditor';
import { ProjectManagement } from '../admin/ProjectManagement';
import { ProjectEditor } from '../admin/ProjectEditor';
import { ProjectCategoryManagement } from '../admin/ProjectCategoryManagement';
import { LicenseCategoryManagement } from '../admin/LicenseCategoryManagement';
import { PartnerManagement } from '../admin/PartnerManagement';
import { PartnerEditor } from '../admin/PartnerEditor';
import { CertificateManagement } from '../admin/CertificateManagement';
import { ContentPageEditor } from '../admin/ContentPageEditor';
import { Course, Test, User } from '../../types/lms';
import { License, licensesService } from '../../services/licenses';
import { Vacancy, vacanciesService } from '../../services/vacancies';
import { Project, ProjectDetail, projectsService } from '../../services/projects';
import { Partner, partnersService } from '../../services/partners';
import { useAnalytics, useEnrollmentTrend, useTestResultsDistribution, useCoursesPopularity, useTopStudents } from '../../hooks/useAnalytics';
import { useCourses } from '../../hooks/useCourses';
import { useTests } from '../../hooks/useTests';
import { coursesService } from '../../services/courses';
import { testsService } from '../../services/tests';
import { usersService } from '../../services/users';
import { categoriesService, Category } from '../../services/categories';
import { TablePagination } from '../ui/TablePagination';
import { toast } from 'sonner';

function getStatusText(status: string, t: (key: string) => string): string {
  const statusKeyMap: Record<string, string> = {
    'in_development': 'admin.dashboard.status.inDevelopment',
    'draft': 'admin.dashboard.status.draft',
    'published': 'admin.dashboard.status.published',
    'assigned': 'admin.dashboard.status.assigned',
    'in_progress': 'admin.dashboard.status.inProgress',
    'exam_available': 'admin.dashboard.status.examAvailable',
    'exam_passed': 'admin.dashboard.status.examPassed',
    'completed': 'admin.dashboard.status.completed',
    'failed': 'admin.dashboard.status.failed',
    'annulled': 'admin.dashboard.status.annulled',
  };
  const key = statusKeyMap[status];
  return key ? t(key) : status;
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'overview' | 'courses' | 'users' | 'tests' | 'reports' | 'categories' | 'licenses' | 'license-categories' | 'contacts' | 'extra-attempts' | 'test-attempts' | 'vacancies' | 'vacancy-applications' | 'vacancy-statistics' | 'projects' | 'project-categories' | 'partners' | 'certificates' | 'content-pages'>('overview');
  const [showUserEditor, setShowUserEditor] = useState(false);
  const [showLicenseEditor, setShowLicenseEditor] = useState(false);
  const [showVacancyEditor, setShowVacancyEditor] = useState(false);
  const [showProjectEditor, setShowProjectEditor] = useState(false);
  const [showPartnerEditor, setShowPartnerEditor] = useState(false);
  const [showContentPageEditor, setShowContentPageEditor] = useState(false);
  const [editingContentPageType, setEditingContentPageType] = useState<'terms' | 'privacy' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [vacanciesRefreshTrigger, setVacanciesRefreshTrigger] = useState(0);
  const [projectsRefreshTrigger, setProjectsRefreshTrigger] = useState(0);
  const [partnersRefreshTrigger, setPartnersRefreshTrigger] = useState(0);
  const [selectedCourseForStudents, setSelectedCourseForStudents] = useState<any>(null);
  const [coursesRefetch, setCoursesRefetch] = useState<(() => void) | null>(null);
  const [testsRefetch, setTestsRefetch] = useState<(() => void) | null>(null);
  const [usersRefreshTrigger, setUsersRefreshTrigger] = useState(0);
  const [licensesRefreshTrigger, setLicensesRefreshTrigger] = useState(0);

  const handleCreateCourse = () => {
    navigate('/admin/courses/new/edit');
  };

  const handleEditCourse = (course: Course) => {
    // Навигируем на страницу редактирования курса
    navigate(`/admin/courses/${course.id}/edit`);
  };


  const handleCreateTest = () => {
    navigate('/admin/tests/new');
  };

  const handleEditTest = async (test: Test) => {
    try {
      // Навигируем на страницу редактирования теста
      navigate(`/admin/tests/${test.id}/edit`);
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.messages.testLoadError')}: ${error.message || t('admin.dashboard.messages.unknownError')}`);
      console.error('Failed to load test:', error);
    }
  };


  const handleCreateUser = () => {
    setEditingItem(null);
    setShowUserEditor(true);
  };

  const handleEditUser = (user: any) => {
    setEditingItem(user);
    setShowUserEditor(true);
  };

  const handleCreateLicense = () => {
    setEditingItem(null);
    setShowLicenseEditor(true);
  };

  const handleEditLicense = (license: License) => {
    setEditingItem(license);
    setShowLicenseEditor(true);
  };

  const handleSaveLicense = async (license: Partial<License>, file?: File) => {
    try {
      if (editingItem) {
        await licensesService.updateLicense(editingItem.id, license, file);
        toast.success(t('admin.dashboard.messages.licenseUpdateSuccess'));
      } else {
        await licensesService.createLicense(license, file);
        toast.success(t('admin.dashboard.messages.licenseCreateSuccess'));
      }
      setShowLicenseEditor(false);
      setEditingItem(null);
      setLicensesRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.messages.licenseSaveError')}: ${error.message || t('admin.dashboard.messages.unknownError')}`);
      console.error('Failed to save license:', error);
    }
  };

  const handleSaveUser = async (user: Partial<User & { password?: string }>) => {
    try {
      if (editingItem) {
        await usersService.updateUser(editingItem.id, user);
        toast.success(t('admin.dashboard.messages.userUpdateSuccess'));
      } else {
        const createdUser = await usersService.createUser(user);
        const password = createdUser.generated_password || user.password;
        const userName = user.fullName || user.full_name || user.phone || t('admin.users.userLower');
        
        // Показываем пароль после создания
        if (password) {
          toast.success(
            t('admin.dashboard.messages.userCreated', { name: userName }),
            {
              description: t('admin.dashboard.messages.passwordCopy', { password }),
              duration: 15000, // Показывать 15 секунд
            }
          );
          
          // Также показываем в консоли для удобства копирования
          console.log(`\n=== Пользователь создан ===`);
          console.log(`Имя: ${userName}`);
          console.log(`Телефон: ${user.phone}`);
          console.log(`Email: ${user.email || 'не указан'}`);
          console.log(`Пароль: ${password}`);
          console.log(`========================\n`);
        } else {
          toast.success(t('admin.dashboard.messages.userCreateSuccess'));
        }
      }
      setShowUserEditor(false);
      setEditingItem(null);
      // Обновление списка пользователей
      setUsersRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.messages.userSaveError')}: ${error.message || t('admin.dashboard.messages.unknownError')}`);
      console.error('Failed to save user:', error);
    }
  };

  const handleCreateVacancy = () => {
    setEditingItem(null);
    setShowVacancyEditor(true);
  };

  const handleEditVacancy = (vacancy: Vacancy) => {
    setEditingItem(vacancy);
    setShowVacancyEditor(true);
  };

  const handleSaveVacancy = async (vacancy: Partial<Vacancy>) => {
    try {
      if (editingItem) {
        await vacanciesService.updateVacancy(editingItem.id, vacancy);
        toast.success(t('admin.dashboard.messages.vacancyUpdateSuccess'));
      } else {
        await vacanciesService.createVacancy(vacancy);
        toast.success(t('admin.dashboard.messages.vacancyCreateSuccess'));
      }
      setShowVacancyEditor(false);
      setEditingItem(null);
      setVacanciesRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.messages.vacancySaveError')}: ${error.message || t('admin.dashboard.messages.unknownError')}`);
      console.error('Failed to save vacancy:', error);
    }
  };

  const handleCreateProject = () => {
    setEditingItem(null);
    setShowProjectEditor(true);
  };

  const handleEditProject = async (project: Project) => {
    try {
      // Загружаем полную информацию о проекте для редактирования
      const projectDetail = await projectsService.getProject(project.id);
      setEditingItem(projectDetail);
      setShowProjectEditor(true);
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.messages.projectLoadError')}: ${error.message || t('admin.dashboard.messages.unknownError')}`);
      console.error('Failed to load project details:', error);
    }
  };

  const handleSaveProject = async (project: Partial<Project>, imageFile?: File): Promise<Project> => {
    try {
      if (!project.title?.trim()) {
        toast.error(t('admin.dashboard.messages.projectTitleRequired'));
        throw new Error(t('admin.dashboard.messages.projectTitleRequiredError'));
      }
      
      let savedProject: Project;
      if (editingItem) {
        savedProject = await projectsService.updateProject(editingItem.id, project, imageFile);
        toast.success(t('admin.dashboard.messages.projectUpdateSuccess'));
      } else {
        savedProject = await projectsService.createProject(project, imageFile);
        toast.success(t('admin.dashboard.messages.projectCreateSuccess'));
      }
      setShowProjectEditor(false);
      setEditingItem(null);
      setProjectsRefreshTrigger(prev => prev + 1);
      return savedProject;
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.messages.projectSaveError')}: ${error.message || t('admin.dashboard.messages.unknownError')}`);
      console.error('Failed to save project:', error);
      throw error;
    }
  };

  const handleCreatePartner = () => {
    setEditingItem(null);
    setShowPartnerEditor(true);
  };

  const handleEditPartner = (partner: Partner) => {
    setEditingItem(partner);
    setShowPartnerEditor(true);
  };

  const handleSavePartner = async (partner: Partial<Partner>, logoFile?: File): Promise<Partner> => {
    try {
      if (!partner.name?.trim()) {
        toast.error(t('partners.nameRequired'));
        throw new Error(t('partners.nameRequired'));
      }

      let savedPartner: Partner;
      if (editingItem) {
        const formData = new FormData();
        formData.append('name', partner.name);
        if (partner.website) formData.append('website', partner.website);
        formData.append('order', String(partner.order || 0));
        formData.append('is_active', String(partner.is_active !== undefined ? partner.is_active : true));
        if (logoFile) formData.append('logo', logoFile);
        
        savedPartner = await partnersService.updatePartner(editingItem.id, formData);
        toast.success(t('partners.updateSuccess'));
      } else {
        const formData = new FormData();
        formData.append('name', partner.name);
        if (partner.website) formData.append('website', partner.website);
        formData.append('order', String(partner.order || 0));
        formData.append('is_active', String(partner.is_active !== undefined ? partner.is_active : true));
        if (logoFile) formData.append('logo', logoFile);
        
        savedPartner = await partnersService.createPartner(formData);
        toast.success(t('partners.createSuccess'));
      }
      setShowPartnerEditor(false);
      setEditingItem(null);
      setPartnersRefreshTrigger(prev => prev + 1);
      return savedPartner;
    } catch (error: any) {
      toast.error(`${t('partners.saveError')}: ${error.message || t('messages.error.generic')}`);
      console.error('Failed to save partner:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('admin.dashboard.title')}</h1>
          <p className="text-gray-600">{t('admin.dashboard.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 sticky top-24">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveSection('overview')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'overview'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.overview')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('courses')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'courses'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.courses')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('users')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'users'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.users')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('tests')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'tests'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileQuestion className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.tests')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('reports')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'reports'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Award className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.reports')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('certificates')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'certificates'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Award className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.certificates')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('categories')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'categories'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Tag className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.categories')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('licenses')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'licenses'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.licenses')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('license-categories')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'license-categories'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Tag className="w-5 h-5" />
                  <span className="font-medium">{t('admin.licenses.categories') || 'Категории лицензий'}</span>
                </button>
                <button
                  onClick={() => setActiveSection('contacts')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'contacts'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Mail className="w-5 h-5" />
                  <span className="font-medium">{t('admin.contacts.title')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('extra-attempts')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'extra-attempts'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <RotateCcw className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm leading-tight">{t('admin.extraAttempts.title')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('test-attempts')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'test-attempts'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Video className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm leading-tight">{t('admin.testAttempts.title') || 'Попытки тестов'}</span>
                </button>
                <button
                  onClick={() => setActiveSection('vacancies')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'vacancies'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.vacancies')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('vacancy-applications')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'vacancy-applications'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.vacancyApplications')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('vacancy-statistics')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'vacancy-statistics'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-medium">{t('admin.dashboard.navigation.vacancyStatistics')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('projects')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'projects'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                  <span className="font-medium">{t('admin.projects.title')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('project-categories')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'project-categories'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Tag className="w-5 h-5" />
                  <span className="font-medium">{t('admin.categories.title')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('partners')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'partners'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Handshake className="w-5 h-5" />
                  <span className="font-medium">{t('admin.partners.title')}</span>
                </button>
                <button
                  onClick={() => setActiveSection('content-pages')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === 'content-pages'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">{t('admin.contentPages.title') || 'Контентные страницы'}</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-4">
            {activeSection === 'overview' && (
              <OverviewSection 
                onCreateCourse={handleCreateCourse}
                onCreateTest={handleCreateTest}
                onCreateUser={handleCreateUser}
              />
            )}
            {activeSection === 'courses' && (
              <CoursesSection 
                onCreate={handleCreateCourse} 
                onEdit={handleEditCourse}
                onRefetch={(refetch) => setCoursesRefetch(() => refetch)}
              />
            )}
            {activeSection === 'users' && (
              <UserManagement 
                onCreate={handleCreateUser} 
                onEdit={handleEditUser}
                refreshTrigger={usersRefreshTrigger}
              />
            )}
            {activeSection === 'tests' && (
              <TestsSection 
                onCreate={handleCreateTest}
                onEdit={handleEditTest}
                onRefetch={(refetch) => setTestsRefetch(() => refetch)}
              />
            )}
            {activeSection === 'reports' && <ReportsSection />}
            {activeSection === 'categories' && <CategoriesSection />}
            {activeSection === 'licenses' && (
              <LicenseManagement
                onCreate={handleCreateLicense}
                onEdit={handleEditLicense}
                refreshTrigger={licensesRefreshTrigger}
              />
            )}
            {activeSection === 'license-categories' && (
              <LicenseCategoryManagement refreshTrigger={licensesRefreshTrigger} />
            )}
            {activeSection === 'contacts' && (
              <ContactManagement />
            )}
            {activeSection === 'certificates' && (
              <CertificateManagement />
            )}
            {activeSection === 'extra-attempts' && (
              <ExtraAttemptRequests />
            )}
            {activeSection === 'test-attempts' && (
              <TestAttemptsManagement />
            )}
            {activeSection === 'vacancies' && (
              <VacancyManagement
                onCreate={handleCreateVacancy}
                onEdit={handleEditVacancy}
                refreshTrigger={vacanciesRefreshTrigger}
              />
            )}
            {activeSection === 'vacancy-applications' && (
              <VacancyApplications />
            )}
            {activeSection === 'vacancy-statistics' && (
              <VacancyStatistics />
            )}
            {activeSection === 'projects' && (
              <ProjectManagement
                onCreate={handleCreateProject}
                onEdit={handleEditProject}
                refreshTrigger={projectsRefreshTrigger}
              />
            )}
            {activeSection === 'project-categories' && (
              <ProjectCategoryManagement refreshTrigger={projectsRefreshTrigger} />
            )}
            {activeSection === 'partners' && (
              <PartnerManagement
                onCreate={handleCreatePartner}
                onEdit={handleEditPartner}
                refreshTrigger={partnersRefreshTrigger}
              />
            )}
            {activeSection === 'content-pages' && (
              <ContentPagesSection 
                onEditTerms={() => {
                  setEditingContentPageType('terms');
                  setShowContentPageEditor(true);
                }}
                onEditPrivacy={() => {
                  setEditingContentPageType('privacy');
                  setShowContentPageEditor(true);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showUserEditor && (
        <UserEditor
          user={editingItem}
          onSave={handleSaveUser}
          onCancel={() => setShowUserEditor(false)}
        />
      )}

      {showLicenseEditor && (
        <LicenseEditor
          license={editingItem}
          onSave={handleSaveLicense}
          onCancel={() => {
            setShowLicenseEditor(false);
            setEditingItem(null);
          }}
        />
      )}

      {showVacancyEditor && (
        <VacancyEditor
          vacancy={editingItem}
          onSave={handleSaveVacancy}
          onCancel={() => {
            setShowVacancyEditor(false);
            setEditingItem(null);
          }}
        />
      )}

      {showProjectEditor && (
        <ProjectEditor
          project={editingItem}
          onSave={handleSaveProject}
          onCancel={() => {
            setShowProjectEditor(false);
            setEditingItem(null);
          }}
        />
      )}
      {showPartnerEditor && (
        <PartnerEditor
          partner={editingItem}
          onSave={handleSavePartner}
          onCancel={() => {
            setShowPartnerEditor(false);
            setEditingItem(null);
          }}
        />
      )}
      {showContentPageEditor && editingContentPageType && (
        <ContentPageEditor
          pageType={editingContentPageType}
          onSave={() => {
            setShowContentPageEditor(false);
            setEditingContentPageType(null);
            toast.success(t('admin.contentPages.saveSuccess') || 'Контент успешно сохранен');
          }}
          onCancel={() => {
            setShowContentPageEditor(false);
            setEditingContentPageType(null);
          }}
        />
      )}
    </div>
  );
}

function ContentPagesSection({ onEditTerms, onEditPrivacy }: { onEditTerms: () => void; onEditPrivacy: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {t('admin.contentPages.title') || 'Контентные страницы'}
      </h2>
      <p className="text-gray-600 mb-6">
        {t('admin.contentPages.description') || 'Редактируйте содержимое страниц "Условия использования" и "Политика конфиденциальности". Вы можете указать контент на трех языках: русском, казахском и английском.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('pages.terms.title') || 'Условия использования'}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {t('admin.contentPages.termsDescription') || 'Редактировать текст условий использования на всех языках'}
          </p>
          <button
            onClick={onEditTerms}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            {t('common.edit') || 'Редактировать'}
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('pages.privacy.title') || 'Политика конфиденциальности'}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {t('admin.contentPages.privacyDescription') || 'Редактировать текст политики конфиденциальности на всех языках'}
          </p>
          <button
            onClick={onEditPrivacy}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            {t('common.edit') || 'Редактировать'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewSection({ 
  onCreateCourse, 
  onCreateTest, 
  onCreateUser 
}: { 
  onCreateCourse: () => void;
  onCreateTest: () => void;
  onCreateUser: () => void;
}) {
  const { t } = useTranslation();
  const { stats, loading, error } = useAnalytics();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.dashboard.overview.loadingStats')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t('admin.dashboard.overview.loadStatsError')}: {error}</p>
        </div>
      </div>
    );
  }

  const statsData = stats ? [
    { label: t('admin.dashboard.overview.totalStudents'), value: stats.total_students, change: `${t('admin.dashboard.overview.activeStudents')}: ${stats.active_students}`, color: 'blue' },
    { label: t('admin.dashboard.overview.activeCourses'), value: stats.active_courses, change: `${t('admin.dashboard.overview.completedCourses')}: ${stats.completed_courses}`, color: 'green' },
    { label: t('admin.dashboard.overview.testsToday'), value: stats.tests_today, change: `${t('admin.dashboard.overview.successRate')}: ${stats.success_rate}%`, color: 'orange' },
    { label: t('admin.dashboard.overview.totalCertificates'), value: stats.total_certificates, change: `${t('admin.dashboard.overview.thisMonth')}: +${stats.certificates_this_month}`, color: 'purple' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600">{stat.label}</span>
              <span className="text-xs text-green-600 font-semibold">{stat.change}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('admin.dashboard.overview.recentActivity')}</h2>
        <div className="space-y-4">
          <div className="text-center py-8 text-gray-500">
            <p>{t('admin.dashboard.overview.activityWillBeDisplayed')}</p>
            <p className="text-sm mt-1">{t('admin.dashboard.overview.dataLoadingFromSystem')}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button 
          onClick={onCreateCourse}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left cursor-pointer"
        >
          <Plus className="w-8 h-8 text-blue-600 mb-3" />
          <h3 className="font-bold text-gray-900 mb-1">{t('admin.dashboard.overview.createCourse')}</h3>
          <p className="text-sm text-gray-600">{t('admin.dashboard.overview.createCourseDesc')}</p>
        </button>
        <button 
          onClick={onCreateUser}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left cursor-pointer"
        >
          <Users className="w-8 h-8 text-green-600 mb-3" />
          <h3 className="font-bold text-gray-900 mb-1">{t('admin.dashboard.overview.addStudent')}</h3>
          <p className="text-sm text-gray-600">{t('admin.dashboard.overview.addStudentDesc')}</p>
        </button>
        <button 
          onClick={onCreateTest}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left cursor-pointer"
        >
          <FileQuestion className="w-8 h-8 text-orange-600 mb-3" />
          <h3 className="font-bold text-gray-900 mb-1">{t('admin.dashboard.overview.createTest')}</h3>
          <p className="text-sm text-gray-600">{t('admin.dashboard.overview.createTestDesc')}</p>
        </button>
      </div>
    </div>
  );
}

function CoursesSection({ 
  onCreate, 
  onEdit,
  onRefetch 
}: { 
  onCreate: () => void, 
  onEdit: (course: Course) => void,
  onRefetch?: (refetch: () => void) => void
}) {
  const { t } = useTranslation();
  const [selectedCourseForStudents, setSelectedCourseForStudents] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Параметры для запроса с пагинацией
  const courseParams: any = {
    page: currentPage,
    page_size: pageSize,
  };
  if (searchQuery) courseParams.search = searchQuery;
  if (filterStatus !== 'all') courseParams.status = filterStatus;
  if (filterCategory !== 'all') courseParams.category = filterCategory;
  
  const { courses, pagination, loading, error, refetch } = useCourses(courseParams);
  const [courseStudentsCount, setCourseStudentsCount] = useState<Record<string, number>>({});
  
  // Загружаем категории
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await categoriesService.getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Передаем функцию refetch родительскому компоненту
  useEffect(() => {
    if (onRefetch && refetch) {
      onRefetch(refetch);
    }
  }, [onRefetch, refetch]);

  // Загружаем количество студентов для каждого курса
  useEffect(() => {
    const fetchStudentsCount = async () => {
      const counts: Record<string, number> = {};
      const coursesArray = Array.isArray(courses) ? courses : [];
      for (const course of coursesArray) {
        try {
          const students = await coursesService.getCourseStudents(course.id);
          counts[course.id] = students.length;
        } catch (err) {
          console.error(`Failed to fetch students for course ${course.id}:`, err);
          counts[course.id] = 0;
        }
      }
      setCourseStudentsCount(counts);
    };
    if (Array.isArray(courses) && courses.length > 0) {
      fetchStudentsCount();
    }
  }, [courses]);

  // Сбрасываем страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterCategory]);
  
  const coursesArray = Array.isArray(courses) ? courses : [];
  const totalPages = pagination.count ? Math.ceil(pagination.count / pageSize) : 1;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.dashboard.courses.loading')}</p>
        </div>
      </div>
    );
  }

  // Показываем ошибку, если есть
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{t('admin.dashboard.courses.loadError')}: {error}</p>
          <button 
            onClick={() => refetch && refetch()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('admin.dashboard.courses.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{t('admin.dashboard.courses.management')}</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" onClick={onCreate}>
            <Plus className="w-4 h-4" />
            {t('admin.courses.createCourse')}
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.dashboard.courses.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {t('admin.dashboard.courses.filters')}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.dashboard.courses.category')}</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">{t('admin.dashboard.courses.allCategories')}</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.dashboard.courses.status')}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">{t('admin.dashboard.courses.allStatuses')}</option>
                  <option value="in_development">{t('admin.dashboard.status.inDevelopment')}</option>
                  <option value="draft">{t('admin.dashboard.status.draft')}</option>
                  <option value="published">{t('admin.dashboard.status.published')}</option>
                </select>
              </div>

              <div className="flex items-end">
                <button 
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterCategory('all');
                    setSearchQuery('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
                >
                  {t('admin.dashboard.courses.resetFilters')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Courses Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.courseTitle')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.category')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.students')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.status')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {coursesArray.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    {searchQuery || filterStatus !== 'all' || filterCategory !== 'all' ? t('admin.dashboard.courses.coursesNotFound') : t('admin.dashboard.courses.noCourses')}
                  </td>
                </tr>
              ) : (
                coursesArray.map(course => {
                  const getCategoryName = (cat: any) => {
                    if (typeof cat === 'object' && cat !== null) {
                      return cat.name || cat.name_kz || cat.name_en || '—';
                    }
                    if (typeof cat === 'string') {
                      // Старый формат для обратной совместимости
                      const names: Record<string, string> = {
                        'industrial_safety': 'Промбезопасность',
                        'fire_safety': 'Пожарная безопасность',
                        'electrical_safety': 'Электробезопасность',
                        'labor_protection': 'Охрана труда',
                        'professions': 'Рабочие профессии',
                      };
                      return names[cat] || cat;
                    }
                    return '—';
                  };

                  const getStatusBadge = (status: string) => {
                    const statusMap: Record<string, { textKey: string; class: string }> = {
                      'in_development': { textKey: 'admin.dashboard.status.inDevelopment', class: 'bg-orange-100 text-orange-800' },
                      'draft': { textKey: 'admin.dashboard.status.draft', class: 'bg-gray-100 text-gray-800' },
                      'published': { textKey: 'admin.dashboard.status.published', class: 'bg-green-100 text-green-800' },
                      'assigned': { textKey: 'admin.dashboard.status.assigned', class: 'bg-blue-100 text-blue-800' },
                      'in_progress': { textKey: 'admin.dashboard.status.inProgress', class: 'bg-yellow-100 text-yellow-800' },
                      'completed': { textKey: 'admin.dashboard.status.completed', class: 'bg-green-100 text-green-800' },
                    };
                    const statusInfo = statusMap[status];
                    const text = statusInfo ? t(statusInfo.textKey) : getStatusText(status, t);
                    const className = statusInfo?.class || 'bg-gray-100 text-gray-800';
                    return (
                      <span className={`px-2 py-1 ${className} text-xs font-semibold rounded`}>
                        {text}
                      </span>
                    );
                  };

                  return (
                    <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">{course.title}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{getCategoryName(course.category)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-900">{courseStudentsCount[course.id] || 0}</span>
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(course.status)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium" onClick={() => onEdit(course)}>
                            {t('admin.dashboard.courses.edit')}
                          </button>
                          <button 
                            className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                            onClick={() => setSelectedCourseForStudents(course)}
                          >
                            {t('admin.dashboard.courses.studentsLabel')}
                          </button>
                          <button
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                            onClick={async () => {
                              if (window.confirm(t('admin.dashboard.courses.deleteConfirm', { title: course.title }))) {
                                try {
                                  await coursesService.deleteCourse(course.id);
                                  toast.success(t('admin.dashboard.courses.deleteSuccess'));
                                  if (refetch) {
                                    refetch();
                                  }
                                } catch (error: any) {
                                  toast.error(`${t('admin.dashboard.courses.deleteError')}: ${error.message || t('admin.dashboard.courses.deleteFailed')}`);
                                }
                              }
                            }}
                          >
                            {t('admin.dashboard.courses.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.count > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalCount={pagination.count}
            pageSize={pageSize}
          />
        )}
      </div>

      {/* Course Students Modal */}
      {selectedCourseForStudents && (
        <CourseStudentsModal 
          course={selectedCourseForStudents}
          onClose={() => setSelectedCourseForStudents(null)}
        />
      )}
    </div>
  );
}

function TestsSection({ 
  onCreate,
  onEdit,
  onRefetch 
}: { 
  onCreate: () => void,
  onEdit?: (test: Test) => void,
  onRefetch?: (refetch: () => void) => void
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  
  // Параметры для запроса с пагинацией
  const testParams: any = {
    page: currentPage,
    page_size: pageSize,
  };
  if (searchQuery) testParams.search = searchQuery;
  
  const { tests, pagination, loading, refetch } = useTests(testParams);

  // Передаем функцию refetch родительскому компоненту
  useEffect(() => {
    if (onRefetch && refetch) {
      onRefetch(refetch);
    }
  }, [onRefetch, refetch]);
  
  // Сбрасываем страницу при изменении поиска
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const testsArray = Array.isArray(tests) ? tests : [];
  const totalPages = pagination.count ? Math.ceil(pagination.count / pageSize) : 1;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.dashboard.tests.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('admin.dashboard.tests.constructor')}</h2>
          <p className="text-gray-600">{t('admin.dashboard.tests.management')}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" onClick={onCreate}>
          <Plus className="w-4 h-4" />
          {t('admin.tests.createTest')}
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={t('admin.dashboard.tests.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Tests List */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.tests.title')}</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.tests.questions')}</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.tests.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {testsArray.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-gray-500">
                  {searchQuery ? t('admin.dashboard.tests.testsNotFound') : t('admin.dashboard.tests.noTests')}
                </td>
              </tr>
            ) : (
              testsArray.map((test) => (
                <tr key={test.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{test.title}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-900">
                      {test.questions?.length || 0}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-2">
                      {onEdit && (
                        <button 
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          onClick={() => onEdit(test)}
                        >
                          {t('admin.dashboard.tests.edit')}
                        </button>
                      )}
                      <button
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                        onClick={async () => {
                          if (window.confirm(t('admin.dashboard.tests.deleteConfirm', { title: test.title }))) {
                            try {
                              await testsService.deleteTest(test.id);
                              toast.success(t('admin.dashboard.tests.deleteSuccess'));
                              if (refetch) {
                                refetch();
                              }
                            } catch (error: any) {
                              toast.error(`${t('admin.dashboard.tests.deleteError')}: ${error.message || t('admin.dashboard.tests.deleteFailed')}`);
                            }
                          }
                        }}
                      >
                        {t('admin.dashboard.tests.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {pagination.count > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalCount={pagination.count}
          pageSize={pageSize}
        />
      )}
    </div>
  );
}

function ReportsSection() {
  const { t } = useTranslation();
  const { stats, loading: statsLoading } = useAnalytics();
  const { data: enrollmentData, loading: enrollmentLoading } = useEnrollmentTrend();
  const { data: testResultsData, loading: testResultsLoading } = useTestResultsDistribution();
  const { data: coursesPopularity, loading: coursesPopularityLoading } = useCoursesPopularity();
  const { data: topStudents, loading: topStudentsLoading } = useTopStudents();

  const loading = statsLoading || enrollmentLoading || testResultsLoading || coursesPopularityLoading || topStudentsLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.dashboard.reports.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{t('admin.dashboard.reports.overallPerformance')}</span>
          </div>
          <div className="text-3xl font-bold text-green-600">{stats?.success_rate || 0}%</div>
          <p className="text-xs text-gray-500 mt-1">{t('admin.dashboard.reports.percentPassed')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{t('admin.dashboard.reports.averageScore')}</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">{stats?.avg_score || 0}</div>
          <p className="text-xs text-gray-500 mt-1">{t('admin.dashboard.reports.byAllAttempts')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{t('admin.dashboard.reports.completedCourses')}</span>
          </div>
          <div className="text-3xl font-bold text-purple-600">{stats?.completed_courses || 0}</div>
          <p className="text-xs text-gray-500 mt-1">{t('admin.dashboard.reports.totalCompleted')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{t('admin.dashboard.reports.activeStudents')}</span>
          </div>
          <div className="text-3xl font-bold text-orange-600">{stats?.active_students || 0}</div>
          <p className="text-xs text-gray-500 mt-1">{t('admin.dashboard.reports.ofTotal', { total: stats?.total_students || 0 })}</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollment Trend */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.dashboard.reports.enrollmentTrend')}</h3>
          {enrollmentData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>{t('admin.dashboard.reports.noData')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={enrollmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="students" stroke="#3b82f6" strokeWidth={2} name={t('admin.dashboard.reports.students')} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Test Results Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.dashboard.reports.testResultsDistribution')}</h3>
          {testResultsData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>{t('admin.dashboard.reports.noData')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={testResultsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {testResultsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{t('admin.dashboard.reports.coursesPopularity')}</h3>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            {t('admin.dashboard.reports.export')}
          </button>
        </div>
        {coursesPopularity.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>{t('admin.dashboard.reports.noData')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={coursesPopularity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="students" fill="#3b82f6" name={t('admin.dashboard.reports.studentsCount')} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Students Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.dashboard.reports.topStudents')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.reports.place')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.reports.fullName')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.reports.completedCourses')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.reports.averageScore')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.reports.certificates')}</th>
              </tr>
            </thead>
            <tbody>
              {topStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    {t('admin.dashboard.reports.noStudentsData')}
                  </td>
                </tr>
              ) : (
                topStudents.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {student.rank === 1 && <span className="text-2xl">🥇</span>}
                        {student.rank === 2 && <span className="text-2xl">🥈</span>}
                        {student.rank === 3 && <span className="text-2xl">🥉</span>}
                        {student.rank > 3 && <span className="font-bold text-gray-600">{student.rank}</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{student.name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-900">{student.courses}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-semibold text-green-600">{student.avg_score}%</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-900">{student.certificates}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.dashboard.reports.exportReports')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center gap-2 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
            <Download className="w-5 h-5" />
            <div className="text-left">
              <div className="font-semibold">{t('admin.dashboard.reports.summaryReport')}</div>
              <div className="text-xs text-gray-500">{t('admin.dashboard.reports.pdfExcel')}</div>
            </div>
          </button>
          <button className="flex items-center justify-center gap-2 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
            <Download className="w-5 h-5" />
            <div className="text-left">
              <div className="font-semibold">{t('admin.dashboard.reports.testResults')}</div>
              <div className="text-xs text-gray-500">{t('admin.dashboard.reports.excel')}</div>
            </div>
          </button>
          <button className="flex items-center justify-center gap-2 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
            <Download className="w-5 h-5" />
            <div className="text-left">
              <div className="font-semibold">{t('admin.dashboard.reports.issuedCertificates')}</div>
              <div className="text-xs text-gray-500">{t('admin.dashboard.reports.pdfExcel')}</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoriesSection() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await categoriesService.getCategories();
      setCategories(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('admin.dashboard.categories.loadError');
      setError(message);
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = () => {
    setEditingCategory(null);
    setShowEditor(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowEditor(true);
  };

  const handleSave = async (category: Partial<Category>) => {
    try {
      if (editingCategory) {
        await categoriesService.updateCategory(editingCategory.id, category);
        toast.success(t('admin.dashboard.categories.updateSuccess'));
      } else {
        await categoriesService.createCategory(category);
        toast.success(t('admin.dashboard.categories.createSuccess'));
      }
      setShowEditor(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.categories.saveError')}: ${error.message || t('admin.dashboard.messages.unknownError')}`);
      console.error('Failed to save category:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.dashboard.categories.deleteConfirm'))) {
      return;
    }
    try {
      await categoriesService.deleteCategory(id);
      toast.success(t('admin.dashboard.categories.deleteSuccess'));
      fetchCategories();
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.categories.deleteError')}: ${error.message || t('admin.dashboard.messages.unknownError')}`);
      console.error('Failed to delete category:', error);
    }
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cat.name_kz && cat.name_kz.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (cat.name_en && cat.name_en.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.dashboard.categories.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{t('admin.dashboard.categories.loadError')}: {error}</p>
          <button 
            onClick={fetchCategories} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('admin.dashboard.categories.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{t('admin.dashboard.categories.management')}</h2>
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" 
            onClick={handleCreate}
          >
            <Plus className="w-4 h-4" />
            {t('admin.dashboard.categories.editor.create')}
          </button>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('admin.dashboard.categories.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Categories Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.categories.name')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.categories.nameKz')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.categories.nameEn')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.categories.order')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.categories.courses')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.categories.status')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.categories.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    {searchQuery ? t('admin.dashboard.categories.categoriesNotFound') : t('admin.dashboard.categories.noCategories')}
                  </td>
                </tr>
              ) : (
                filteredCategories.map(category => (
                  <tr key={category.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{category.name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{category.name_kz || '—'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{category.name_en || '—'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-900">{category.order}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-900">{category.courses_count || 0}</span>
                    </td>
                    <td className="py-4 px-4">
                      {category.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          <CheckCircle className="w-3 h-3" />
                          {t('admin.dashboard.categories.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                          <XCircle className="w-3 h-3" />
                          {t('admin.dashboard.categories.inactive')}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <button 
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium" 
                          onClick={() => handleEdit(category)}
                        >
                          {t('admin.dashboard.categories.edit')}
                        </button>
                        <button
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                          onClick={() => handleDelete(category.id)}
                        >
                          {t('admin.dashboard.categories.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Editor Modal */}
      {showEditor && (
        <CategoryEditorModal
          category={editingCategory}
          onSave={handleSave}
          onCancel={() => {
            setShowEditor(false);
            setEditingCategory(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryEditorModal({ 
  category, 
  onSave, 
  onCancel 
}: { 
  category: Category | null;
  onSave: (category: Partial<Category>) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Category>>(category || {
    name: '',
    name_kz: '',
    name_en: '',
    description: '',
    order: 0,
    is_active: true,
  });

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
  }, [category?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) {
      toast.error(t('admin.dashboard.categories.editor.nameRequired'));
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {category ? t('admin.dashboard.categories.editor.edit') : t('admin.dashboard.categories.editor.create')}
            </h2>
            <button 
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.dashboard.categories.editor.nameRu')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('admin.dashboard.categories.editor.namePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.dashboard.categories.editor.nameKz')}
                </label>
                <input
                  type="text"
                  value={formData.name_kz}
                  onChange={(e) => setFormData({ ...formData, name_kz: e.target.value })}
                  placeholder={t('admin.dashboard.categories.editor.nameKzPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.dashboard.categories.editor.nameEn')}
                </label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  placeholder={t('admin.dashboard.categories.editor.nameEnPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.dashboard.categories.editor.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('admin.dashboard.categories.editor.descriptionPlaceholder')}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.dashboard.categories.editor.displayOrder')}
              </label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active !== undefined ? formData.is_active : true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">{t('admin.dashboard.categories.editor.active')}</span>
              </label>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('admin.dashboard.categories.editor.cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('admin.dashboard.categories.editor.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CourseStudentsModal({ course, onClose }: { course: any, onClose: () => void }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const data = await coursesService.getCourseStudents(course.id);
        setEnrollments(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || t('admin.dashboard.courses.courseStudents.loadError'));
        console.error('Failed to fetch course students:', err);
      } finally {
        setLoading(false);
      }
    };

    if (course?.id) {
      fetchStudents();
    }
  }, [course?.id]);

  const handleAddStudents = async (userIds: string[], deadline?: string) => {
    try {
      await coursesService.enrollStudents(course.id, userIds);
      // Обновляем список студентов
      const data = await coursesService.getCourseStudents(course.id);
      setEnrollments(data);
      setShowAddStudents(false);
      toast.success(t('admin.dashboard.courses.courseStudents.addSuccess'));
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.courses.courseStudents.addError')}: ${error.message || t('admin.dashboard.courses.courseStudents.addFailed')}`);
    }
  };

  const handleRevokeEnrollment = async (userId: string, studentName: string) => {
    if (!window.confirm(t('admin.dashboard.courses.courseStudents.revokeConfirm', { courseTitle: course.title, studentName }))) {
      return;
    }

    try {
      await coursesService.revokeEnrollment(course.id, userId);
      // Обновляем список студентов
      const data = await coursesService.getCourseStudents(course.id);
      setEnrollments(data);
      toast.success(t('admin.dashboard.courses.courseStudents.revokeSuccess'));
    } catch (error: any) {
      toast.error(`${t('admin.dashboard.courses.courseStudents.revokeError')}: ${error.message || t('admin.dashboard.courses.courseStudents.revokeFailed')}`);
    }
  };

  const students = enrollments.map(enrollment => {
    const student = enrollment.student || enrollment.user || enrollment;
    const courseData = enrollment.course || {};
    
    // Получаем средний балл из попыток тестов (если есть)
    // Пока используем прогресс как приблизительную оценку
    const score = enrollment.progress || 0;
    
    // ID пользователя для отзыва курса
    const userId = student?.id || enrollment.user?.id || enrollment.user || enrollment.id;
    
    return {
      id: userId,
      enrollmentId: enrollment.id, // ID enrollment для отслеживания
      name: student?.full_name || student?.fullName || t('admin.dashboard.courses.courseStudents.unknown'),
      email: student?.email || '',
      phone: student?.phone || '',
      company: student?.organization || '',
      progress: enrollment.progress || 0,
      score: score,
      status: enrollment.status || 'assigned',
      enrolledDate: enrollment.enrolled_at 
        ? new Date(enrollment.enrolled_at).toLocaleDateString('ru-RU')
        : '',
      completedDate: enrollment.completed_at
        ? new Date(enrollment.completed_at).toLocaleDateString('ru-RU')
        : null,
    };
  });

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const completedCount = students.filter(s => s.status === 'completed' || s.status === 'exam_passed').length;
  const inProgressCount = students.filter(s => s.status === 'in_progress' || s.status === 'assigned').length;
  const averageScore = students.length > 0 
    ? (students.reduce((sum, s) => sum + s.score, 0) / students.length).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('admin.dashboard.courses.courseStudents.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 p-8 max-w-md">
          <div className="text-center">
            <p className="text-red-600 mb-4">{t('admin.dashboard.courses.courseStudents.loadError')}: {error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('admin.dashboard.courses.courseStudents.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {t('admin.dashboard.courses.courseStudents.title')}
              </h2>
              <p className="text-gray-600">{course.title}</p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 mb-1">{t('admin.dashboard.courses.courseStudents.totalStudents')}</p>
              <p className="text-2xl font-bold text-blue-700">{students.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 mb-1">{t('admin.dashboard.courses.courseStudents.completed')}</p>
              <p className="text-2xl font-bold text-green-700">{completedCount}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-orange-600 mb-1">{t('admin.dashboard.courses.courseStudents.inProgress')}</p>
              <p className="text-2xl font-bold text-orange-700">{inProgressCount}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 mb-1">{t('admin.dashboard.courses.courseStudents.averageScore')}</p>
              <p className="text-2xl font-bold text-purple-700">{averageScore}%</p>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.dashboard.courses.courseStudents.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Students Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.courseStudents.student')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.courseStudents.contacts')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.courseStudents.company')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.courseStudents.progress')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.courseStudents.score')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.courseStudents.status')}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('admin.dashboard.courses.courseStudents.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium text-gray-900">{student.name}</div>
                        <div className="text-xs text-gray-500">
                          {t('admin.dashboard.courses.courseStudents.enrolled')}: {student.enrolledDate}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm space-y-1">
                        <div className="text-gray-600">{student.email}</div>
                        <div className="text-gray-500">{student.phone}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-900">{student.company}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              student.progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                            }`}
                            style={{ width: `${student.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{student.progress}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`font-semibold ${
                        student.score >= 90 ? 'text-green-600' :
                        student.score >= 80 ? 'text-blue-600' :
                        student.score >= 70 ? 'text-orange-600' :
                        'text-gray-600'
                      }`}>
                        {student.score}%
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        {student.status === 'completed' || student.status === 'exam_passed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded w-fit">
                            <CheckCircle className="w-3 h-3" />
                            {t('admin.dashboard.status.completed')}
                          </span>
                        ) : student.status === 'annulled' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded w-fit">
                            <XCircle className="w-3 h-3" />
                            {t('admin.dashboard.status.annulled')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded w-fit">
                            <BookOpen className="w-3 h-3" />
                            {getStatusText(student.status, t)}
                          </span>
                        )}
                        {student.completedDate && (
                          <span className="text-xs text-gray-500">
                            {student.completedDate}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {student.status !== 'annulled' && (
                        <button
                          onClick={() => handleRevokeEnrollment(student.id, student.name)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('admin.dashboard.courses.courseStudents.revokeTitle')}
                        >
                          <Ban className="w-4 h-4" />
                          {t('admin.dashboard.courses.courseStudents.revoke')}
                        </button>
                      )}
                      {student.status === 'annulled' && (
                        <span className="text-xs text-gray-500">{t('admin.dashboard.courses.courseStudents.revoked')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredStudents.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{t('admin.dashboard.courses.courseStudents.studentsNotFound')}</p>
                <p className="text-sm text-gray-400 mt-1">{t('admin.dashboard.courses.courseStudents.tryChangingSearch')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowAddStudents(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {t('admin.dashboard.courses.courseStudents.addStudents')}
            </button>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors">
                <Download className="w-4 h-4" />
                {t('admin.dashboard.courses.courseStudents.exportList')}
              </button>
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('admin.dashboard.courses.courseStudents.close')}
              </button>
            </div>
          </div>
        </div>

        {/* Add Students Modal */}
        {showAddStudents && (
          <AddStudentsToCourseModal
            course={course}
            onClose={() => setShowAddStudents(false)}
            onAdd={handleAddStudents}
          />
        )}
      </div>
    </div>
  );
}