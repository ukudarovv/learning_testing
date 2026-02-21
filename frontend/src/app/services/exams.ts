import { apiClient, downloadBlob } from './api';
import { TestAttempt, ExtraAttemptRequest } from '../types/lms';

const examsService = {
  async startTestAttempt(testId: string): Promise<TestAttempt> {
    return apiClient.post<TestAttempt>('/exams/start/', { test_id: testId });
  },

  async saveTestAttempt(attemptId: string, answers: Record<string, any>): Promise<TestAttempt> {
    return apiClient.post<TestAttempt>(`/exams/${attemptId}/save/`, { answers });
  },

  async submitTestAttempt(attemptId: string, videoBlob?: Blob): Promise<TestAttempt> {
    if (videoBlob) {
      // Send video as FormData
      const formData = new FormData();
      formData.append('video_recording', videoBlob, `test_attempt_${attemptId}_${Date.now()}.webm`);
      return apiClient.post<TestAttempt>(`/exams/${attemptId}/submit/`, formData);
    }
    return apiClient.post<TestAttempt>(`/exams/${attemptId}/submit/`);
  },

  async getTestAttempt(attemptId: string): Promise<TestAttempt> {
    return apiClient.get<TestAttempt>(`/exams/${attemptId}/`);
  },

  async getMyAttempts(): Promise<TestAttempt[]> {
    const data = await apiClient.get<any>('/exams/my_attempts/');
    
    // Backend может возвращать данные в разных форматах:
    // 1. Прямой массив: [attempt1, attempt2, ...]
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
      if (Array.isArray(data.attempts)) {
        return data.attempts;
      }
    }
    
    console.warn('Unexpected response format for test attempts, returning empty array:', data);
    return [];
  },

  async getAllAttempts(): Promise<TestAttempt[]> {
    // Для администратора используем стандартный list endpoint
    // Backend вернет все попытки для админа через get_queryset()
    const data = await apiClient.get<any>('/exams/');
    
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
      if (Array.isArray(data.attempts)) {
        return data.attempts;
      }
    }
    
    console.warn('Unexpected response format for all test attempts, returning empty array:', data);
    return [];
  },

  async getTestAttempts(testId: string): Promise<TestAttempt[]> {
    const data = await apiClient.get<any>(`/exams/test_attempts/?test_id=${testId}`);
    
    // Backend возвращает массив попыток
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
      if (Array.isArray(data.attempts)) {
        return data.attempts;
      }
    }
    
    console.warn('Unexpected response format for test attempts, returning empty array:', data);
    return [];
  },

  async saveAnswer(attemptId: number, answerData: { question: string; selected_options?: string[]; answer_text?: string }): Promise<void> {
    return apiClient.post(`/exams/${attemptId}/save/`, { answers: { [answerData.question]: answerData.selected_options || answerData.answer_text } });
  },

  async saveAllAnswers(attemptId: number, answers: Record<string, any>): Promise<void> {
    return apiClient.post(`/exams/${attemptId}/save/`, { answers });
  },

  // Extra Attempt Requests
  async createExtraAttemptRequest(testId: string, reason: string): Promise<ExtraAttemptRequest> {
    return apiClient.post<ExtraAttemptRequest>('/exams/extra-attempts/', {
      test_id: Number(testId),
      reason,
    });
  },

  async getExtraAttemptRequests(params?: { status?: string }): Promise<ExtraAttemptRequest[]> {
    const queryParams = new URLSearchParams();
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    const queryString = queryParams.toString();
    const url = `/exams/extra-attempts/${queryString ? '?' + queryString : ''}`;
    const data = await apiClient.get<any>(url);
    // Backend может возвращать массив или объект с results
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.results)) {
      return data.results;
    }
    return [];
  },

  async getExtraAttemptRequest(id: string): Promise<ExtraAttemptRequest> {
    return apiClient.get<ExtraAttemptRequest>(`/exams/extra-attempts/${id}/`);
  },

  async approveExtraAttemptRequest(id: string, adminResponse?: string): Promise<ExtraAttemptRequest> {
    const data: any = {};
    if (adminResponse) {
      data.admin_response = adminResponse;
    }
    return apiClient.post<ExtraAttemptRequest>(`/exams/extra-attempts/${id}/approve/`, data);
  },

  async rejectExtraAttemptRequest(id: string, adminResponse: string): Promise<ExtraAttemptRequest> {
    return apiClient.post<ExtraAttemptRequest>(`/exams/extra-attempts/${id}/reject/`, {
      admin_response: adminResponse,
    });
  },

  // Video deletion
  async requestDeleteVideoOTP(attemptId: string): Promise<{ message: string; expires_at: string }> {
    return apiClient.post<{ message: string; expires_at: string }>(`/exams/${attemptId}/request_delete_video_otp/`);
  },

  async deleteVideoRecording(attemptId: string, smsCode: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(`/exams/${attemptId}/delete_video/`, {
      sms_code: smsCode,
    });
  },

  // Test termination
  async terminateTestAttempt(attemptId: string, reason: string): Promise<TestAttempt> {
    return apiClient.post<TestAttempt>(`/exams/${attemptId}/terminate/`, { reason });
  },

  async exportTestAttempts(): Promise<void> {
    const blob = await apiClient.get<Blob>('/exams/export/', undefined, { responseType: 'blob' });
    downloadBlob(blob, 'test_attempts.xlsx');
  },
};

export { examsService };

