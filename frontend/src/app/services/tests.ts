import { apiClient } from './api';
import { Test, Question, TestEnrollmentRequest } from '../types/lms';
import { PaginatedResponse, PaginationParams } from '../types/pagination';

// Вспомогательные функции для конвертации форматов вопросов

/**
 * Конвертирует вопрос из frontend формата в backend формат
 */
function convertQuestionToBackendFormat(question: Question): any {
  const backendQuestion: any = {
    type: question.type,
    text: question.text,
    order: question.order,
    weight: question.weight,
  };

  if (question.type === 'yes_no') {
    // Для yes_no правильный ответ хранится в correctAnswer
    backendQuestion.options = [
      { text: 'Да', is_correct: question.correctAnswer === 'Да' },
      { text: 'Нет', is_correct: question.correctAnswer === 'Нет' }
    ];
  } else if (question.type === 'short_answer') {
    // Для short_answer правильный ответ хранится в correctAnswer
    backendQuestion.options = [
      { text: question.correctAnswer || '', is_correct: true }
    ];
  } else if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    // Для single_choice и multiple_choice options могут быть массивом строк или объектов
    // correctAnswer - строка или массив строк (текст или id)
    let optionsArray: Array<{ id?: string; text: string } | string> = [];
    
    if (Array.isArray(question.options)) {
      // Проверяем, это массив строк или объектов
      if (question.options.length > 0 && typeof question.options[0] === 'object' && question.options[0] !== null) {
        // Это массив объектов с id и text
        optionsArray = question.options as Array<{ id?: string; text: string }>;
      } else {
        // Это массив строк (старый формат для совместимости с редактором)
        optionsArray = question.options.filter((opt): opt is string => typeof opt === 'string');
      }
    }
    
    const correctAnswers = Array.isArray(question.correctAnswer) 
      ? question.correctAnswer 
      : question.correctAnswer ? [question.correctAnswer] : [];
    
    // Преобразуем в формат backend: массив объектов {id, text, is_correct}
    backendQuestion.options = optionsArray.map((opt: any, index: number) => {
      // Если opt - объект, используем его поля
      if (typeof opt === 'object' && opt !== null) {
        const optText = opt.text || '';
        const optId = opt.id || String(opt.id) || '';
        // Проверяем, является ли этот вариант правильным ответом
        const isCorrect = correctAnswers.includes(optText) || correctAnswers.includes(optId) || (opt.is_correct === true);
        return {
          text: optText,
          is_correct: isCorrect,
          id: optId || undefined
        };
      } else {
        // Если opt - строка, используем её как текст
        return {
          text: opt,
          is_correct: correctAnswers.includes(opt),
          id: undefined // ID будет сгенерирован на backend
        };
      }
    });
  } else {
    // Для других типов вопросов (matching, ordering) - пустой массив options
    backendQuestion.options = [];
  }

  return backendQuestion;
}

/**
 * Конвертирует вопрос из backend формата в frontend формат
 */
function convertQuestionFromBackendFormat(question: any): Question {
  const frontendQuestion: Question = {
    id: String(question.id),
    type: question.type,
    text: question.text,
    order: question.order,
    weight: question.weight,
  };

  if (question.type === 'yes_no') {
    // Для yes_no извлекаем правильный ответ из options
    const correctOption = question.options?.find((opt: any) => opt.is_correct);
    frontendQuestion.correctAnswer = correctOption?.text || '';
    frontendQuestion.options = ['Да', 'Нет'];
  } else if (question.type === 'short_answer') {
    // Для short_answer правильный ответ в options[0].text
    const correctOption = question.options?.[0];
    frontendQuestion.correctAnswer = correctOption?.text || '';
    frontendQuestion.options = undefined;
  } else if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    // Сохраняем опции как объекты с id и text (не преобразуем в строки)
    frontendQuestion.options = question.options?.map((opt: any) => ({
      id: opt.id ? String(opt.id) : '',
      text: opt.text || '',
      is_correct: opt.is_correct || false
    })) || [];
    
    // Для correctAnswer используем id опций (для совместимости с редактором)
    const correctOptions = question.options?.filter((opt: any) => opt.is_correct) || [];
    if (question.type === 'single_choice') {
      frontendQuestion.correctAnswer = correctOptions[0]?.id ? String(correctOptions[0].id) : '';
    } else {
      frontendQuestion.correctAnswer = correctOptions.map((opt: any) => opt.id ? String(opt.id) : '').filter(Boolean);
    }
  } else {
    // Для других типов вопросов (matching, ordering)
    frontendQuestion.options = question.options?.map((opt: any) => opt.text) || [];
    frontendQuestion.correctAnswer = undefined;
  }

  return frontendQuestion;
}

