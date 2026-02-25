import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Award, FileText, Download, ExternalLink, Calendar, Search, ClipboardList } from 'lucide-react';
import { Certificate, Protocol } from '../../types/lms';
import { certificatesService } from '../../services/certificates';
import { protocolsService } from '../../services/protocols';
import { toast } from 'sonner';

export function DocumentsView() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [certsData, protocolsData] = await Promise.all([
          certificatesService.getCertificates(),
          protocolsService.getProtocols(),
        ]);
        setCertificates(certsData);
        setProtocols(protocolsData);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
        toast.error(t('lms.documents.loadError'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredCertificates = certificates.filter(cert => {
    const courseOrTestName = cert.courseName || cert.course?.title || cert.test?.title || cert.testName || '';
    const number = cert.number || '';
    const query = searchQuery.toLowerCase();
    return courseOrTestName.toLowerCase().includes(query) || number.toLowerCase().includes(query);
  });

  const filteredProtocols = protocols.filter(protocol => {
    const courseOrTestName = protocol.courseName || protocol.testName || '';
    const number = protocol.number || '';
    const query = searchQuery.toLowerCase();
    return courseOrTestName.toLowerCase().includes(query) || number.toLowerCase().includes(query);
  });

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('lms.documents.title')}</h1>
          <p className="text-gray-600">{t('lms.documents.subtitle')}</p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('lms.documents.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Certificates Section */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-600" />
                {t('lms.documents.certificates') || 'Сертификаты'}
              </h2>
              {filteredCertificates.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {searchQuery ? t('lms.documents.noCertificatesSearch') : t('lms.documents.noCertificates')}
                  </h3>
                  <p className="text-gray-600">
                    {searchQuery 
                      ? t('lms.documents.noCertificatesSearchDesc')
                      : t('lms.documents.noCertificatesDesc')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCertificates.map(cert => (
                    <CertificateCard key={cert.id} certificate={cert} />
                  ))}
                </div>
              )}
            </div>

            {/* Protocols Section */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-blue-600" />
                {t('lms.documents.protocols') || 'Протоколы'}
              </h2>
              {filteredProtocols.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {searchQuery ? t('lms.documents.noProtocolsSearch') : t('lms.documents.noProtocols')}
                  </h3>
                  <p className="text-gray-600">
                    {searchQuery 
                      ? t('lms.documents.noProtocolsSearchDesc')
                      : t('lms.documents.noProtocolsDesc')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProtocols.map(protocol => (
                    <ProtocolCard key={protocol.id} protocol={protocol} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CertificateCard({ certificate }: { certificate: Certificate }) {
  const { t } = useTranslation();
  
  const getFileUrl = (): string | null => {
    if (certificate.file) {
      // If file is a full URL, return it; otherwise construct URL
      if (certificate.file.startsWith('http')) {
        return certificate.file;
      }
      return `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${certificate.file}`;
    }
    return null;
  };

  const handleDownloadPDF = async () => {
    try {
      const fileUrl = getFileUrl();
      
      // If there's an uploaded file, download it directly
      if (fileUrl) {
        const response = await fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to download file');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificate_${certificate.number}.${blob.type.includes('pdf') ? 'pdf' : blob.type.split('/')[1] || 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(t('lms.documents.downloadSuccess'));
        return;
      }
      
      // Otherwise, generate PDF from backend
      const blob = await certificatesService.downloadCertificatePDF(certificate.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate_${certificate.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t('lms.documents.downloadSuccess'));
    } catch (error: any) {
      toast.error(error.message || t('lms.documents.downloadError'));
    }
  };
  
  const fileUrl = getFileUrl();

  // Use certificate number for verification URL (frontend route)
  const certificateNumber = certificate.number || '';
  const verifyUrl = `/verify/${certificateNumber}`;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {certificate.course?.title || certificate.courseName || certificate.test?.title || certificate.testName || ''}
              </h3>
              <p className="text-sm text-gray-600 mb-2">{t('lms.documents.certificateNumber', { number: certificate.number })}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{t('lms.documents.issued', { date: new Date(certificate.issued_at || certificate.issuedAt).toLocaleDateString('ru-RU') })}</span>
                </div>
                {certificate.valid_until || certificate.validUntil ? (
                  <div className="flex items-center gap-1 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{t('lms.documents.validUntil', { date: new Date(certificate.valid_until || certificate.validUntil).toLocaleDateString('ru-RU') })}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
            {t('lms.documents.valid')}
          </span>
        </div>

        {certificate.template && (
          <div className="mb-3 text-sm text-gray-600">
            <span className="font-medium">{t('lms.documents.template')}</span> {certificate.template.name}
          </div>
        )}
        
        <div className="flex flex-wrap gap-3">
          {fileUrl ? (
            <>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                {t('lms.documents.openFile')}
              </a>
              <button 
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                {t('lms.documents.download')}
              </button>
            </>
          ) : (
            <button 
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              {t('lms.documents.downloadPdf')}
            </button>
          )}
          <Link
            to={verifyUrl}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {t('lms.documents.verifyAuthenticity')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProtocolCard({ protocol }: { protocol: Protocol }) {
  const { t } = useTranslation();
  const hasUploadedFile = !!(protocol.file && String(protocol.file).trim());

  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '—';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const handleDownload = async () => {
    try {
      const { blob, filename } = await protocolsService.downloadProtocolFile(protocol);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t('lms.documents.protocolDownloadSuccess') || t('lms.documents.downloadSuccess'));
    } catch (error: any) {
      toast.error(error.message || t('lms.documents.protocolDownloadError') || t('lms.documents.downloadError'));
    }
  };

  const courseOrTestName = protocol.courseName || protocol.testName || '—';

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{courseOrTestName}</h3>
              <p className="text-sm text-gray-600 mb-2">{t('lms.documents.protocolNumber', { number: protocol.number }) || `Протокол №${protocol.number}`}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{t('lms.documents.examDate', { date: formatDate(protocol.examDate) }) || `Дата экзамена: ${formatDate(protocol.examDate)}`}</span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${protocol.result === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {protocol.result === 'passed' ? (t('lms.documents.passed') || 'Сдан') : (t('lms.documents.failed') || 'Не сдан')}
                </span>
              </div>
            </div>
          </div>
        </div>
        {hasUploadedFile && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('lms.documents.download')}
          </button>
        )}
      </div>
    </div>
  );
}

