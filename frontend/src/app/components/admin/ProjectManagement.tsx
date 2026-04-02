import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, Filter, Building2 } from 'lucide-react';
import { projectsService, Project } from '../../services/projects';
import { ProjectCategory } from '../../types/projects';
import { toast } from 'sonner';

interface ProjectManagementProps {
  onCreate: () => void;
  onEdit: (project: Project) => void | Promise<void>;
  refreshTrigger?: number;
}

export function ProjectManagement({ onCreate, onEdit, refreshTrigger }: ProjectManagementProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPublished, setFilterPublished] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterCategory !== 'all') {
        params.category = filterCategory;
      }
      if (filterPublished !== 'all') {
        params.is_published = filterPublished === 'published';
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      // For admin, we want to see all projects, so we don't filter by is_published in the service
      const data = await projectsService.getProjects(params);
      setProjects(data);
    } catch (error: any) {
      console.error('Failed to fetch projects:', error);
      toast.error('Ошибка загрузки проектов');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterPublished, searchQuery]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects, refreshTrigger]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await projectsService.getProjectCategories();
        setCategories(data);
      } catch (error: any) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот проект?')) {
      return;
    }

    try {
      await projectsService.deleteProject(id);
      toast.success('Проект успешно удален');
      fetchProjects();
    } catch (error: any) {
      console.error('Failed to delete project:', error);
      toast.error('Ошибка удаления проекта');
    }
  };

  const getPublishedBadge = (isPublished: boolean) => {
    if (isPublished) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          Опубликован
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
        Не опубликован
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Управление проектами</h2>
          <p className="text-gray-600 mt-1">Создание и редактирование проектов</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Создать проект</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Поиск по названию, описанию, местоположению..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showFilters
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Фильтры</span>
            </button>
            {showFilters && (
              <>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Все категории</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterPublished}
                  onChange={(e) => setFilterPublished(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Все статусы</option>
                  <option value="published">Опубликованные</option>
                  <option value="unpublished">Неопубликованные</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Проекты не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Категория
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Местоположение
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Год
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата создания
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{project.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {project.category?.name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{project.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{project.year}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPublishedBadge(project.is_published)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {project.created_at
                          ? new Date(project.created_at).toLocaleDateString('ru-RU')
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(project)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