import { PaginatedResponse, PaginationParams } from '../types/pagination';

const testsService = {
  async getTests(params?: { 
    course?: string; 
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<Test>> {
    const data = await apiClient.get<any>('/tests/', params);
    
    // Backend возвращает пагинированный ответ Django REST Framework
    let tests: any[] = [];
    let count = 0;
    let next: string | null = null;
    let previous: string | null = null;
    
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
      tests = data.results;
      count = data.count || tests.length;
      next = data.next || null;
      previous = data.previous || null;
    } else if (Array.isArray(data)) {
      tests = data;
      count = data.length;
    } else if (data && typeof data === 'object') {
      tests = data.data || data.tests || [];
      count = data.count || tests.length;
      next = data.next || null;
      previous = data.previous || null;
    }
    
    // Обрабатываем course и category: преобразуем в courseId и categoryId для каждого теста
    tests = tests.map((test: any) => {
      if (test.course) {
        test.courseId = typeof test.course === 'string' ? test.course : String(test.course);
      } else {
        test.courseId = '';
      }
      
      // Обрабатываем category
      if (test.category) {
        if (typeof test.category === 'object' && test.category.id) {
          test.categoryId = String(test.category.id);
        } else if (typeof test.category === 'string') {
          test.categoryId = test.category;
        }
      }
      
      // Конвертируем backend поля в frontend формат
      test.shuffleQuestions = test.shuffle_questions !== undefined ? test.shuffle_questions : true;
      test.showResults = test.show_results !== undefined ? test.show_results : true;
      test.requiresVideoRecording = test.requires_video_recording !== undefined ? test.requires_video_recording : false;
      
      return test;
    });
    
    return {
      results: tests,
      count,
      next,
      previous,
    };
  },

  async getTest(id: string): Promise<Test> {
    const data = await apiClient.get<any>(`/tests/${id}/`);
    
    // Отладочное логирование для проверки данных с бэкенда
    console.log(`testsService.getTest(${id}) - Raw data from backend:`, {
      id: data.id,
      title: data.title,
      requires_video_recording: data.requires_video_recording,
      requires_video_recording_type: typeof data.requires_video_recording,
      allFields: Object.keys(data)
    });
    
    // Конвертируем вопросы из backend формата в frontend формат
    if (data.questions && Array.isArray(data.questions)) {
      data.questions = data.questions.map((q: any) => convertQuestionFromBackendFormat(q));
    }
    
    // Обрабатываем course: преобразуем в courseId
    if (data.course) {
      data.courseId = typeof data.course === 'string' ? data.course : String(data.course);
    } else {
      data.courseId = '';
    }
    
    // Обрабатываем category
    if (data.category) {
      if (typeof data.category === 'object' && data.category.id) {
        data.categoryId = String(data.category.id);
      } else if (typeof data.category === 'string') {
        data.categoryId = data.category;
      }
    }

    // Конвертируем backend поля в frontend формат
    data.shuffleQuestions = data.shuffle_questions !== undefined ? data.shuffle_questions : true;
    data.showResults = data.show_results !== undefined ? data.show_results : true;
    data.requiresVideoRecording = data.requires_video_recording !== undefined ? data.requires_video_recording : false;

    console.log(`testsService.getTest(${id}) - After conversion:`, {
      requiresVideoRecording: data.requiresVideoRecording,
      requires_video_recording: data.requires_video_recording
    });

    return data as Test;
  },

  async createTest(test: Partial<Test>): Promise<Test> {
    // Сохраняем вопросы отдельно
    const questions = test.questions || [];
    
    // Обрабатываем courseId: если пустая строка, передаем null, иначе значение или null
    let courseId: string | number | null = null;
    if (test.courseId) {
      courseId = test.courseId;
    } else if (test.course) {
      courseId = typeof test.course === 'string' ? test.course : test.course?.id;
    }
    // Если courseId - пустая строка, преобразуем в null
    if (courseId === '' || courseId === undefined) {
      courseId = null;
    }
    
    // Обрабатываем categoryId
    let categoryId: string | number | null = null;
    if (test.categoryId) {
      categoryId = test.categoryId;
    } else if (test.category) {
      categoryId = typeof test.category === 'string' ? test.category : test.category?.id;
    }
    if (categoryId === '' || categoryId === undefined) {
      categoryId = null;
    }

    // Convert frontend format to backend format
    const backendTest: any = {
      ...test,
      course_id: courseId,
      category_id: categoryId,
      passing_score: test.passingScore || test.passing_score,
      time_limit: test.timeLimit || test.time_limit,
      max_attempts: test.maxAttempts || test.max_attempts,
      language: test.language || 'ru',
      is_active: test.is_active !== undefined ? test.is_active : true,
    };
    // Remove frontend-specific fields
    delete backendTest.courseId;
    delete backendTest.course;
    delete backendTest.categoryId;
    delete backendTest.category;
    delete backendTest.passingScore;
    delete backendTest.timeLimit;
    delete backendTest.maxAttempts;
    delete backendTest.status;
    delete backendTest.attemptsUsed;
    delete backendTest.attemptsTotal;
    delete backendTest.questions; // Удаляем вопросы, они будут созданы отдельно
    // Удаляем frontend поля и старое значение requires_video_recording перед установкой нового
    delete backendTest.requiresVideoRecording; // Удаляем frontend поле
    delete backendTest.requires_video_recording; // Удаляем старое значение, если оно есть из ...test
    
    // Конвертируем frontend поля в backend формат
    backendTest.shuffle_questions = test.shuffleQuestions !== undefined ? test.shuffleQuestions : true;
    backendTest.show_results = test.showResults !== undefined ? test.showResults : true;
    // Устанавливаем requires_video_recording из frontend поля, если оно есть
    backendTest.requires_video_recording = test.requiresVideoRecording !== undefined 
      ? test.requiresVideoRecording 
      : (test.requires_video_recording !== undefined ? test.requires_video_recording : false);
    
    // Удаляем остальные frontend поля
    delete backendTest.shuffleQuestions; // Удаляем frontend поле
    delete backendTest.showResults; // Удаляем frontend поле
    
    // Создаем тест без вопросов
    const createdTest = await apiClient.post<any>('/tests/', backendTest);
    
    // Создаем вопросы через отдельный endpoint
    if (questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const backendQuestion = convertQuestionToBackendFormat({
          ...question,
          order: question.order || i + 1,
        });
        try {
          await apiClient.post(`/tests/${createdTest.id}/questions/`, backendQuestion);
        } catch (error) {
          console.error(`Failed to create question ${i + 1}:`, error);
        }
      }
    }
    
    // Загружаем тест с вопросами для возврата
    return this.getTest(String(createdTest.id));
  },

  async updateTest(id: string, test: Partial<Test>): Promise<Test> {
    // Сохраняем вопросы отдельно
    const questions = test.questions || [];
    
    // Обрабатываем courseId: если пустая строка, передаем null, иначе значение или null
    let courseId: string | number | null = null;
    if (test.courseId) {
      courseId = test.courseId;
    } else if (test.course) {
      courseId = typeof test.course === 'string' ? test.course : test.course?.id;
    }
    // Если courseId - пустая строка, преобразуем в null
    if (courseId === '' || courseId === undefined) {
      courseId = null;
    }
    
    // Обрабатываем categoryId
    let categoryId: string | number | null = null;
    if (test.categoryId) {
      categoryId = test.categoryId;
    } else if (test.category) {
      categoryId = typeof test.category === 'string' ? test.category : test.category?.id;
    }
    if (categoryId === '' || categoryId === undefined) {
      categoryId = null;
    }

    // Convert frontend format to backend format
    const backendTest: any = {
      ...test,
      course_id: courseId,
      category_id: categoryId,
      passing_score: test.passingScore || test.passing_score,
      time_limit: test.timeLimit || test.time_limit,
      max_attempts: test.maxAttempts || test.max_attempts,
      language: test.language || 'ru',
      is_active: test.is_active !== undefined ? test.is_active : true,
    };
    // Remove frontend-specific fields
    delete backendTest.courseId;
    delete backendTest.course;
    delete backendTest.categoryId;
    delete backendTest.category;
    delete backendTest.passingScore;
    delete backendTest.timeLimit;
    delete backendTest.maxAttempts;
    delete backendTest.status;
    delete backendTest.attemptsUsed;
    delete backendTest.attemptsTotal;
    delete backendTest.questions; // Удаляем вопросы, они будут обновлены отдельно
    // Удаляем frontend поля и старое значение requires_video_recording перед установкой нового
    delete backendTest.requiresVideoRecording; // Удаляем frontend поле
    delete backendTest.requires_video_recording; // Удаляем старое значение, если оно есть из ...test
    
    // Конвертируем frontend поля в backend формат
    backendTest.shuffle_questions = test.shuffleQuestions !== undefined ? test.shuffleQuestions : true;
    backendTest.show_results = test.showResults !== undefined ? test.showResults : true;
    // Устанавливаем requires_video_recording из frontend поля, если оно есть
    backendTest.requires_video_recording = test.requiresVideoRecording !== undefined 
      ? test.requiresVideoRecording 
      : (test.requires_video_recording !== undefined ? test.requires_video_recording : false);
    
    // Отладочное логирование для проверки отправляемых данных
    console.log(`testsService.updateTest(${id}) - Sending to backend:`, {
      requires_video_recording: backendTest.requires_video_recording,
      test_requiresVideoRecording: test.requiresVideoRecording,
      test_requires_video_recording: test.requires_video_recording,
      backendTest_keys: Object.keys(backendTest)
    });
    
    // Удаляем остальные frontend поля
    delete backendTest.shuffleQuestions; // Удаляем frontend поле
    delete backendTest.showResults; // Удаляем frontend поле
    
    // Обновляем тест
    const response = await apiClient.put(`/tests/${id}/`, backendTest);
    
    console.log(`testsService.updateTest(${id}) - Response from backend:`, {
      requires_video_recording: response?.requires_video_recording,
      response_keys: response ? Object.keys(response) : null
    });
    
    // Получаем существующие вопросы
    const existingQuestions = await this.getTestQuestions(id);
    const existingQuestionIds = new Set(existingQuestions.map(q => String(q.id)));
    const newQuestionIds = new Set(questions.map(q => q.id).filter(id => id && !String(id).startsWith('q-')));
    
    // Удаляем вопросы, которых нет в новом списке
    for (const existingQuestion of existingQuestions) {
      if (!newQuestionIds.has(String(existingQuestion.id))) {
        try {
          await apiClient.delete(`/tests/${id}/questions/${existingQuestion.id}/`);
        } catch (error) {
          console.error(`Failed to delete question ${existingQuestion.id}:`, error);
        }
      }
    }
    
    // Создаем или обновляем вопросы
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const backendQuestion = convertQuestionToBackendFormat({
        ...question,
        order: question.order || i + 1,
      });
      
      const questionId = question.id && !String(question.id).startsWith('q-') ? String(question.id) : null;
      
      try {
        if (questionId && existingQuestionIds.has(questionId)) {
          // Обновляем существующий вопрос
          await apiClient.put(`/tests/${id}/questions/${questionId}/`, backendQuestion);
        } else {
          // Создаем новый вопрос
          await apiClient.post(`/tests/${id}/questions/`, backendQuestion);
        }
      } catch (error) {
        console.error(`Failed to save question ${i + 1}:`, error);
        // Продолжаем обработку остальных вопросов
      }
    }
    
    // Загружаем обновленный тест с вопросами для возврата
    return this.getTest(id);
  },

  async deleteTest(id: string): Promise<void> {
    await apiClient.delete(`/tests/${id}/`);
  },

  async getTestQuestions(testId: string): Promise<Question[]> {
    let allQuestions: any[] = [];
    let nextUrl: string | null = `/tests/${testId}/questions/`;
    
    // Функция для извлечения относительного пути из полного URL
    const extractRelativePath = (url: string | null): string | null => {
      if (!url) return null;
      
      // Если это полный URL (начинается с http:// или https://)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const urlObj = new URL(url);
          // Извлекаем путь и query параметры
          let path = urlObj.pathname + urlObj.search;
          
          // Убираем префикс /api если он есть, так как базовый URL уже содержит /api
          if (path.startsWith('/api/')) {
            path = path.substring(4); // Убираем '/api'
          }
          
          return path;
        } catch (e) {
          // Если не удалось распарсить, возвращаем null
          return null;
        }
      }
      
      // Если это уже относительный путь, убираем /api если он есть
      if (url.startsWith('/api/')) {
        return url.substring(4); // Убираем '/api'
      }
      
      return url;
    };
    
    // Загружаем все вопросы, обрабатывая пагинацию если она есть
    while (nextUrl) {
      const data = await apiClient.get<any>(nextUrl);
      
      // Backend может возвращать данные в разных форматах:
      // 1. Прямой массив: [question1, question2, ...]
      // 2. Пагинированный ответ: { results: [...], count: N, next: ..., previous: ... }
      // 3. Объект с данными: { data: [...] }
      
      let questionsArray: any[] = [];
      if (Array.isArray(data)) {
        questionsArray = data;
        nextUrl = null; // Если массив, значит это все вопросы
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.results)) {
          questionsArray = data.results;
          // Извлекаем относительный путь из next URL
          nextUrl = extractRelativePath(data.next);
        } else if (Array.isArray(data.data)) {
          questionsArray = data.data;
          nextUrl = null;
        } else if (Array.isArray(data.questions)) {
          questionsArray = data.questions;
          nextUrl = null;
        } else {
          nextUrl = null; // Если нет массива, значит это не пагинированный ответ
        }
      } else {
        nextUrl = null;
      }
      
      allQuestions = allQuestions.concat(questionsArray);
    }
    
    // Конвертируем вопросы из backend формата в frontend формат
    return allQuestions.map((q: any) => convertQuestionFromBackendFormat(q));
  },

  async addQuestion(testId: string, question: Partial<Question>): Promise<Question> {
    const backendQuestion = convertQuestionToBackendFormat(question as Question);
    const created = await apiClient.post<any>(`/tests/${testId}/questions/`, backendQuestion);
    return convertQuestionFromBackendFormat(created);
  },

  async updateQuestion(testId: string, questionId: string, question: Partial<Question>): Promise<Question> {
    const backendQuestion = convertQuestionToBackendFormat(question as Question);
    const updated = await apiClient.put<any>(`/tests/${testId}/questions/${questionId}/`, backendQuestion);
    return convertQuestionFromBackendFormat(updated);
  },

  async deleteQuestion(testId: string, questionId: string): Promise<void> {
    await apiClient.delete(`/tests/${testId}/questions/${questionId}/`);
  },

  async requestCompletionOTP(testId: string): Promise<{
    message: string;
    otp_code?: string;
    otp_expires_at?: string;
    otp_is_new: boolean;
    sms_sent: boolean;
    sms_error?: string;
    warning?: string;
    debug?: boolean;
    debug_reason?: string;
  }> {
    return await apiClient.post(`/tests/${testId}/request_completion_otp/`, {});
  },

  async verifyCompletionOTP(testId: string, otpCode: string): Promise<{
    message: string;
    protocol_id: number;
  }> {
    return await apiClient.post(`/tests/${testId}/verify_completion_otp/`, {
      otp_code: otpCode,
    });
  },

  async createEnrollmentRequest(testId: string): Promise<TestEnrollmentRequest> {
    const data = await apiClient.post<TestEnrollmentRequest>(
      '/tests/enrollment-requests/',
      { test_id: parseInt(testId) }
    );
    return data;
  },

  async getEnrollmentRequests(): Promise<TestEnrollmentRequest[]> {
    const data = await apiClient.get<any>('/tests/enrollment-requests/');
    // Обработка пагинированного ответа
    if (data && typeof data === 'object' && 'results' in data) {
      return Array.isArray(data.results) ? data.results : [];
    }
    // Обработка обычного массива
    return Array.isArray(data) ? data : [];
  },

  async getMyEnrollmentRequests(): Promise<TestEnrollmentRequest[]> {
    const data = await apiClient.get<TestEnrollmentRequest[]>('/tests/enrollment-requests/my_requests/');
    return Array.isArray(data) ? data : [];
  },

  async approveEnrollmentRequest(requestId: string, adminResponse?: string): Promise<TestEnrollmentRequest> {
    const data = await apiClient.post<TestEnrollmentRequest>(
      `/tests/enrollment-requests/${requestId}/approve/`,
      adminResponse ? { admin_response: adminResponse } : {}
    );
    return data;
  },

  async rejectEnrollmentRequest(requestId: string, reason: string): Promise<TestEnrollmentRequest> {
    const data = await apiClient.post<TestEnrollmentRequest>(
      `/tests/enrollment-requests/${requestId}/reject/`,
      { admin_response: reason }
    );
    return data;
  },
};

export { testsService };

