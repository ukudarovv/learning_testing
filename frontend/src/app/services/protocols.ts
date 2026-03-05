import { apiClient, downloadBlob } from './api';
import { Protocol } from '../types/lms';
import { adaptProtocol } from '../utils/typeAdapters';

const protocolsService = {
  async getProtocols(params?: { user?: string; status?: string }): Promise<Protocol[]> {
    const data = await apiClient.get<any>('/protocols/', params);
    
    // Backend может возвращать данные в разных форматах:
    // 1. Прямой массив: [protocol1, protocol2, ...]
    // 2. Пагинированный ответ: { results: [...], count: N, next: ..., previous: ... }
    // 3. Объект с данными: { data: [...] }
    
    let protocolsArray: any[] = [];
    
    if (Array.isArray(data)) {
      protocolsArray = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.results)) {
        protocolsArray = data.results;
      } else if (Array.isArray(data.data)) {
        protocolsArray = data.data;
      } else if (Array.isArray(data.protocols)) {
        protocolsArray = data.protocols;
      } else {
        console.warn('Unexpected response format for protocols, returning empty array:', data);
      }
    } else {
      console.warn('Unexpected response format for protocols, returning empty array:', data);
    }
    
    // Адаптируем протоколы для фронтенда
    return protocolsArray.map(adaptProtocol);
  },

  async getProtocol(id: string): Promise<Protocol> {
    const data = await apiClient.get<any>(`/protocols/${id}/`);
    return adaptProtocol(data);
  },

  async requestSignature(protocolId: string): Promise<{ message: string; otp_expires_at?: string; otp_code?: string; debug?: boolean }> {
    return apiClient.post<{ message: string; otp_expires_at?: string; otp_code?: string; debug?: boolean }>(`/protocols/${protocolId}/request_signature/`);
  },

  async signProtocol(protocolId: string, otp: string): Promise<Protocol> {
    const data = await apiClient.post<any>(`/protocols/${protocolId}/sign/`, { otp });
    return adaptProtocol(data);
  },

  /** Подписать протокол ЭЦП через NCALayer */
  async signProtocolEDS(protocolId: string, signatureBase64: string): Promise<Protocol> {
    const data = await apiClient.post<any>(`/protocols/${protocolId}/sign_eds/`, {
      signature_base64: signatureBase64,
    });
    return adaptProtocol(data);
  },

  /** Скачивает загруженный админом файл протокола (любой формат: PDF, DOCX и т.д.) */
  async downloadProtocolFile(protocol: Protocol): Promise<{ blob: Blob; filename: string }> {
    const fileUrl = this.getFileUrl(protocol);
    if (!fileUrl) {
      throw new Error('Файл протокола не загружен');
    }

    const response = await fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${apiClient.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Не удалось загрузить файл протокола');
    }

    const blob = await response.blob();
    const path = typeof protocol.file === 'string' ? protocol.file : String(protocol.file || '');
    const filename = path.split('/').pop() || `protocol_${protocol.id}.pdf`;
    return { blob, filename };
  },

  /** Скачивает файл протокола через API (для подписания ЭЦП) */
  async fetchProtocolFileForEDS(protocolId: string): Promise<Blob> {
    return apiClient.get<Blob>(`/protocols/${protocolId}/pdf/`, undefined, { responseType: 'blob' });
  },

  async uploadProtocolFile(protocolId: string, file: File): Promise<Protocol> {
    const formData = new FormData();
    formData.append('file', file);
    
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/protocols/${protocolId}/`;
    const token = apiClient.getToken();
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || errorData.error || 'Failed to upload protocol file');
    }
    
    const data = await response.json();
    return adaptProtocol(data);
  },

  getFileUrl(protocol: Protocol): string | null {
    const path = protocol.file;
    if (!path || (typeof path === 'string' && !path.trim())) return null;
    const pathStr = typeof path === 'string' ? path : String(path);
    if (pathStr.startsWith('http')) return pathStr;
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '') || 'http://localhost:8000';
    return `${baseUrl}${pathStr.startsWith('/') ? pathStr : '/' + pathStr}`;
  },

  async exportProtocols(): Promise<void> {
    const blob = await apiClient.get<Blob>('/protocols/export/', undefined, { responseType: 'blob' });
    downloadBlob(blob, 'protocols.xlsx');
  },
};

export { protocolsService };

