import { ImageWithFallback } from './figma/ImageWithFallback';
import { Building2, Calendar, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { projectsService } from '../services/projects';
import { Project } from '../types/projects';

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        // Загружаем только первые 4 проекта для главной страницы
        const data = await projectsService.getProjects({ ordering: '-created_at' });
        setProjects(data.slice(0, 4));
      } catch (err: any) {
        console.error('Failed to load projects:', err);
        setError('Не удалось загрузить проекты');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return (
    <section id="projects" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-600 px-4 py-2 rounded-full mb-4">
            <Building2 className="w-5 h-5" />
            <span className="font-medium">Портфолио</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Выполненные работы
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Примеры успешно реализованных проектов в области проектирования и строительства
          </p>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Загрузка проектов...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">Проекты не найдены</p>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="grid md:grid-cols-2 gap-8">
            {projects.map((project) => (
              <article
                key={project.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group"
              >
                <div className="relative overflow-hidden h-64">
                  <ImageWithFallback
                    src={project.image_url || project.image}
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {project.category && (
                    <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {project.category.name}
                    </div>
                  )}
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{project.title}</h3>
                  <p className="text-gray-600 mb-4">{project.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{project.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{project.year}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
