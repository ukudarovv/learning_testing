import { apiClient, downloadBlob } from './api';

export interface AnalyticsStats {
  total_students: number;
  active_students: number;
  active_courses: number;
  completed_courses: number;
  tests_today: number;
  success_rate: number;
  avg_score: number;
  total_certificates: number;
  certificates_this_month: number;
}

export interface EnrollmentTrend {
  month: string;
  students: number;
}

export interface TestResultsDistribution {
  name: string;
  value: number;
  color: string;
}

export interface CoursePopularity {
  name: string;
  students: number;
}

export interface TopStudent {
  id: string;
  name: string;
  rank: number;
  courses: number;
  avg_score: number;
  certificates: number;
}

const analyticsService = {
  async getStats(): Promise<AnalyticsStats> {
    return apiClient.get<AnalyticsStats>('/analytics/stats/');
  },

  async getEnrollmentTrend(): Promise<EnrollmentTrend[]> {
    return apiClient.get<EnrollmentTrend[]>('/analytics/enrollment_trend/');
  },

  async getTestResultsDistribution(): Promise<TestResultsDistribution[]> {
    return apiClient.get<TestResultsDistribution[]>('/analytics/test_results_distribution/');
  },

  async getCoursesPopularity(): Promise<CoursePopularity[]> {
    return apiClient.get<CoursePopularity[]>('/analytics/courses_popularity/');
  },

  async getTopStudents(): Promise<TopStudent[]> {
    return apiClient.get<TopStudent[]>('/analytics/top_students/');
  },

  async exportSummaryReport(format: 'pdf' | 'xlsx'): Promise<void> {
    const blob = await apiClient.get<Blob>(`/analytics/summary_report/?format=${format}`, undefined, {
      responseType: 'blob',
    });
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    downloadBlob(blob, `summary_report.${ext}`);
  },

  async exportTestResults(): Promise<void> {
    const blob = await apiClient.get<Blob>('/analytics/test_results_export/', undefined, {
      responseType: 'blob',
    });
    downloadBlob(blob, 'test_results.xlsx');
  },

  async exportCertificates(format: 'pdf' | 'xlsx'): Promise<void> {
    const blob = await apiClient.get<Blob>(`/analytics/certificates_export/?format=${format}`, undefined, {
      responseType: 'blob',
    });
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    downloadBlob(blob, `certificates.${ext}`);
  },

  async exportCoursesPopularity(): Promise<void> {
    const blob = await apiClient.get<Blob>('/analytics/courses_popularity_export/', undefined, {
      responseType: 'blob',
    });
    downloadBlob(blob, 'courses_popularity.xlsx');
  },

  async exportLearningExamReport(params?: { course_id?: number; user_id?: number; date_from?: string; date_to?: string }): Promise<void> {
    const searchParams = new URLSearchParams();
    if (params?.course_id) searchParams.set('course_id', String(params.course_id));
    if (params?.user_id) searchParams.set('user_id', String(params.user_id));
    if (params?.date_from) searchParams.set('date_from', params.date_from);
    if (params?.date_to) searchParams.set('date_to', params.date_to);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const blob = await apiClient.get<Blob>(`/analytics/learning_exam_report/${query}`, undefined, {
      responseType: 'blob',
    });
    downloadBlob(blob, 'learning_exam_report.xlsx');
  },
};

export { analyticsService };

