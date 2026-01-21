import { useState, useEffect } from 'react';
import { Download, AlertCircle, Loader2 } from 'lucide-react';
import { PdfViewer } from './PdfViewer';
import { apiClient } from '../../services/api';

interface PPTViewerProps {
  url: string;
  title?: string;
  lessonId?: string | number;
}

export function PPTViewer({ url, title = 'PPT Презентация', lessonId }: PPTViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useDirectViewer, setUseDirectViewer] = useState(false);

  useEffect(() => {
    // If we have lessonId, try to get PDF preview from backend
    if (lessonId && url) {
      loadPdfPreview();
    } else {
      // Fallback: show error or use direct viewer
      setError('ID урока не указан. Невозможно загрузить PDF-превью.');
      setLoading(false);
    }
  }, [lessonId, url]);

  const loadPdfPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!lessonId) {
        console.error('PPTViewer: lessonId is missing');
        throw new Error('ID урока не указан');
      }

      // Ensure lessonId is a string (it might be a number)
      const lessonIdStr = String(lessonId);

      // Get PDF preview URL from backend
      // Use the same pattern as api.ts - VITE_API_URL should already contain /api
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      // Remove trailing slash and ensure we have /api
      const baseUrl = apiBaseUrl.replace(/\/$/, '').replace(/\/api$/, '');
      const convertUrl = `${baseUrl}/api/lessons/${lessonIdStr}/ppt-to-pdf/`;

      console.log('PPTViewer: Requesting PDF preview from:', convertUrl);

      // Build full PDF URL with authentication
      const token = apiClient.getToken();
      const headers: HeadersInit = {
        'Accept': 'application/pdf, */*',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('PPTViewer: Using authenticated request');
      } else {
        console.warn('PPTViewer: No authentication token found');
      }

      // Try to fetch PDF preview
      const response = await fetch(convertUrl, { 
        headers,
        method: 'GET'
      });

      console.log('PPTViewer: Response status:', response.status, response.statusText);

      if (response.ok) {
        // PDF is available, use it
        console.log('PPTViewer: PDF preview available, using it');
        setPdfUrl(convertUrl);
        setLoading(false);
      } else if (response.status === 503) {
        // Service unavailable - LibreOffice not installed
        const errorData = await response.json().catch(() => ({}));
        console.error('PPTViewer: Service unavailable (503)', errorData);
        throw new Error(errorData.error || 'Сервис конвертации недоступен. LibreOffice не установлен на сервере.');
      } else if (response.status === 404) {
        // Endpoint not found - check if it's a routing issue
        console.error('PPTViewer: Endpoint not found (404)', {
          url: convertUrl,
          lessonId,
          apiBaseUrl
        });
        throw new Error(`Эндпоинт конвертации не найден (404). URL: ${convertUrl}. Убедитесь, что сервер запущен и эндпоинт зарегистрирован.`);
      } else {
        // Other error
        const errorData = await response.json().catch(() => ({}));
        console.error('PPTViewer: Error fetching PDF preview', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `Не удалось получить PDF-превью: ${response.status} ${response.statusText}`);
      }
    } catch (err: any) {
      console.error('Error loading PDF preview:', err);
      setError(err.message || 'Ошибка загрузки PDF-превью');
      setLoading(false);
      // Fallback to direct viewer for .pptx files
      const urlLower = url.toLowerCase();
      if (urlLower.endsWith('.pptx')) {
        setUseDirectViewer(true);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Скачать PPT
          </a>
        </div>
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-100" style={{ height: '800px', position: 'relative' }}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Конвертация презентации в PDF...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !useDirectViewer) {
    const isServiceUnavailable = error.includes('LibreOffice') || error.includes('недоступен');
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Скачать PPT
          </a>
        </div>
        
        <div className={`border rounded-lg p-6 ${isServiceUnavailable ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isServiceUnavailable ? 'text-orange-600' : 'text-red-600'}`} />
            <div className="flex-1">
              <h3 className={`font-semibold mb-2 ${isServiceUnavailable ? 'text-orange-900' : 'text-red-900'}`}>
                {isServiceUnavailable ? 'Сервис конвертации недоступен' : 'Не удалось загрузить презентацию'}
              </h3>
              <p className={`text-sm mb-4 ${isServiceUnavailable ? 'text-orange-800' : 'text-red-800'}`}>
                {error}
              </p>
              {isServiceUnavailable && (
                <div className="bg-white rounded-lg p-4 mb-4 border border-orange-200">
                  <p className="text-sm text-orange-900">
                    Для просмотра презентаций в браузере необходимо установить LibreOffice на сервере.
                    В качестве альтернативы используйте кнопку "Скачать PPT" для просмотра файла на вашем устройстве.
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Скачать файл для просмотра
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show PDF preview if available
  if (pdfUrl) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Скачать оригинальный PPT
          </a>
        </div>
        <PdfViewer url={pdfUrl} title={title} />
      </div>
    );
  }

  // Fallback: show download link
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Скачать PPT
        </a>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-900 font-medium mb-1">Информация</p>
            <p className="text-xs text-blue-800">
              Используйте кнопку "Скачать PPT" для просмотра презентации на вашем устройстве.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
