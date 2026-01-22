import { useState, useEffect } from 'react';
import { Search, Upload, Download, Eye, Edit, Trash2, X, FileText, Award, Calendar, User, BookOpen, CheckCircle, Clock } from 'lucide-react';
import { Certificate, CertificateTemplate, PendingCertificate } from '../../types/lms';
import { certificatesService } from '../../services/certificates';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { CertificateEditModal } from './CertificateEditModal';

export function CertificateManagement() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'uploaded' | 'pending'>('uploaded');
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [pendingCertificates, setPendingCertificates] = useState<PendingCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPending, setSelectedPending] = useState<PendingCertificate | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'uploaded') {
        const data = await certificatesService.getCertificates();
        setCertificates(data);
      } else {
        const data = await certificatesService.getPendingCertificates();
        setPendingCertificates(data);
      }
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
      toast.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = (pending: PendingCertificate) => {
    setSelectedPending(pending);
    setSelectedCertificate(null);
    setShowUploadModal(true);
  };

  const handleReplace = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setSelectedPending(null);
    setShowUploadModal(true);
  };

  const handleEdit = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setSelectedPending(null);
    setShowEditModal(true);
  };

  const handleDelete = async (certificateId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот сертификат?')) {
      return;
    }

    try {
      await certificatesService.deleteCertificate(certificateId);
      toast.success('Сертификат удален');
      fetchData();
    } catch (error) {
      console.error('Failed to delete certificate:', error);
      toast.error('Ошибка при удалении сертификата');
    }
  };

  const filteredCertificates = certificates.filter(cert => {
    const studentName = cert.student?.full_name || cert.userName || '';
    const courseOrTestName = cert.course?.title || cert.courseName || cert.test?.title || cert.testName || '';
    const number = cert.number || '';
    const query = searchQuery.toLowerCase();
    return (
      studentName.toLowerCase().includes(query) ||
      courseOrTestName.toLowerCase().includes(query) ||
      number.toLowerCase().includes(query)
    );
  });

  const filteredPending = pendingCertificates.filter(pending => {
    const studentName = pending.student?.full_name || pending.student?.fullName || '';
    const courseName = pending.course?.title || '';
    const query = searchQuery.toLowerCase();
    return (
      studentName.toLowerCase().includes(query) ||
      courseName.toLowerCase().includes(query)
    );
  });

  const getFileUrl = (certificate: Certificate): string | null => {
    if (certificate.file) {
      // If file is a full URL, return it; otherwise construct URL
      if (certificate.file.startsWith('http')) {
        return certificate.file;
      }
      return `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${certificate.file}`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('uploaded')}
                className={`px-6 py-4 font-medium text-sm transition-colors ${
                  activeTab === 'uploaded'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Загруженные сертификаты ({certificates.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-6 py-4 font-medium text-sm transition-colors ${
                  activeTab === 'pending'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Требуют загрузки ({pendingCertificates.length})
                </div>
              </button>
            </div>
          </div>
        </div>

      {/* Search */}
      <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по студенту, курсу или номеру сертификата..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

      {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : activeTab === 'uploaded' ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Студент
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Курс
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Номер сертификата
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата загрузки
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Файл
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCertificates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Нет загруженных сертификатов
                      </td>
                    </tr>
                  ) : (
                    filteredCertificates.map((cert) => {
                      const fileUrl = getFileUrl(cert);
                      return (
                        <tr key={cert.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <User className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="text-sm font-medium text-gray-900">
                                {cert.student?.full_name || cert.userName || 'Неизвестно'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <BookOpen className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-900">
                                {cert.course?.title || cert.courseName || cert.test?.title || cert.testName || 'Неизвестно'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {cert.number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {cert.uploaded_at
                              ? new Date(cert.uploaded_at).toLocaleDateString('ru-RU')
                              : cert.uploadedAt
                              ? new Date(cert.uploadedAt).toLocaleDateString('ru-RU')
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {fileUrl ? (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                              >
                                <FileText className="w-4 h-4" />
                                <span className="text-sm">Открыть</span>
                              </a>
                            ) : (
                              <span className="text-sm text-gray-400">Нет файла</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {fileUrl && (
                                <a
                                  href={fileUrl}
                                  download
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Скачать"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              )}
                              <button
                                onClick={() => handleEdit(cert)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Редактировать"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(cert.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Удалить"
                              >
                                <Trash2 className="w-4 h-4" />
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
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Студент
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Курс
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата завершения
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPending.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        Нет студентов, требующих загрузки сертификата
                      </td>
                    </tr>
                  ) : (
                    filteredPending.map((pending) => (
                      <tr key={pending.enrollment_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">
                              {pending.student?.full_name || pending.student?.fullName || 'Неизвестно'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <BookOpen className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {pending.course?.title || 'Неизвестно'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pending.completed_at
                            ? new Date(pending.completed_at).toLocaleDateString('ru-RU')
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {pending.has_certificate_record ? (
                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                              Запись без файла
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              Нет записи
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleUpload(pending)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            Загрузить сертификат
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadCertificateModal
          pending={selectedPending}
          certificate={selectedCertificate}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedPending(null);
            setSelectedCertificate(null);
          }}
          onSuccess={() => {
            setShowUploadModal(false);
            setSelectedPending(null);
            setSelectedCertificate(null);
            fetchData();
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedCertificate && (
        <CertificateEditModal
          certificate={selectedCertificate}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCertificate(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedCertificate(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

interface UploadCertificateModalProps {
  pending: PendingCertificate | null;
  certificate: Certificate | null;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadCertificateModal({ pending, certificate, onClose, onSuccess }: UploadCertificateModalProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const data = await certificatesService.getTemplates();
      setTemplates(data.filter(t => t.is_active));
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Выберите файл для загрузки');
      return;
    }

    try {
      setLoading(true);
      
      if (certificate) {
        // Update existing certificate
        await certificatesService.updateCertificate(certificate.id, {
          file: file,
          templateId: templateId || undefined,
        });
        toast.success('Сертификат обновлен');
      } else if (pending) {
        // Create or update certificate
        await certificatesService.uploadCertificate(
          pending.certificate_id || null,
          file,
          templateId || undefined,
          pending.student?.id || pending.student?.id,
          pending.course?.id
        );
        toast.success('Сертификат загружен');
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('Failed to upload certificate:', error);
      toast.error(error.message || 'Ошибка при загрузке сертификата');
    } finally {
      setLoading(false);
    }
  };

  const studentName = pending?.student?.full_name || pending?.student?.fullName || certificate?.student?.full_name || certificate?.userName || 'Неизвестно';
  const courseOrTestName = pending?.course?.title || certificate?.course?.title || certificate?.courseName || certificate?.test?.title || certificate?.testName || 'Неизвестно';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {certificate ? 'Заменить сертификат' : 'Загрузить сертификат'}
              </h2>
              <p className="text-gray-600">
                Студент: <span className="font-semibold">{studentName}</span>
              </p>
              <p className="text-gray-600">
                {certificate?.test || pending?.course ? 'Тест' : 'Курс'}: <span className="font-semibold">{courseOrTestName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Template Selection */}
            {!loadingTemplates && templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Шаблон (опционально)
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Без шаблона</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Файл сертификата *
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
                <div className="space-y-1 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Выберите файл</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        onChange={(e) => {
                          const selectedFile = e.target.files?.[0];
                          if (selectedFile) {
                            setFile(selectedFile);
                          }
                        }}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                    </label>
                    <p className="pl-1">или перетащите сюда</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF, JPG, PNG, DOC, DOCX до 10MB</p>
                  {file && (
                    <p className="text-sm text-gray-900 mt-2">
                      Выбран: <span className="font-medium">{file.name}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Загрузка...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {certificate ? 'Заменить' : 'Загрузить'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
