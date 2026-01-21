// Роли пользователей
export type UserRole = 
  | 'guest'
  | 'student'
  | 'pdek_member'
  | 'pdek_chairman'
  | 'teacher'
  | 'admin';

// Статусы курса
export type CourseStatus =
  | 'in_development'
  | 'draft'
  | 'published'
  | 'assigned'
  | 'in_progress'
  | 'exam_available'
  | 'exam_passed'
  | 'pending_pdek'
  | 'completed'
  | 'failed'
  | 'annulled';

// Статусы протокола
export type ProtocolStatus =
  | 'generated'
  | 'pending_pdek'
  | 'signed_members'
  | 'signed_chairman'
  | 'rejected'
  | 'annulled';

// Статусы теста
export type TestStatus =
  | 'available'
  | 'in_progress'
  | 'pending_result'
  | 'passed'
  | 'failed';

// Категории курсов (старый формат для обратной совместимости)
export type CourseCategory =
  | 'industrial_safety'
  | 'fire_safety'
  | 'electrical_safety'
  | 'labor_protection'
  | 'professions'
  | string; // Для поддержки динамических категорий

// Интерфейс категории из API
export interface Category {
  id: string;
  name: string;
  name_kz?: string;
  name_en?: string;
  description?: string;
  icon?: string;
  order: number;
  is_active: boolean;
  courses_count?: number;
  created_at?: string;
  updated_at?: string;
}

// Типы вопросов
export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'yes_no'
  | 'matching'
  | 'ordering'
  | 'short_answer';

// Интерфейсы

export interface User {
  id: string;
  role: UserRole;
  phone: string;
  iin?: string;
  full_name?: string; // Backend format
  fullName?: string; // Frontend format (for compatibility)
  email?: string;
  city?: string;
  organization?: string;
  verified: boolean;
  is_active?: boolean; // Backend format
  isActive?: boolean; // Frontend format (for compatibility)
  language: 'ru' | 'kz' | 'en';
  created_at?: string;
  updated_at?: string;
}

export interface Course {
  id: string;
  title: string;
  title_kz?: string; // Backend format (legacy, for backward compatibility)
  titleKz?: string; // Frontend format (for compatibility)
  title_en?: string; // Backend format (legacy, for backward compatibility)
  titleEn?: string; // Frontend format (for compatibility)
  category?: CourseCategory | Category | { id: string; name: string }; // Может быть строкой, объектом Category или объектом с id и name
  categoryId?: string; // ID категории для записи
  description: string;
  description_kz?: string; // Backend format (legacy, for backward compatibility)
  descriptionEn?: string; // Frontend format (for compatibility)
  description_en?: string; // Backend format (legacy, for backward compatibility)
  language: 'ru' | 'kz' | 'en';
  duration: number; // в часах
  format: 'online' | 'offline' | 'blended';
  passing_score?: number; // Backend format
  passingScore?: number; // Frontend format (for compatibility)
  max_attempts?: number; // Backend format
  maxAttempts?: number; // Frontend format (for compatibility)
  has_timer?: boolean; // Backend format
  hasTimer?: boolean; // Frontend format (for compatibility)
  timer_minutes?: number; // Backend format
  timerMinutes?: number; // Frontend format (for compatibility)
  modules?: Module[];
  pdek_commission?: string; // Backend format
  pdekCommission?: string; // Frontend format (for compatibility)
  status: CourseStatus;
  progress?: number; // процент (для enrollment)
  enrollment_status?: CourseStatus; // Статус enrollment (для with_progress endpoint)
  final_test_id?: number; // ID финального теста
  finalTestId?: number; // Frontend format (for compatibility)
  is_standalone_test?: boolean; // Backend format
  isStandaloneTest?: boolean; // Frontend format (for compatibility)
  created_at?: string;
  updated_at?: string;
}

export interface Module {
  id: string;
  title: string;
  title_kz?: string; // Backend format (legacy, for backward compatibility)
  titleKz?: string; // Frontend format (for compatibility)
  title_en?: string; // Backend format (legacy, for backward compatibility)
  titleEn?: string; // Frontend format (for compatibility)
  description?: string;
  description_kz?: string; // Backend format (legacy, for backward compatibility)
  descriptionKz?: string; // Frontend format (for compatibility)
  description_en?: string; // Backend format (legacy, for backward compatibility)
  descriptionEn?: string; // Frontend format (for compatibility)
  language: 'ru' | 'kz' | 'en';
  order: number;
  lessons: Lesson[];
  completed: boolean;
}

