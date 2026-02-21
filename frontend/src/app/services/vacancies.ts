import { apiClient, downloadBlob } from './api';

export interface Vacancy {
  id: string;
  title: string;
  title_kz?: string; // Backend format (legacy, for backward compatibility)
  titleKz?: string; // Frontend format (for compatibility)
  title_en?: string; // Backend format (legacy, for backward compatibility)
  titleEn?: string; // Frontend format (for compatibility)
  description: string;
  description_kz?: string; // Backend format (legacy, for backward compatibility)
  descriptionKz?: string; // Frontend format (for compatibility)
  description_en?: string; // Backend format (legacy, for backward compatibility)
  descriptionEn?: string; // Frontend format (for compatibility)
  requirements: string;
  requirements_kz?: string; // Backend format (legacy, for backward compatibility)
  requirementsKz?: string; // Frontend format (for compatibility)
  requirements_en?: string; // Backend format (legacy, for backward compatibility)
  requirementsEn?: string; // Frontend format (for compatibility)
  responsibilities: string;
  responsibilities_kz?: string; // Backend format (legacy, for backward compatibility)
  responsibilitiesKz?: string; // Frontend format (for compatibility)
  responsibilities_en?: string; // Backend format (legacy, for backward compatibility)
  responsibilitiesEn?: string; // Frontend format (for compatibility)
  salary_min?: number;
  salary_max?: number;
  location: string;
  location_kz?: string; // Backend format (legacy, for backward compatibility)
  locationKz?: string; // Frontend format (for compatibility)
  location_en?: string; // Backend format (legacy, for backward compatibility)
  locationEn?: string; // Frontend format (for compatibility)
  language: 'ru' | 'kz' | 'en';
  employment_type: string;
  employment_type_display?: string;
  status: 'draft' | 'published' | 'closed';
  status_display?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  applications_count?: number;
}

export interface VacancyApplication {
  id: string;
  vacancy: string;
  vacancy_title?: string;
  full_name: string;
  phone: string;
  email?: string;
  message?: string;
  resume_file?: string;
  resume_file_url?: string;
  status: 'pending' | 'reviewed' | 'contacted' | 'rejected';
  status_display?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VacancyApplicationCreate {
  vacancy: string;
  full_name: string;
  phone: string;
  email?: string;
  message?: string;
  resume_file?: File;
}

export interface VacancyStatistics {
  vacancies: {
    total: number;
    draft: number;
    published: number;
    closed: number;
    active: number;
  };
  applications: {
    total: number;
    pending: number;
    reviewed: number;
    contacted: number;
    rejected: number;
  };
  popular_vacancies: Array<{
    id: string;
    title: string;
    application_count: number;
  }>;
  applications_by_date: Array<{
    date: string;
    count: number;
  }>;
  status_distribution: Array<{
    status: string;
    status_display: string;
    count: number;
  }>;
}

const vacanciesService = {
  async getVacancies(params?: { status?: string; is_active?: boolean; location?: string }): Promise<Vacancy[]> {
    const data = await apiClient.get<any>('/vacancies/', params);
    
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
      if (Array.isArray(data.vacancies)) {
        return data.vacancies;
      }
    }
    
    console.warn('Unexpected response format for vacancies, returning empty array:', data);
    return [];
  },

  async getVacancy(id: string): Promise<Vacancy> {
    return apiClient.get<Vacancy>(`/vacancies/${id}/`);
  },

  async createVacancy(vacancy: Partial<Vacancy>): Promise<Vacancy> {
    return apiClient.post<Vacancy>('/vacancies/', vacancy);
  },

  async updateVacancy(id: string, vacancy: Partial<Vacancy>): Promise<Vacancy> {
    return apiClient.put<Vacancy>(`/vacancies/${id}/`, vacancy);
  },

  async deleteVacancy(id: string): Promise<void> {
    return apiClient.delete(`/vacancies/${id}/`);
  },

  async getStatistics(): Promise<VacancyStatistics> {
    return apiClient.get<VacancyStatistics>('/vacancies/statistics/');
  },

  async getApplications(params?: { vacancy?: string; status?: string }): Promise<VacancyApplication[]> {
    const data = await apiClient.get<any>('/vacancies/applications/', params);
    
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
    
    console.warn('Unexpected response format for applications, returning empty array:', data);
    return [];
  },

  async getApplication(id: string): Promise<VacancyApplication> {
    return apiClient.get<VacancyApplication>(`/vacancies/applications/${id}/`);
  },

  async createApplication(application: VacancyApplicationCreate): Promise<VacancyApplication> {
    const formData = new FormData();
    formData.append('vacancy', application.vacancy);
    formData.append('full_name', application.full_name);
    formData.append('phone', application.phone);
    if (application.email) {
      formData.append('email', application.email);
    }
    if (application.message) {
      formData.append('message', application.message);
    }
    if (application.resume_file) {
      formData.append('resume_file', application.resume_file);
    }

    return apiClient.post<VacancyApplication>('/vacancies/applications/', formData, {
      headers: {} // Let browser set Content-Type with boundary for FormData
    });
  },

  async updateApplication(id: string, application: Partial<VacancyApplication>): Promise<VacancyApplication> {
    return apiClient.patch<VacancyApplication>(`/vacancies/applications/${id}/`, application);
  },

  async exportVacancies(): Promise<void> {
    const blob = await apiClient.get<Blob>('/vacancies/export/', undefined, { responseType: 'blob' });
    downloadBlob(blob, 'vacancies.xlsx');
  },

  async exportApplications(): Promise<void> {
    const blob = await apiClient.get<Blob>('/vacancies/applications/export/', undefined, {
      responseType: 'blob',
    });
    downloadBlob(blob, 'vacancy_applications.xlsx');
  },
};

export { vacanciesService };

