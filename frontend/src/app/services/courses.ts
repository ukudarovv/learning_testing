import { apiClient, downloadBlob } from './api';
import { Course, CourseEnrollment, CourseEnrollmentRequest } from '../types/lms';
import { PaginatedResponse, PaginationParams } from '../types/pagination';

const coursesService = {
  async getCourses(params?: { 
    status?: string; 
    category?: string; 
    search?: string;
    language?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Course>> {
    const data = await apiClient.get<any>('/courses/', params);
    
    // Backend возвращает пагинированный ответ Django REST Framework
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
      return {
        results: data.results,
        count: data.count || data.results.length,
        next: data.next || null,
        previous: data.previous || null,
      };
    }
    
    // Fallback для непагинированных ответов (обратная совместимость)
    if (Array.isArray(data)) {
      return {
        results: data,
        count: data.length,
        next: null,
        previous: null,
      };
    }
    
    // Если данные в другом формате
    if (data && typeof data === 'object') {
      const results = data.data || data.courses || [];
      return {
        results: Array.isArray(results) ? results : [],
        count: data.count || results.length,
        next: data.next || null,
        previous: data.previous || null,
      };
    }
    
    return {
      results: [],
      count: 0,
      next: null,
      previous: null,
    };
  },

  async getCourse(id: string): Promise<Course> {
    const data = await apiClient.get<any>(`/courses/${id}/`);
    console.log('Course API response:', data);
    
    // Обрабатываем модули и уроки, если они есть
    if (data && typeof data === 'object') {
      // Убеждаемся, что modules - это массив
      if (data.modules && !Array.isArray(data.modules)) {
        console.warn('Modules is not an array, converting:', data.modules);
        data.modules = [];
      }
      
      // Обрабатываем каждый модуль
      if (Array.isArray(data.modules)) {
        data.modules = data.modules.map((module: any) => {
          // Убеждаемся, что lessons - это массив
          if (module.lessons && !Array.isArray(module.lessons)) {
            console.warn('Module lessons is not an array, converting:', module.lessons);
            module.lessons = [];
          }
          
          // Преобразуем поля уроков из backend формата в frontend формат
          if (Array.isArray(module.lessons)) {
            module.lessons = module.lessons.map((lesson: any) => {
              return {
                ...lesson,
                videoUrl: lesson.video_url || lesson.videoUrl,
                thumbnailUrl: lesson.thumbnail_url || lesson.thumbnailUrl,
                pdfUrl: lesson.pdf_url || lesson.pdfUrl,
                pptUrl: lesson.ppt_url || lesson.pptUrl,
                testId: lesson.test_id || lesson.testId,
                passingScore: lesson.passing_score || lesson.passingScore,
                maxAttempts: lesson.max_attempts || lesson.maxAttempts,
                allowDownload: lesson.allow_download !== undefined ? lesson.allow_download : lesson.allowDownload,
                trackProgress: lesson.track_progress !== undefined ? lesson.track_progress : lesson.trackProgress,
              };
            });
          }
          
          return module;
        });
      }
    }
    
    return data as Course;
  },

  async getCourseWithProgress(id: string): Promise<Course> {
    const data = await apiClient.get<any>(`/courses/${id}/with_progress/`);
    console.log('Course with progress API response:', data);
    
    // Обрабатываем модули и уроки, если они есть
    if (data && typeof data === 'object') {
      // Убеждаемся, что modules - это массив
      if (data.modules && !Array.isArray(data.modules)) {
        console.warn('Modules is not an array, converting:', data.modules);
        data.modules = [];
      }
      
      // Обрабатываем каждый модуль
      if (Array.isArray(data.modules)) {
        data.modules = data.modules.map((module: any) => {
          // Убеждаемся, что lessons - это массив
          if (module.lessons && !Array.isArray(module.lessons)) {
            console.warn('Module lessons is not an array, converting:', module.lessons);
            module.lessons = [];
          }
          
          // Преобразуем поля уроков из backend формата в frontend формат
          if (Array.isArray(module.lessons)) {
            module.lessons = module.lessons.map((lesson: any) => {
              return {
                ...lesson,
                videoUrl: lesson.video_url || lesson.videoUrl,
                thumbnailUrl: lesson.thumbnail_url || lesson.thumbnailUrl,
                pdfUrl: lesson.pdf_url || lesson.pdfUrl,
                testId: lesson.test_id || lesson.testId,
                passingScore: lesson.passing_score || lesson.passingScore,
                maxAttempts: lesson.max_attempts || lesson.maxAttempts,
                allowDownload: lesson.allow_download !== undefined ? lesson.allow_download : lesson.allowDownload,
                trackProgress: lesson.track_progress !== undefined ? lesson.track_progress : lesson.trackProgress,
                completed: lesson.completed !== undefined ? lesson.completed : false, // Сохраняем статус completed из backend
              };
            });
          }
          
          return module;
        });
      }
    }
    
    return data as Course;
  },

  async createCourse(course: Partial<Course>): Promise<Course> {
    // Convert frontend format to backend format
    // Обрабатываем category: если это объект, берем id, иначе используем categoryId или category
    let categoryId: string | undefined = undefined;
    if (course.categoryId) {
      categoryId = course.categoryId;
    } else if (typeof course.category === 'object' && course.category !== null) {
      categoryId = course.category.id || (course.category as any).id;
    } else if (typeof course.category === 'string') {
      // Старый формат - оставляем для обратной совместимости, но лучше использовать categoryId
      categoryId = course.category;
    }
    
    const backendCourse: any = {
      title: course.title,
      description: course.description || '',
      category_id: categoryId || null,
      duration: course.duration || 0,
      status: course.status || 'draft',
      language: course.language || 'ru',
      passing_score: course.passingScore || course.passing_score,
      max_attempts: course.maxAttempts || course.max_attempts,
      has_timer: course.hasTimer || course.has_timer,
      timer_minutes: course.timerMinutes || course.timer_minutes,
      pdek_commission: course.pdekCommission || course.pdek_commission,
      final_test: course.final_test_id || course.finalTestId || null,
    };
    
    // Process modules and lessons for nested creation
    console.log('createCourse - course.modules:', course.modules);
    if (course.modules && Array.isArray(course.modules) && course.modules.length > 0) {
      console.log('createCourse - processing', course.modules.length, 'modules');
      backendCourse.modules = course.modules.map((module: any, moduleIndex: number) => {
        const backendModule: any = {
          title: module.title || '',
          description: module.description || '',
          order: module.order || moduleIndex + 1,
        };
        
        // Process lessons for each module
        if (module.lessons && Array.isArray(module.lessons) && module.lessons.length > 0) {
          backendModule.lessons = module.lessons.map((lesson: any, lessonIndex: number) => {
            const backendLesson: any = {
              title: lesson.title || '',
              description: lesson.description || '',
              type: lesson.type || 'text',
              order: lesson.order || lessonIndex + 1,
              duration: lesson.duration || 0,
              required: lesson.required !== undefined ? lesson.required : true,
              content: lesson.content || '',
            };
            
            // Add type-specific fields
            if (lesson.type === 'video') {
              backendLesson.video_url = lesson.videoUrl || lesson.video_url || '';
              backendLesson.thumbnail_url = lesson.thumbnailUrl || lesson.thumbnail_url || '';
              backendLesson.allow_download = lesson.allowDownload || lesson.allow_download || false;
              backendLesson.track_progress = lesson.trackProgress || lesson.track_progress || false;
            } else if (lesson.type === 'pdf') {
              backendLesson.pdf_url = lesson.pdfUrl || lesson.pdf_url || '';
              backendLesson.allow_download = lesson.allowDownload || lesson.allow_download || false;
            } else if (lesson.type === 'ppt') {
              backendLesson.ppt_url = lesson.pptUrl || lesson.ppt_url || '';
              backendLesson.allow_download = lesson.allowDownload || lesson.allow_download || false;
            } else if (lesson.type === 'quiz') {
              backendLesson.test_id = lesson.testId || lesson.test_id || null;
              backendLesson.passing_score = lesson.passingScore || lesson.passing_score || 80;
              backendLesson.max_attempts = lesson.maxAttempts || lesson.max_attempts || 3;
            }
            
            return backendLesson;
          });
        } else {
          backendModule.lessons = [];
        }
        
        return backendModule;
      });
      console.log('createCourse - processed modules:', backendCourse.modules);
    } else {
      console.log('createCourse - no modules or empty array');
      backendCourse.modules = [];
    }
    
    console.log('createCourse - sending to backend:', backendCourse);
    return apiClient.post<Course>('/courses/', backendCourse);
  },

  async updateCourse(id: string, course: Partial<Course>): Promise<Course> {
    // Convert frontend format to backend format
    // Обрабатываем category: если это объект, берем id, иначе используем categoryId или category
    let categoryId: string | undefined = undefined;
    if (course.categoryId) {
      categoryId = course.categoryId;
    } else if (typeof course.category === 'object' && course.category !== null) {
      categoryId = course.category.id || (course.category as any).id;
    } else if (typeof course.category === 'string') {
      // Старый формат - оставляем для обратной совместимости, но лучше использовать categoryId
      categoryId = course.category;
    }
    
    const backendCourse: any = {
      title: course.title,
      description: course.description,
      category_id: categoryId || null,
      duration: course.duration,
      status: course.status,
      language: course.language || 'ru',
      passing_score: course.passingScore || course.passing_score,
      max_attempts: course.maxAttempts || course.max_attempts,
      has_timer: course.hasTimer || course.has_timer,
      timer_minutes: course.timerMinutes || course.timer_minutes,
      pdek_commission: course.pdekCommission || course.pdek_commission,
      final_test: course.final_test_id || course.finalTestId || null,
    };
    
    // Process modules and lessons for nested update
    console.log('updateCourse - course.modules:', course.modules);
    if (course.modules && Array.isArray(course.modules)) {
      console.log('updateCourse - processing', course.modules.length, 'modules');
      backendCourse.modules = course.modules.map((module: any, moduleIndex: number) => {
        const backendModule: any = {
          id: module.id && !String(module.id).startsWith('module-') ? module.id : undefined, // Only include real IDs
          title: module.title || '',
          description: module.description || '',
          order: module.order || moduleIndex + 1,
        };
        
        // Process lessons for each module
        if (module.lessons && Array.isArray(module.lessons)) {
          backendModule.lessons = module.lessons.map((lesson: any, lessonIndex: number) => {
            const backendLesson: any = {
              id: lesson.id && !String(lesson.id).startsWith('lesson-') ? lesson.id : undefined, // Only include real IDs
              title: lesson.title || '',
              description: lesson.description || '',
              type: lesson.type || 'text',
              order: lesson.order || lessonIndex + 1,
              duration: lesson.duration || 0,
              required: lesson.required !== undefined ? lesson.required : true,
              content: lesson.content || '',
            };
            
            // Add type-specific fields
            if (lesson.type === 'video') {
              backendLesson.video_url = lesson.videoUrl || lesson.video_url || '';
              backendLesson.thumbnail_url = lesson.thumbnailUrl || lesson.thumbnail_url || '';
              backendLesson.allow_download = lesson.allowDownload || lesson.allow_download || false;
              backendLesson.track_progress = lesson.trackProgress || lesson.track_progress || false;
            } else if (lesson.type === 'pdf') {
              backendLesson.pdf_url = lesson.pdfUrl || lesson.pdf_url || '';
              backendLesson.allow_download = lesson.allowDownload || lesson.allow_download || false;
            } else if (lesson.type === 'ppt') {
              backendLesson.ppt_url = lesson.pptUrl || lesson.ppt_url || '';
              backendLesson.allow_download = lesson.allowDownload || lesson.allow_download || false;
            } else if (lesson.type === 'quiz') {
              backendLesson.test_id = lesson.testId || lesson.test_id || null;
              backendLesson.passing_score = lesson.passingScore || lesson.passing_score || 80;
              backendLesson.max_attempts = lesson.maxAttempts || lesson.max_attempts || 3;
            }
            
            return backendLesson;
          });
        } else {
          backendModule.lessons = [];
        }
        
        return backendModule;
      });
      console.log('updateCourse - processed modules:', backendCourse.modules);
    } else {
      console.log('updateCourse - no modules or not an array');
    }
    
    console.log('updateCourse - sending to backend:', backendCourse);
    return apiClient.put<Course>(`/courses/${id}/`, backendCourse);
  },

  async deleteCourse(id: string): Promise<void> {
    await apiClient.delete(`/courses/${id}/`);
  },

  async getCourseStudents(courseId: string): Promise<CourseEnrollment[]> {
    return apiClient.get<CourseEnrollment[]>(`/courses/${courseId}/students/`);
  },

  async exportCourseEnrollments(courseId: string): Promise<void> {
    const blob = await apiClient.get<Blob>(`/courses/${courseId}/enrollments/export/`, undefined, {
      responseType: 'blob',
    });
    downloadBlob(blob, `course_${courseId}_enrollments.xlsx`);
  },

  async enrollStudents(courseId: string, userIds: string[]): Promise<void> {
    await apiClient.post(`/courses/${courseId}/enroll/`, { user_ids: userIds });
  },

  async selfEnroll(courseId: string): Promise<{ message: string; enrollment_id?: number; request_id?: number; status?: string }> {
    const data = await apiClient.post<{ message: string; enrollment_id?: number; request_id?: number; status?: string }>(
      `/courses/${courseId}/enroll/`,
      {}
    );
    return data;
  },

  async revokeEnrollment(courseId: string, userId: string): Promise<void> {
    await apiClient.post(`/courses/${courseId}/revoke_enrollment/`, { user_id: userId });
  },

  async completeLesson(lessonId: string): Promise<{ progress: number }> {
    const response = await apiClient.post<{ message: string; progress: number }>(`/lessons/${lessonId}/complete/`);
    return { progress: response.progress || 0 };
  },

  async getMyEnrollments(): Promise<CourseEnrollment[]> {
    // Try to get user's enrollments
    // If backend has my_enrollments endpoint, use it
    // Otherwise, return empty array and frontend hook will handle fetching differently
    try {
      return await apiClient.get<CourseEnrollment[]>('/courses/my_enrollments/');
    } catch (error: any) {
      // If endpoint doesn't exist (404), return empty array
      // Frontend hook will handle fetching differently using fallback method
      if (error.status === 404) {
        return [];
      }
      // For other errors, re-throw
      throw error;
    }
  },

  async requestCompletionOTP(courseId: string): Promise<{ message: string; otp_expires_at?: string; otp_code?: string; debug?: boolean; otp_is_new?: boolean }> {
    return apiClient.post<{ message: string; otp_expires_at?: string; otp_code?: string; debug?: boolean; otp_is_new?: boolean }>(`/courses/${courseId}/request_completion_otp/`);
  },

  async verifyCompletionOTP(courseId: string, otpCode: string): Promise<{ message: string; protocol_id: number }> {
    return apiClient.post<{ message: string; protocol_id: number }>(`/courses/${courseId}/verify_completion_otp/`, {
      otp_code: otpCode
    });
  },

  async createEnrollmentRequest(courseId: string): Promise<CourseEnrollmentRequest> {
    const data = await apiClient.post<CourseEnrollmentRequest>(
      '/courses/enrollment-requests/',
      { course_id: parseInt(courseId) }
    );
    return data;
  },

  async getEnrollmentRequests(): Promise<CourseEnrollmentRequest[]> {
    const data = await apiClient.get<any>('/courses/enrollment-requests/');
    // Обработка пагинированного ответа
    if (data && typeof data === 'object' && 'results' in data) {
      return Array.isArray(data.results) ? data.results : [];
    }
    // Обработка обычного массива
    return Array.isArray(data) ? data : [];
  },

  async getMyEnrollmentRequests(): Promise<CourseEnrollmentRequest[]> {
    const data = await apiClient.get<CourseEnrollmentRequest[]>('/courses/enrollment-requests/my_requests/');
    return Array.isArray(data) ? data : [];
  },

  async approveEnrollmentRequest(requestId: string, adminResponse?: string): Promise<CourseEnrollmentRequest> {
    const data = await apiClient.post<CourseEnrollmentRequest>(
      `/courses/enrollment-requests/${requestId}/approve/`,
      adminResponse ? { admin_response: adminResponse } : {}
    );
    return data;
  },

  async rejectEnrollmentRequest(requestId: string, reason: string): Promise<CourseEnrollmentRequest> {
    const data = await apiClient.post<CourseEnrollmentRequest>(
      `/courses/enrollment-requests/${requestId}/reject/`,
      { admin_response: reason }
    );
    return data;
  },
};

export { coursesService };