export interface Lesson {
  id: string;
  moduleId?: string; // Опционально, так как может приходить из API без этого поля
  title: string;
  title_kz?: string; // Backend format (legacy, for backward compatibility)
  titleKz?: string; // Frontend format (for compatibility)
  title_en?: string; // Backend format (legacy, for backward compatibility)
  titleEn?: string; // Frontend format (for compatibility)
  description?: string;
  description_kz?: string; // Backend format (legacy, for backward compatibility)
  descriptionKz?: string; // Frontend format (for compatibility)
  description_en?: string; // Backend format (legacy, for backward compatibility)
  descriptionEn?: string; // Frontend format (for compatibility)
  type: 'text' | 'video' | 'pdf' | 'ppt' | 'quiz';
  content?: string;
  content_kz?: string; // Backend format (legacy, for backward compatibility)
  contentKz?: string; // Frontend format (for compatibility)
  content_en?: string; // Backend format (legacy, for backward compatibility)
  contentEn?: string; // Frontend format (for compatibility)
  language: 'ru' | 'kz' | 'en';
  videoUrl?: string;
  video_url?: string; // Backend format
  thumbnailUrl?: string;
  thumbnail_url?: string; // Backend format
  pdfUrl?: string;
  pdf_url?: string; // Backend format
  pptUrl?: string;
  ppt_url?: string; // Backend format
  testId?: string;
  test_id?: string; // Backend format
  duration?: number; // минуты
  order: number;
  completed?: boolean; // Опционально, так как может не приходить из обычного API
  required?: boolean;
  allowDownload?: boolean;
  allow_download?: boolean; // Backend format
  trackProgress?: boolean;
  track_progress?: boolean; // Backend format
  passingScore?: number;
  passing_score?: number; // Backend format
  maxAttempts?: number;
  max_attempts?: number; // Backend format
  created_at?: string;
  updated_at?: string;
}

export interface Test {
  id: string;
  course?: string | { id: string; title: string }; // Backend может вернуть ID или объект
  courseId?: string; // Frontend format
  title: string;
  title_kz?: string; // Backend format (legacy, for backward compatibility)
  titleKz?: string; // Frontend format (for compatibility)
  title_en?: string; // Backend format (legacy, for backward compatibility)
  titleEn?: string; // Frontend format (for compatibility)
  language: 'ru' | 'kz' | 'en';
  passing_score?: number; // Backend format
  passingScore?: number; // Frontend format (for compatibility)
  time_limit?: number; // Backend format
  timeLimit?: number; // Frontend format (for compatibility)
  max_attempts?: number; // Backend format
  maxAttempts?: number; // Frontend format (for compatibility)
  is_active?: boolean; // Backend format
  requires_video_recording?: boolean; // Backend format
  requiresVideoRecording?: boolean; // Frontend format (for compatibility)
  category?: Category; // Backend format
  categoryId?: string; // Frontend format (for compatibility)
  is_standalone?: boolean; // Backend format
  isStandalone?: boolean; // Frontend format (for compatibility)
  questions_count?: number; // Backend format (readonly)
  questionsCount?: number; // Frontend format (for compatibility)
  attemptsUsed?: number; // Frontend only
  attemptsTotal?: number; // Frontend only
  status?: TestStatus; // Frontend only
  questions?: Question[];
  created_at?: string;
  updated_at?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  text_kz?: string; // Backend format (legacy, for backward compatibility)
  textKz?: string; // Frontend format (for compatibility)
  text_en?: string; // Backend format (legacy, for backward compatibility)
  textEn?: string; // Frontend format (for compatibility)
  language: 'ru' | 'kz' | 'en';;
  options?: Array<{ id: string; text: string; is_correct?: boolean }> | string[]; // Backend возвращает объекты
  correctAnswer?: string | string[]; // Frontend format (computed)
  order: number;
  weight: number;
}

export interface AnswerDetail {
  question_id: number;
  question_text: string;
  question_type: string;
  user_answer: any;
  user_answer_display: string;
  correct_answers: any[];
  correct_answer_display: string;
  is_correct: boolean;
}

export interface TestAttempt {
  id: string;
  test?: Test | string; // Backend может вернуть объект или ID
  testId?: string; // Frontend format
  user?: any; // Backend может вернуть объект пользователя
  userId?: string; // Frontend format
  started_at?: string; // Backend format (ISO string)
  startedAt?: Date | string; // Frontend format
  completed_at?: string; // Backend format (ISO string)
  completedAt?: Date | string; // Frontend format
  score?: number;
  passed?: boolean;
  answers?: Record<string, any>;
  answer_details?: AnswerDetail[];
  answerDetails?: AnswerDetail[]; // Frontend format
  video_recording?: string; // Backend format (URL)
  videoRecording?: string; // Frontend format (URL)
}

