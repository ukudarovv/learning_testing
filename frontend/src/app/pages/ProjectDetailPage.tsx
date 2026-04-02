import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Calendar, MapPin, ArrowLeft, Users, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { projectsService } from '../services/projects';
import { ProjectDetail } from '../types/projects';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const data = await projectsService.getProject(id);
        console.log('Project data loaded:', data);
        console.log('Gallery images:', data.gallery_images);
        console.log('Gallery images count:', data.gallery_images?.length || 0);
        setProject(data);
      } catch (err: any) {
        console.error('Failed to load project:', err);
        setError('Не удалось загрузить проект');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-4 py-12">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Загрузка проекта...</p>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-4 py-12">
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error || 'Проект не найден'}</p>
              <Link
                to="/projects"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Вернуться к списку проектов
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  // Собираем все изображения: главное + галерея
  const galleryImages = project.gallery_images || [];
  console.log('Rendering with gallery images:', galleryImages);
  console.log('Gallery images length:', galleryImages.length);
  console.log('Project image_url:', project.image_url);
  console.log('Project image:', project.image);
  
  // Формируем массив всех изображений
  const allImages: Array<{ url: string; id: string | number }> = [];
  
  // Добавляем главное изображение, если оно есть
  const mainImageUrl = project.image_url || project.image;
  if (mainImageUrl) {
    allImages.push({ url: mainImageUrl, id: 'main' });
  }
  
  // Добавляем изображения галереи
  galleryImages.forEach((img) => {
    const imgUrl = img.image_url || img.image;
    if (imgUrl) {
      allImages.push({
        url: imgUrl,
        id: img.id,
      });
    }
  });
  
  console.log('All images array:', allImages);
  console.log('All images length:', allImages.length);
  console.log('Main image URL:', mainImageUrl);

  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Hero Section */}
        <div className="bg-gray-900 text-white py-16">
          <div className="container mx-auto px-4">
            <button
              onClick={() => navigate('/projects')}
              className="inline-flex items-center gap-2 text-blue-300 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Вернуться к списку проектов
            </button>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{project.title}</h1>
            <div className="flex flex-wrap gap-6 text-blue-200">
              {project.category && (
                <div className="inline-flex items-center gap-2 bg-blue-800 px-4 py-2 rounded-full">
                  {project.category.name}
                </div>
              )}
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                <span>{project.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{project.year}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Main Image / Gallery */}
              <div className="mb-8">
                {allImages.length > 0 ? (
                  <>
                    <button
                      onClick={() => {
                        setModalImageIndex(selectedImageIndex);
                        setIsImageModalOpen(true);
                      }}
                      className="relative rounded-xl overflow-hidden shadow-lg mb-4 cursor-zoom-in hover:opacity-90 transition-opacity block w-full bg-gray-200"
                      style={{ aspectRatio: '16/9', minHeight: '400px' }}
                    >
                      {(() => {
                        const imageUrl = allImages[selectedImageIndex]?.url || allImages[0]?.url;
                        console.log('Rendering main image with URL:', imageUrl);
                        return (
                          <ImageWithFallback
                            src={imageUrl}
                            alt={project.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error('Error loading main image:', imageUrl, e);
                            }}
                            onLoad={() => {
                              console.log('Main image loaded successfully:', imageUrl);
                            }}
                          />
                        );
                      })()}
                    </button>
                    {allImages.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {allImages.map((img, index) => {
                          console.log(`Rendering gallery image ${index} with URL:`, img.url);
                          return (
                            <button
                              key={`${img.id}-${index}`}
                              onClick={() => {
                                setSelectedImageIndex(index);
                                setModalImageIndex(index);
                                setIsImageModalOpen(true);
                              }}
                              className={`relative rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity bg-gray-200 ${
                                selectedImageIndex === index ? 'ring-2 ring-blue-600' : ''
                              }`}
                              style={{ aspectRatio: '16/9', minHeight: '100px' }}
                            >
                              <ImageWithFallback
                                src={img.url}
                                alt={`${project.title} - изображение ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error(`Error loading gallery image ${index}:`, img.url, e);
                                }}
                                onLoad={() => {
                                  console.log(`Gallery image ${index} loaded successfully:`, img.url);
                                }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl overflow-hidden shadow-lg mb-4 bg-gray-200 flex items-center justify-center" style={{ aspectRatio: '16/9', minHeight: '400px' }}>
                    <p className="text-gray-500">Изображения не загружены</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="bg-white rounded-xl shadow-md p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Описание проекта</h2>
                <div className="prose max-w-none">
                  <p className="text-gray-700 text-lg mb-4 break-words">{project.description}</p>
                  {project.full_description && (
                    <div className="text-gray-600 whitespace-pre-line break-words">
                      {project.full_description.split('\n').map((line, i) => (
                        <p key={i} className={`${i > 0 ? 'mt-2' : ''} break-words`}>{line}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Characteristics */}
              {project.characteristics && Object.keys(project.characteristics).length > 0 && (
                <div className="bg-white rounded-xl shadow-md p-8 mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Характеристики проекта</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(project.characteristics).map(([key, value]) => (
                      <div key={key} className="border-b border-gray-200 pb-3">
                        <div className="font-semibold text-gray-900 break-words">{key}</div>
                        <div className="text-gray-600 break-words">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Информация о проекте</h3>
                
                <div className="space-y-4">
                  {project.category && (
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Категория</div>
                      <div className="text-gray-900 font-medium">{project.category.name}</div>
                    </div>
                  )}
                  
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Местоположение</div>
                    <div className="text-gray-900 font-medium break-words">{project.location}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Год</div>
                    <div className="text-gray-900 font-medium">{project.year}</div>
                  </div>
                  
                  {project.timeline && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <Clock className="w-4 h-4" />
                        <span>Сроки выполнения</span>
                      </div>
                      <div className="text-gray-900 font-medium break-words">{project.timeline}</div>
                    </div>
                  )}
                  
                  {project.team && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <Users className="w-4 h-4" />
                        <span>Команда проекта</span>
                      </div>
                      <div className="text-gray-900 font-medium whitespace-pre-line break-words">{project.team}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />

      {/* Image Modal */}
      {isImageModalOpen && allImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <button
            onClick={() => setIsImageModalOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X className="w-8 h-8" />
          </button>
          
          {allImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setModalImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setModalImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full p-2"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          
          <div
            className="max-w-7xl max-h-full w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={allImages[modalImageIndex]?.url}
              alt={`${project.title} - изображение ${modalImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          
          {allImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
              {modalImageIndex + 1} / {allImages.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

