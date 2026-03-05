/**
 * Адаптеры для преобразования типов между frontend и backend
 */
import { Question, Protocol, Signature, TestAttempt as FrontendTestAttempt } from '../types/lms';

/**
 * Преобразование вопроса из backend в frontend формат
 */
export function adaptQuestion(backendQuestion: any): Question {
  return {
    id: String(backendQuestion.id),
    type: backendQuestion.type,
    text: backendQuestion.text,
    options: backendQuestion.options?.map((opt: any) => opt.text) || [],
    correctAnswer: backendQuestion.options?.find((opt: any) => opt.is_correct)?.text || 
                   backendQuestion.options?.filter((opt: any) => opt.is_correct).map((opt: any) => opt.text),
    order: backendQuestion.order,
    weight: backendQuestion.weight || 1,
  };
}

/**
 * Преобразование протокола из backend в frontend формат
 */
export function adaptProtocol(backendProtocol: any): Protocol {
  // Проверяем, не является ли протокол уже адаптированным (если есть userName, значит уже адаптирован)
  if (backendProtocol.userName && !backendProtocol.student) {
    return backendProtocol as Protocol;
  }
  
  // Обработка даты экзамена
  let examDate: Date;
  if (backendProtocol.exam_date) {
    examDate = new Date(backendProtocol.exam_date);
    // Проверка на валидность даты
    if (isNaN(examDate.getTime())) {
      examDate = new Date(); // Fallback к текущей дате если дата невалидна
    }
  } else if (backendProtocol.examDate) {
    // Если дата уже в формате Date
    examDate = backendProtocol.examDate instanceof Date 
      ? backendProtocol.examDate 
      : new Date(backendProtocol.examDate);
  } else {
    examDate = new Date(); // Fallback к текущей дате если дата отсутствует
  }
  
  // Извлекаем данные студента
  const studentFullName = backendProtocol.student?.full_name 
    || backendProtocol.student_name 
    || backendProtocol.userName 
    || null;
  const studentIIN = backendProtocol.student?.iin 
    || backendProtocol.userIIN 
    || null;
  const studentPhone = backendProtocol.student?.phone 
    || backendProtocol.student_phone 
    || backendProtocol.userPhone 
    || null;
  
  // Извлекаем данные курса
  const courseTitle = backendProtocol.course?.title 
    || backendProtocol.course_name 
    || backendProtocol.courseName 
    || null;
  
  // Извлекаем данные теста (для standalone тестов)
  const testTitle = backendProtocol.test?.title 
    || backendProtocol.test_name 
    || backendProtocol.testName 
    || null;
  
  // Для standalone тестов используем название теста в качестве courseName
  const displayCourseName = courseTitle || testTitle || null;
  
  const adapted = {
    id: String(backendProtocol.id),
    number: backendProtocol.number,
    userId: String(backendProtocol.student?.id || backendProtocol.student || backendProtocol.userId || ''),
    userName: studentFullName || 'Не указано',
    userIIN: studentIIN || 'Не указано',
    userPhone: studentPhone || 'Не указано',
    courseId: String(backendProtocol.course?.id || backendProtocol.course || backendProtocol.courseId || ''),
    courseName: displayCourseName || 'Не указано',
    testId: String(backendProtocol.test?.id || backendProtocol.test || backendProtocol.testId || ''),
    testName: testTitle || 'Не указано',
    attemptId: backendProtocol.attempt?.id 
      ? String(backendProtocol.attempt.id) 
      : backendProtocol.attempt 
        ? String(backendProtocol.attempt)
        : backendProtocol.attemptId
        ? String(backendProtocol.attemptId)
        : undefined,
    examDate: examDate,
    score: backendProtocol.score || 0,
    passingScore: backendProtocol.passing_score || backendProtocol.passingScore || 0,
    result: backendProtocol.result || 'passed',
    status: backendProtocol.status,
    signatures: (backendProtocol.signatures || []).map((sig: any) => adaptSignature(sig)),
    rejectionReason: backendProtocol.rejection_reason || backendProtocol.rejectionReason,
    file: backendProtocol.file || undefined,
    uploaded_by: backendProtocol.uploaded_by,
    uploaded_at: backendProtocol.uploaded_at,
  };
  
  return adapted;
}

/**
 * Преобразование подписи из backend в frontend формат
 */
export function adaptSignature(backendSignature: any): Signature {
  const signerId = backendSignature.signer?.id || backendSignature.user_id || backendSignature.signer;
  return {
    signer: backendSignature.signer ? {
      id: String(backendSignature.signer.id),
      full_name: backendSignature.signer.full_name || '',
      phone: backendSignature.signer.phone || '',
    } : undefined,
    userId: signerId ? String(signerId) : undefined,
    userName: backendSignature.signer?.full_name || backendSignature.user_name || '',
    role: backendSignature.role,
    phone: backendSignature.signer?.phone || backendSignature.phone || '',
    signed_at: backendSignature.signed_at,
    signedAt: backendSignature.signed_at ? new Date(backendSignature.signed_at) : undefined,
    otp_verified: backendSignature.otp_verified,
    otpVerified: backendSignature.otp_verified || backendSignature.otpVerified || false,
    signType: backendSignature.sign_type || 'otp',
    edsCertificateInfo: backendSignature.eds_certificate_info || undefined,
  };
}

/**
 * Преобразование попытки теста из backend в frontend формат
 */
export function adaptTestAttempt(backendAttempt: any): FrontendTestAttempt {
  return {
    id: String(backendAttempt.id),
    testId: String(backendAttempt.test?.id || backendAttempt.test),
    userId: String(backendAttempt.student?.id || backendAttempt.student),
    startedAt: new Date(backendAttempt.started_at),
    completedAt: backendAttempt.completed_at ? new Date(backendAttempt.completed_at) : undefined,
    score: backendAttempt.score,
    passed: backendAttempt.passed,
    answers: (backendAttempt.answers || []).map((ans: any) => ({
      questionId: String(ans.question?.id || ans.question),
      answer: ans.answer_text || ans.selected_options?.map((opt: any) => opt.text) || ans.answer || '',
      isCorrect: ans.is_correct,
    })),
    ipAddress: backendAttempt.ip_address,
    userAgent: backendAttempt.user_agent,
  };
}