export interface ExtraAttemptRequest {
  id: string;
  user?: any; // Backend может вернуть объект пользователя
  userId?: string;
  test?: Test | string; // Backend может вернуть объект или ID
  testId?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_response?: string;
  processed_by?: any; // Backend может вернуть объект администратора
  processed_by_id?: string;
  processed_at?: string; // ISO string
  createdAt?: string; // Frontend format
  created_at?: string; // Backend format
  updatedAt?: string; // Frontend format
  updated_at?: string; // Backend format
  answers?: Record<string, any> | Answer[]; // Backend возвращает Record, frontend может использовать Answer[]
  ip_address?: string; // Backend format
  ipAddress?: string; // Frontend format
  user_agent?: string; // Backend format
  userAgent?: string; // Frontend format
}

export interface Answer {
  questionId: string;
  answer: string | string[];
  isCorrect?: boolean;
}

export interface Protocol {
  id: string;
  number: string;
  student?: { id: string; full_name: string; iin?: string; phone: string }; // Backend format
  userId?: string; // Frontend format (computed)
  userName?: string; // Frontend format (computed)
  userIIN?: string; // Frontend format (computed)
  userPhone?: string; // Frontend format (computed)
  course?: { id: string; title: string }; // Backend format
  courseId?: string; // Frontend format (computed)
  courseName?: string; // Frontend format (computed)
  test?: { id: string; title: string }; // Backend format (for standalone tests)
  testId?: string; // Frontend format (computed)
  testName?: string; // Frontend format (computed)
  attempt?: { id: string }; // Backend format
  attemptId?: string; // Frontend format (computed)
  exam_date?: string; // Backend format
  examDate?: Date | string; // Frontend format
  score: number;
  passing_score?: number; // Backend format
  passingScore?: number; // Frontend format (for compatibility)
  result: 'passed' | 'failed';
  status: ProtocolStatus;
  signatures?: Signature[];
  rejection_reason?: string; // Backend format
  rejectionReason?: string; // Frontend format (for compatibility)
  created_at?: string;
  updated_at?: string;
}

export interface Signature {
  signer?: { id: string; full_name: string; phone: string }; // Backend format
  userId?: string; // Frontend format (computed)
  userName?: string; // Frontend format (computed)
  role: 'member' | 'chairman';
  phone?: string; // Frontend format (computed)
  signed_at?: string; // Backend format
  signedAt?: Date | string; // Frontend format
  otp_verified?: boolean; // Backend format
  otpVerified?: boolean; // Frontend format (for compatibility)
}

export interface CertificateTemplate {
  id: string;
  name: string;
  description?: string;
  file?: string; // URL to template file
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Certificate {
  id: string;
  number: string;
  student?: { id: string; full_name: string }; // Backend format
  userId?: string; // Frontend format (computed)
  userName?: string; // Frontend format (computed)
  course?: { id: string; title: string }; // Backend format
  courseId?: string; // Frontend format (computed)
  courseName?: string; // Frontend format (computed)
  protocol?: { id: string }; // Backend format
  protocolId?: string; // Frontend format (computed)
  template?: CertificateTemplate; // Backend format
  templateId?: string; // Frontend format (computed)
  file?: string; // URL to uploaded certificate file (Backend format)
  fileUrl?: string; // Frontend format (for compatibility)
  uploaded_by?: { id: string; full_name: string }; // Backend format
  uploadedById?: string; // Frontend format (computed)
  uploadedBy?: string; // Frontend format (computed)
  uploaded_at?: string; // Backend format
  uploadedAt?: Date | string; // Frontend format
  issued_at?: string; // Backend format
  issuedAt?: Date | string; // Frontend format
  valid_until?: string; // Backend format
  validUntil?: Date | string; // Frontend format
  qr_code?: string; // Backend format
  qrCode?: string; // Frontend format (for compatibility)
  pdf_url?: string; // Backend format
  pdfUrl?: string; // Frontend format (for compatibility)
}

export interface PendingCertificate {
  enrollment_id: string;
  student: User;
  course: Course;
  completed_at?: string;
  certificate_id?: string;
  certificate_number?: string;
  has_certificate_record: boolean;
  needs_upload: boolean;
}

export interface PDEKCommission {
  id: string;
  name: string;
  chairman: User;
  members: User[];
  courses: string[]; // course IDs
}

export interface Notification {
  id: string;
  userId: string;
  type: 'course_assigned' | 'exam_available' | 'protocol_ready' | 'certificate_issued' | 'pdek_signature_request';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  message: string;
  status: 'created' | 'in_progress' | 'resolved';
  createdAt: Date;
  updatedAt?: Date;
  responses: TicketResponse[];
}

export interface TicketResponse {
  id: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: Date;
}