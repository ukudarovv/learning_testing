import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/api';

// Import CSS styles for react-pdf (v10+)
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker - use CDN for production compatibility
// This ensures the worker file is always accessible, even after Vite build
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  title?: string;
  allowDownload?: boolean;
}

export function PdfViewer({ url, title = 'PDF Документ', allowDownload = false }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);

  useEffect(() => {
    // Load PDF as blob to handle authentication
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        let fullUrl = url;
        if (url.startsWith('/')) {
          // VITE_API_URL might already contain /api, so we need to handle it properly
          let apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
          // Remove trailing slash
          apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
          // If VITE_API_URL doesn't end with /api, add it
          if (!apiBaseUrl.endsWith('/api')) {
            apiBaseUrl = `${apiBaseUrl}/api`;
          }
          // Remove /api from apiBaseUrl since url already starts with /
          // and we need to build absolute URL without double /api
          const baseUrl = apiBaseUrl.replace(/\/api$/, '');
          fullUrl = `${baseUrl}${url}`;
        }

        const isLocal = fullUrl.includes('localhost') || fullUrl.includes('127.0.0.1');
        
        let blob: Blob;
        
        if (isLocal || url.startsWith('/')) {
          // Use authorized request for local files
          const token = apiClient.getToken();
          const headers: HeadersInit = {
            'Accept': 'application/pdf, */*',
          };

          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(fullUrl, { headers });

          if (!response.ok) {
            throw new Error(`Не удалось загрузить PDF: ${response.status} ${response.statusText}`);
          }

          blob = await response.blob();
        } else {
          // Public URL
          const response = await fetch(fullUrl);
          if (!response.ok) {
            throw new Error(`Не удалось загрузить PDF: ${response.status} ${response.statusText}`);
          }
          blob = await response.blob();
        }

        // Create object URL for the blob
        const objectUrl = URL.createObjectURL(blob);
        setPdfData(objectUrl);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError(err.message || 'Ошибка загрузки PDF');
        setLoading(false);
      }
    };

    if (url) {
      loadPdf();
    }

    // Cleanup object URL on unmount
    return () => {
      if (pdfData) {
        URL.revokeObjectURL(pdfData);
      }
    };
  }, [url]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setError(`Ошибка загрузки PDF: ${error.message}`);
    setLoading(false);
  };

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => (numPages ? Math.min(numPages, prev + 1) : prev));
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(3, prev + 0.25));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(0.5, prev - 0.25));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          {allowDownload && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Скачать PDF
            </a>
          )}
        </div>
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-100" style={{ height: '800px', position: 'relative' }}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Загрузка PDF...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          {allowDownload && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Скачать PDF
            </a>
          )}
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-2">Не удалось загрузить PDF</h3>
              <p className="text-sm text-red-800 mb-4">{error}</p>
              {allowDownload && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Скачать PDF для просмотра
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {numPages && (
            <span className="text-sm text-gray-600">
              Страница {pageNumber} из {numPages}
            </span>
          )}
          {allowDownload && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Скачать PDF
            </a>
          )}
        </div>
      </div>

      {/* Controls */}
      {numPages && numPages > 1 && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Уменьшить"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-700 px-2">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 3}
              className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Увеличить"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Предыдущая страница"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-gray-700 px-2 min-w-[100px] text-center">
              {pageNumber} / {numPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Следующая страница"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* PDF Document */}
      <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-100" style={{ minHeight: '800px', position: 'relative' }}>
        <div className="flex justify-center overflow-auto" style={{ maxHeight: '800px' }}>
          {pdfData && (
            <Document
              file={pdfData}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center h-full p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
