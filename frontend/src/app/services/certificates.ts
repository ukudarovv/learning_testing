import { apiClient, downloadBlob } from './api';
import { Certificate, CertificateTemplate, PendingCertificate } from '../types/lms';

const certificatesService = {
  async getCertificates(params?: { user?: string }): Promise<Certificate[]> {
    const data = await apiClient.get<any>('/certificates/', params);
    
    // Backend может возвращать данные в разных форматах:
    // 1. Прямой массив: [cert1, cert2, ...]
    // 2. Пагинированный ответ: { results: [...], count: N, next: ..., previous: ... }
    // 3. Объект с данными: { data: [...] }
    
    if (Array.isArray(data)) {
      return data;
    }
    
    // Проверяем пагинированный ответ Django REST Framework
    if (data && typeof data === 'object') {
      if (Array.isArray(data.results)) {
        return data.results;
      }
      if (Array.isArray(data.data)) {
        return data.data;
      }
      if (Array.isArray(data.certificates)) {
        return data.certificates;
      }
    }
    
    console.warn('Unexpected response format for certificates, returning empty array:', data);
    return [];
  },

  async getCertificate(id: string): Promise<Certificate> {
    return apiClient.get<Certificate>(`/certificates/${id}/`);
  },

  async downloadCertificatePDF(id: string): Promise<Blob> {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/certificates/${id}/pdf/`,
      {
        headers: {
          'Authorization': `Bearer ${apiClient.getToken()}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to download certificate');
    }
    
    return response.blob();
  },

  async verifyCertificate(certificateNumber: string): Promise<{ 
    valid: boolean; 
    certificate?: Certificate; 
    error?: string;
    message?: string;
  }> {
    try {
      // URL encode the certificate number to handle special characters
      const encodedNumber = encodeURIComponent(certificateNumber);
      const response = await apiClient.get<{
        valid: boolean;
        certificate?: Certificate;
        error?: string;
        message?: string;
      }>(`/certificates/verify/${encodedNumber}/`);
      
      return response;
    } catch (error: any) {
      // Handle API errors
      if (error.status === 404) {
        return {
          valid: false,
          error: 'Сертификат не найден',
          message: 'Сертификат с указанным номером не найден в базе данных'
        };
      }
      
      throw error;
    }
  },

  async getTemplates(): Promise<CertificateTemplate[]> {
    const data = await apiClient.get<any>('/certificates/templates/');
    
    if (Array.isArray(data)) {
      return data;
    }
    
    if (data && typeof data === 'object') {
      if (Array.isArray(data.results)) {
        return data.results;
      }
      if (Array.isArray(data.data)) {
        return data.data;
      }
    }
    
    return [];
  },

  async getTemplate(id: string): Promise<CertificateTemplate> {
    return apiClient.get<CertificateTemplate>(`/certificates/templates/${id}/`);
  },

  async createTemplate(template: Partial<CertificateTemplate>): Promise<CertificateTemplate> {
    const formData = new FormData();
    if (template.name) formData.append('name', template.name);
    if (template.description) formData.append('description', template.description);
    if (template.file && template.file instanceof File) formData.append('file', template.file);
    if (template.is_active !== undefined) formData.append('is_active', String(template.is_active));
    
    return apiClient.post<CertificateTemplate>('/certificates/templates/', formData);
  },

  async updateTemplate(id: string, template: Partial<CertificateTemplate>): Promise<CertificateTemplate> {
    const formData = new FormData();
    if (template.name) formData.append('name', template.name);
    if (template.description !== undefined) formData.append('description', template.description);
    if (template.file && template.file instanceof File) formData.append('file', template.file);
    if (template.is_active !== undefined) formData.append('is_active', String(template.is_active));
    
    // Use fetch directly for FormData with PATCH
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/certificates/templates/${id}/`;
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
      throw new Error(errorData.detail || errorData.message || 'Failed to update template');
    }
    
    return response.json();
  },

  async deleteTemplate(id: string): Promise<void> {
    await apiClient.delete(`/certificates/templates/${id}/`);
  },

  async getPendingCertificates(): Promise<PendingCertificate[]> {
    return apiClient.get<PendingCertificate[]>('/certificates/pending/');
  },

  async uploadCertificate(
    certificateId: string | null,
    file: File,
    templateId?: string,
    studentId?: string,
    courseId?: string | null,
    testId?: string | null
  ): Promise<Certificate> {
    const formData = new FormData();
    formData.append('file', file);
    if (templateId) formData.append('template', templateId);
    if (studentId) formData.append('student', studentId);
    if (courseId) formData.append('course', courseId);
    if (testId) formData.append('test', testId);
    
    console.log('uploadCertificate called with:', {
      certificateId,
      fileName: file.name,
      fileSize: file.size,
      templateId,
      studentId,
      courseId,
      testId
    });
    
    if (certificateId) {
      // Update existing certificate - use request method directly for FormData
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/certificates/${certificateId}/`;
      const token = apiClient.getToken();
      console.log('Updating certificate at:', url);
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      console.log('Update certificate response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update certificate error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText || 'Unknown error' };
        }
        console.error('Update certificate error:', errorData);
        throw new Error(errorData.detail || errorData.message || errorData.error || `Failed to update certificate: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Update certificate success:', result);
      return result;
    } else {
      // Create new certificate
      console.log('Creating new certificate');
      if (!studentId) {
        throw new Error('Student ID is required for creating certificate');
      }
      
      try {
        const result = await apiClient.post<Certificate>('/certificates/', formData);
        console.log('Certificate created:', result);
        return result;
      } catch (error: any) {
        console.error('Create certificate error:', error);
        throw error;
      }
    }
  },

  async updateCertificate(
    certificateId: string,
    data: Partial<Certificate>
  ): Promise<Certificate> {
    const formData = new FormData();
    if ('number' in data && data.number) {
      formData.append('number', data.number);
    }
    if ('templateId' in data) {
      formData.append('template', data.templateId || '');
    }
    if ('validUntil' in data) {
      formData.append('valid_until', data.validUntil ? (data.validUntil as string) : '');
    }
    if (data.file && data.file instanceof File) {
      formData.append('file', data.file);
    }
    
    // Use fetch directly for FormData with PATCH
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/certificates/${certificateId}/`;
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
      throw new Error(errorData.detail || errorData.message || 'Failed to update certificate');
    }
    
    return response.json();
  },

  async deleteCertificate(certificateId: string): Promise<void> {
    await apiClient.delete(`/certificates/${certificateId}/`);
  },

  async exportCertificates(): Promise<void> {
    const blob = await apiClient.get<Blob>('/certificates/export/', undefined, { responseType: 'blob' });
    downloadBlob(blob, 'certificates.xlsx');
  },
};

export { certificatesService };

