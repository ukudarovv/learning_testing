import { useState, useEffect } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, PlayCircle, FileText, Video, Download, ChevronRight, ChevronDown, Lock, ArrowLeft, X, RotateCcw, AlertCircle, Clock, BookOpen, Award, Info, Send, Eye, Play, XCircle, FileCheck } from 'lucide-react';
import { Course, Module, Lesson, Test, Answer, TestAttempt, ExtraAttemptRequest } from '../../types/lms';
import { Link } from 'react-router-dom';
import { testsService } from '../../services/tests';
import { examsService } from '../../services/exams';
import { TestInterface } from './TestInterface';
import { TestResultModal } from './TestResultModal';
import { ExtraAttemptRequestModal } from './ExtraAttemptRequestModal';
import { SMSVerification } from './SMSVerification';
import { coursesService } from '../../services/courses';
import { useUser } from '../../contexts/UserContext';
import { toast } from 'sonner';
import { PPTViewer } from './PPTViewer';
import { PdfViewer } from './PdfViewer';

interface CoursePlayerProps {
  course: Course;
  onLessonComplete: (lessonId: string) => void;
  onCourseComplete: () => void;
}

export function CoursePlayer({ course, onLessonComplete, onCourseComplete }: CoursePlayerProps) {
  const { t } = useTranslation();
  // Убеждаемся, что modules - это массив
  const courseModules = course.modules && Array.isArray(course.modules) 
    ? course.modules 
    : [];
  
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(
    courseModules[0]?.lessons?.[0] || null
  );
  const [expandedModules, setExpandedModules] = useState<string[]>(
    courseModules.map(m => m.id)
  );
  const [showTestModal, setShowTestModal] = useState(false);
  const [test, setTest] = useState<Test | null>(null);
  const [testAttemptId, setTestAttemptId] = useState<number | null>(null);
  const [loadingTest, setLoadingTest] = useState(false);
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [testResult, setTestResult] = useState<TestAttempt | null>(null);
  const [testTimeSpent, setTestTimeSpent] = useState(0);
  const [showExtraAttemptModal, setShowExtraAttemptModal] = useState(false);
  const [extraAttemptRequests, setExtraAttemptRequests] = useState<ExtraAttemptRequest[]>([]);
  const [loadingExtraRequest, setLoadingExtraRequest] = useState(false);
  const [showSMSVerification, setShowSMSVerification] = useState(false);
  const [loadingOTP, setLoadingOTP] = useState(false);
  const [finalTestPassed, setFinalTestPassed] = useState(false);
  const [loadingFinalTestStatus, setLoadingFinalTestStatus] = useState(false);
  const [finalTestAttempts, setFinalTestAttempts] = useState<TestAttempt[]>([]);
  const [finalTestExtraAttemptRequests, setFinalTestExtraAttemptRequests] = useState<ExtraAttemptRequest[]>([]);
  const [finalTestData, setFinalTestData] = useState<Test | null>(null);
  const [showFinalTestExtraAttemptModal, setShowFinalTestExtraAttemptModal] = useState(false);
  const { user } = useUser();

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleLessonComplete = async () => {
    if (selectedLesson) {
      await onLessonComplete(selectedLesson.id);
      
      // Auto-navigate to next lesson
      const nextLesson = getNextLesson();
      if (nextLesson) {
        setSelectedLesson(nextLesson);
      } else {
        // All lessons completed - check for final test
        // Calculate if all lessons are completed
        const completedCount = courseModules.reduce(
          (count, module) => {
            const moduleLessons = module.lessons && Array.isArray(module.lessons) ? module.lessons : [];
            return count + moduleLessons.filter(l => l.completed === true).length;
          },
          0
        );
        const totalCount = courseModules.reduce(
          (count, module) => {
            const moduleLessons = module.lessons && Array.isArray(module.lessons) ? module.lessons : [];
            return count + moduleLessons.length;
          },
          0
        );
        const allLessonsCompleted = completedCount + 1 >= totalCount && totalCount > 0;
        
        // Кнопка "Завершить курс" будет доступна на странице, если все уроки завершены
        // и финальный тест пройден (если он есть)
        // Больше не вызываем handleRequestCompletionOTP автоматически
      }
    }
  };

  // Загружаем попытки и запросы на дополнительные попытки при выборе урока с тестом
  useEffect(() => {
    const loadAttempts = async () => {
      if (!selectedLesson) return;
      
      const testId = selectedLesson.testId || selectedLesson.test_id;
      if (!testId) {
        setTestAttempts([]);
        setExtraAttemptRequests([]);
        return;
      }

      try {
        setLoadingAttempts(true);
        const attempts = await examsService.getTestAttempts(String(testId));
        setTestAttempts(attempts);
      } catch (error: any) {
        console.error('Failed to load attempts:', error);
        setTestAttempts([]);
      } finally {
        setLoadingAttempts(false);
      }

      // Загружаем все запросы на дополнительные попытки для этого теста
      try {
        setLoadingExtraRequest(true);
        const allRequests = await examsService.getExtraAttemptRequests();
        // Фильтруем все запросы для текущего теста
        const requestsForThisTest = allRequests.filter(r => {
          const rTestId = typeof r.test === 'object' ? r.test?.id : r.testId || r.test;
          return String(rTestId) === String(testId);
        });
        setExtraAttemptRequests(requestsForThisTest);
      } catch (error: any) {
        console.error('Failed to load extra attempt requests:', error);
        setExtraAttemptRequests([]);
      } finally {
        setLoadingExtraRequest(false);
      }
    };

    loadAttempts();
  }, [selectedLesson]);

  const handleStartQuiz = async () => {
    if (!selectedLesson) return;
    
    const testId = selectedLesson.testId || selectedLesson.test_id;
    if (!testId) {
      toast.error(t('lms.coursePlayer.testNotLinked'));
      return;
    }

    try {
      setLoadingTest(true);
      // Проверяем, есть ли незавершенная попытка
      const incompleteAttempt = testAttempts.find(
        attempt => !attempt.completed_at && !attempt.completedAt
      );
      
      if (incompleteAttempt) {
        // Продолжаем незавершенную попытку
        await handleContinueTest(incompleteAttempt.id);
        return;
      }

      // Проверяем, есть ли отличная попытка (score >= 90)
      const excellentAttempt = testAttempts.find(
        attempt => {
          const completedAt = attempt.completed_at || attempt.completedAt;
          const score = attempt.score;
          const passed = attempt.passed;
          return completedAt && score !== null && score !== undefined && score >= 90 && passed;
        }
      );
      
      if (excellentAttempt) {
        toast.error(t('lms.coursePlayer.excellentPassBlocked') || 'Тест уже пройден на отлично (90%+). Дополнительные попытки недоступны.');
        setLoadingTest(false);
        return;
      }

      // Загружаем тест
      const loadedTest = await testsService.getTest(String(testId));
      
      if (!loadedTest.questions || loadedTest.questions.length === 0) {
        toast.error(t('lms.coursePlayer.noQuestions'));
        setLoadingTest(false);
        return;
      }

      // Проверяем количество попыток (с учетом одобренных дополнительных попыток)
      const maxAttempts = loadedTest.maxAttempts || loadedTest.max_attempts || 3;
      const approvedCount = extraAttemptRequests.filter(r => r.status === 'approved').length;
      const maxAllowed = maxAttempts + approvedCount;
      const attemptsCount = testAttempts.length;
      
      if (attemptsCount >= maxAllowed) {
        toast.error(t('lms.coursePlayer.maxAttemptsReached', { max: maxAllowed }));
        setLoadingTest(false);
        return;
      }

      // Начинаем попытку
      const attempt = await examsService.startTestAttempt(String(testId));
      const attemptIdNum = Number(attempt.id);
      
      setTest(loadedTest);
      setTestAttemptId(attemptIdNum);
      setShowTestModal(true);
      
      // Сохраняем attemptId в localStorage для автосохранения
      localStorage.setItem(`test_${testId}_progress`, JSON.stringify({
        attemptId: attemptIdNum,
      }));
    } catch (error: any) {
      toast.error(error.message || t('lms.coursePlayer.errorLoadingTest'));
      console.error('Failed to start quiz:', error);
    } finally {
      setLoadingTest(false);
    }
  };

  const handleContinueTest = async (attemptId: string) => {
    if (!selectedLesson) return;
    
    const testId = selectedLesson.testId || selectedLesson.test_id;
    if (!testId) {
      toast.error(t('lms.coursePlayer.testNotLinked'));
      return;
    }

    try {
      setLoadingTest(true);
      
      // Загружаем попытку и тест
      const [attempt, loadedTest] = await Promise.all([
        examsService.getTestAttempt(attemptId),
        testsService.getTest(String(testId))
      ]);
      
      if (!loadedTest.questions || loadedTest.questions.length === 0) {
        toast.error(t('lms.coursePlayer.noQuestions'));
        setLoadingTest(false);
        return;
      }

      const attemptIdNum = Number(attempt.id);
      const savedAnswers = attempt.answers || {};
      const startedAtDate = attempt.started_at || attempt.startedAt;
      
      setTest(loadedTest);
      setTestAttemptId(attemptIdNum);
      setShowTestModal(true);
      
      // Сохраняем attemptId и ответы в localStorage для автосохранения
      localStorage.setItem(`test_${testId}_progress`, JSON.stringify({
        attemptId: attemptIdNum,
        answers: savedAnswers,
        startedAt: startedAtDate
      }));
      
      toast.success(t('lms.coursePlayer.testContinueSuccess'));
    } catch (error: any) {
      toast.error(error.message || t('lms.coursePlayer.attemptLoadError'));
      console.error('Failed to continue test:', error);
    } finally {
      setLoadingTest(false);
    }
  };

  const handleViewTestResult = async (attemptId: string) => {
    if (!selectedLesson) return;
    
    const testId = selectedLesson.testId || selectedLesson.test_id;
    if (!testId) {
      toast.error(t('lms.coursePlayer.testNotLinked'));
      return;
    }

    try {
      setLoadingTest(true);
      
      // Загружаем попытку и тест
      const [attempt, loadedTest] = await Promise.all([
        examsService.getTestAttempt(attemptId),
        testsService.getTest(String(testId))
      ]);
      
      // Вычисляем время прохождения
      const startedDate = attempt.started_at || attempt.startedAt;
      const completedDate = attempt.completed_at || attempt.completedAt;
      let timeSpent = 0;
      
      if (startedDate && completedDate) {
        const started = typeof startedDate === 'string' ? new Date(startedDate) : startedDate;
        const completed = typeof completedDate === 'string' ? new Date(completedDate) : completedDate;
        timeSpent = Math.floor((completed.getTime() - started.getTime()) / 1000);
      }
      
      setTest(loadedTest);
      setTestResult(attempt);
      setTestTimeSpent(timeSpent);
      setShowResultModal(true);
    } catch (error: any) {
      toast.error(error.message || t('lms.coursePlayer.resultsLoadError'));
      console.error('Failed to load test result:', error);
    } finally {
      setLoadingTest(false);
    }
  };

  const handleTestComplete = async (answers: Answer[], timeSpent: number, videoBlob?: Blob) => {
    if (!test || !testAttemptId) return;

    // Check if this is the final test
    const isFinalTest = course.final_test_id && String(test.id) === String(course.final_test_id);
    
    if (isFinalTest) {
      handleFinalTestComplete(answers, timeSpent, videoBlob);
      return;
    }

    try {
      // Отправляем ответы на сервер
      const answersData: Record<string, any> = {};
      answers.forEach(answer => {
        answersData[answer.questionId] = answer.answer;
      });

      await examsService.saveTestAttempt(String(testAttemptId), answersData);
      const result = await examsService.submitTestAttempt(String(testAttemptId), videoBlob);

      // Удаляем сохраненный прогресс
      localStorage.removeItem(`test_${test.id}_progress`);

      // Сохраняем результат и время
      setTestResult(result);
      setTestTimeSpent(timeSpent);

      // Обновляем список попыток
      const updatedAttempts = await examsService.getTestAttempts(test.id);
      setTestAttempts(updatedAttempts);

      // Закрываем модальное окно теста
      setShowTestModal(false);
      setTest(null);
      setTestAttemptId(null);

      // Показываем модальное окно результатов
      setShowResultModal(true);

      // Автоматически отмечаем урок как завершенный, если тест пройден
      if (result.passed) {
        handleLessonComplete();
      }
    } catch (error: any) {
      toast.error(error.message || t('lms.coursePlayer.testCompleteError'));
      console.error('Failed to complete test:', error);
    }
  };

  const handleTestCancel = () => {
    setShowTestModal(false);
    setTest(null);
    setTestAttemptId(null);
  };

  const handleFinalTestComplete = async (answers: Answer[], timeSpent: number, videoBlob?: Blob) => {
    if (!test || !testAttemptId) return;

    try {
      // Отправляем ответы на сервер
      const answersData: Record<string, any> = {};
      answers.forEach(answer => {
        if (Array.isArray(answer.answer)) {
          answersData[answer.questionId] = answer.answer;
        } else {
          answersData[answer.questionId] = answer.answer;
        }
      });

      await examsService.saveAllAnswers(testAttemptId, answersData);
      const result = await examsService.submitTestAttempt(String(testAttemptId), videoBlob);

      // Удаляем сохраненный прогресс
      localStorage.removeItem(`test_${test.id}_progress`);

      // Обновляем список попыток для финального теста
      const updatedAttempts = await examsService.getTestAttempts(test.id);
      setFinalTestAttempts(updatedAttempts);
      const passed = updatedAttempts.some(attempt => attempt.passed === true);
      setFinalTestPassed(passed);

      // Закрываем модальное окно теста
      setShowTestModal(false);
      setTest(null);
      setTestAttemptId(null);

      // Показываем результаты теста
      setTestResult(result);
      setTestTimeSpent(timeSpent);
      setShowResultModal(true);
    } catch (error: any) {
      toast.error(error.message || t('lms.coursePlayer.finalTestCompleteError'));
      console.error('Failed to complete final test:', error);
    }
  };

  const handleRequestCompletionOTP = async () => {
    if (!course.id) return;

    try {
      setLoadingOTP(true);
      const response = await coursesService.requestCompletionOTP(course.id);
      setShowSMSVerification(true);
      
      // Показываем сообщение только если это новый OTP
      if (response.otp_is_new !== false) {
        toast.success(t('lms.coursePlayer.smsSent'));
      }
    } catch (error: any) {
      toast.error(error.message || t('lms.coursePlayer.smsRequestError'));
      console.error('Failed to request completion OTP:', error);
    } finally {
      setLoadingOTP(false);
    }
  };

  const handleSMSVerified = async (otp: string) => {
    if (!course.id) return;

    try {
      setLoadingOTP(true);
      await coursesService.verifyCompletionOTP(course.id, otp);
      setShowSMSVerification(false);
      toast.success(t('lms.coursePlayer.courseCompletedSuccess'));
      await onCourseComplete();
    } catch (error: any) {
      toast.error(error.message || t('lms.coursePlayer.smsVerifyError'));
      console.error('Failed to verify completion OTP:', error);
    } finally {
      setLoadingOTP(false);
    }
  };

  const handleStartFinalTest = async () => {
    if (!course.final_test_id) return;

    try {
      setLoadingTest(true);
      
      // Проверяем, есть ли незавершенная попытка
      const incompleteAttempt = finalTestAttempts.find(
        attempt => !attempt.completed_at && !attempt.completedAt
      );
      
      if (incompleteAttempt) {
        // Продолжаем незавершенную попытку
        await handleContinueFinalTest(incompleteAttempt.id);
        return;
      }
      
      const loadedTest = await testsService.getTest(String(course.final_test_id));

      if (!loadedTest.questions || loadedTest.questions.length === 0) {
        toast.error(t('lms.coursePlayer.noQuestions'));
        setLoadingTest(false);
        return;
      }

      // Проверяем количество попыток (с учетом одобренных дополнительных попыток)
      const maxAttempts = loadedTest.maxAttempts || loadedTest.max_attempts || 3;
      const approvedCount = finalTestExtraAttemptRequests.filter(r => r.status === 'approved').length;
      const maxAllowed = maxAttempts + approvedCount;
      const attemptsCount = finalTestAttempts.length;
      
      if (attemptsCount >= maxAllowed) {
        toast.error(t('lms.coursePlayer.maxAttemptsReached', { max: maxAllowed }));
        setLoadingTest(false);
        return;
      }

      // Начинаем попытку
      const attempt = await examsService.startTestAttempt(String(course.final_test_id));
      const attemptIdNum = Number(attempt.id);

      setTest(loadedTest);
      setTestAttemptId(attemptIdNum);
      setShowTestModal(true);
      
      // Сохраняем attemptId в localStorage для автосохранения
      localStorage.setItem(`test_${course.final_test_id}_progress`, JSON.stringify({
        attemptId: attemptIdNum,
      }));
    } catch (error: any) {
      toast.error(error.message || t('lms.coursePlayer.errorLoadingTest'));
      console.error('Failed to start final test:', error);
    } finally {
      setLoadingTest(false);
    }
  };

  const handleContinueFinalTest = async (attemptId: string) => {
    if (!course.final_test_id) return;

    try {
      setLoadingTest(true);
      
      // Загружаем попытку и тест
      const [attempt, loadedTest] = await Promise.all([
        examsService.getTestAttempt(attemptId),
        testsService.getTest(String(course.final_test_id))
      ]);
      
      if (!loadedTest.questions || loadedTest.questions.length === 0) {
        toast.error(t('lms.coursePlayer.noQuestions'));
        setLoadingTest(false);
        return;
      }

      const attemptIdNum = Number(attempt.id);
      const savedAnswers = attempt.answers || {};
      const startedAtDate = attempt.started_at || attempt.startedAt;
      
      setTest(loadedTest);
      setTestAttemptId(attemptIdNum);
      setShowTestModal(true);
      
      // Сохраняем attemptId и ответы в localStorage для автосохранения
      localStorage.setItem(`test_${course.final_test_id}_progress`, JSON.stringify({
        attemptId: attemptIdNum,
        answers: savedAnswers,
        startedAt: startedAtDate
      }));
      
      toast.success('Продолжение теста');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка при загрузке попытки');
      console.error('Failed to continue final test:', error);
    } finally {
      setLoadingTest(false);
    }
  };

  const handleViewFinalTestResult = async (attemptId: string) => {
    if (!course.final_test_id) return;

    try {
      setLoadingTest(true);
      
      // Загружаем попытку и тест
      const [attempt, loadedTest] = await Promise.all([
        examsService.getTestAttempt(attemptId),
        testsService.getTest(String(course.final_test_id))
      ]);
      
      // Вычисляем время прохождения
      const startedDate = attempt.started_at || attempt.startedAt;
      const completedDate = attempt.completed_at || attempt.completedAt;
      let timeSpent = 0;
      
      if (startedDate && completedDate) {
        const started = typeof startedDate === 'string' ? new Date(startedDate) : startedDate;
        const completed = typeof completedDate === 'string' ? new Date(completedDate) : completedDate;
        timeSpent = Math.floor((completed.getTime() - started.getTime()) / 1000);
      }
      
      setTest(loadedTest);
      setTestResult(attempt);
      setTestTimeSpent(timeSpent);
      setShowResultModal(true);
    } catch (error: any) {
      toast.error(error.message || 'Ошибка при загрузке результатов');
      console.error('Failed to load final test result:', error);
    } finally {
      setLoadingTest(false);
    }
  };

  const getNextLesson = (): Lesson | null => {
    for (let i = 0; i < courseModules.length; i++) {
      const module = courseModules[i];
      const moduleLessons = module.lessons && Array.isArray(module.lessons) ? module.lessons : [];
      for (let j = 0; j < moduleLessons.length; j++) {
        const lesson = moduleLessons[j];
        if (lesson.id === selectedLesson?.id) {
          // Return next lesson in same module
          if (j < moduleLessons.length - 1) {
            return moduleLessons[j + 1];
          }
          // Return first lesson of next module
          if (i < courseModules.length - 1) {
            const nextModuleLessons = courseModules[i + 1].lessons && Array.isArray(courseModules[i + 1].lessons)
              ? courseModules[i + 1].lessons
              : [];
            return nextModuleLessons[0] || null;
          }
          return null;
        }
      }
    }
    return null;
  };

  const completedLessonsCount = courseModules.reduce(
    (count, module) => {
      const moduleLessons = module.lessons && Array.isArray(module.lessons) ? module.lessons : [];
      return count + moduleLessons.filter(l => l.completed === true).length;
    },
    0
  );
  const totalLessonsCount = courseModules.reduce(
    (count, module) => {
      const moduleLessons = module.lessons && Array.isArray(module.lessons) ? module.lessons : [];
      return count + moduleLessons.length;
    },
    0
  );
  
  // Используем прогресс из enrollment, если он есть, иначе вычисляем
  const courseProgress = course.progress !== undefined ? course.progress : 
    (totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0);

  // Проверяем, все ли уроки завершены
  const allLessonsCompleted = totalLessonsCount > 0 && completedLessonsCount >= totalLessonsCount;

  // Финальный тест доступен сразу после завершения всех уроков
  const isExamAvailable = allLessonsCompleted && course.final_test_id;

  // Загружаем попытки и запросы на дополнительные попытки для финального теста
  useEffect(() => {
    const loadFinalTestData = async () => {
      if (!course.final_test_id) {
        setFinalTestAttempts([]);
        setFinalTestExtraAttemptRequests([]);
        setFinalTestPassed(false);
        setFinalTestData(null);
        return;
      }

      try {
        setLoadingFinalTestStatus(true);
        const [attempts, allRequests, testData] = await Promise.all([
          examsService.getTestAttempts(String(course.final_test_id)),
          examsService.getExtraAttemptRequests(),
          testsService.getTest(String(course.final_test_id)).catch(() => null)
        ]);
        
        setFinalTestAttempts(attempts);
        const passed = attempts.some(attempt => attempt.passed === true);
        setFinalTestPassed(passed);
        setFinalTestData(testData);
        
        // Фильтруем запросы для финального теста
        const requestsForFinalTest = allRequests.filter(r => {
          const rTestId = typeof r.test === 'object' ? r.test?.id : r.testId || r.test;
          return String(rTestId) === String(course.final_test_id);
        });
        setFinalTestExtraAttemptRequests(requestsForFinalTest);
      } catch (error) {
        console.error('Failed to load final test data:', error);
        setFinalTestAttempts([]);
        setFinalTestExtraAttemptRequests([]);
        setFinalTestPassed(false);
        setFinalTestData(null);
      } finally {
        setLoadingFinalTestStatus(false);
      }
    };

    loadFinalTestData();
  }, [course.final_test_id]);

  // Вычисляем общее время обучения в минутах
  const totalDurationMinutes = courseModules.reduce((total, module) => {
    const moduleLessons = module.lessons && Array.isArray(module.lessons) ? module.lessons : [];
    return total + moduleLessons.reduce((sum, lesson) => sum + (lesson.duration || 0), 0);
  }, 0);
  
  // Форматируем длительность курса
  const formatDuration = (hours: number) => {
    if (hours === 0) return 'Не указано';
    if (hours === 1) return '1 час';
    if (hours < 5) return `${hours} часа`;
    return `${hours} часов`;
  };

  // Форматируем формат обучения
  const formatCourseFormat = (format: string) => {
    const formats: Record<string, string> = {
      'online': 'Онлайн',
      'offline': 'Офлайн',
      'blended': 'Смешанный',
    };
    return formats[format] || format;
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться к курсам
          </Link>
          
          <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full mb-3">
              {getCategoryName(course.category)}
            </span>
            </div>
          </div>

          {/* Course Description */}
          {course.description && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">Описание курса</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{course.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Course Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Длительность</p>
                <p className="font-semibold text-gray-900">
                  {formatDuration(course.duration || 0)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <BookOpen className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Формат обучения</p>
                <p className="font-semibold text-gray-900">
                  {formatCourseFormat(course.format || 'online')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Award className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Проходной балл</p>
                <p className="font-semibold text-gray-900">
                  {(course.passingScore || course.passing_score || 80)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <RotateCcw className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Макс. попыток</p>
                <p className="font-semibold text-gray-900">
                  {course.maxAttempts || course.max_attempts || 3}
                </p>
              </div>
            </div>
          </div>

          {/* Course Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{courseModules.length}</p>
              <p className="text-xs text-gray-600 mt-1">Модулей</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{totalLessonsCount}</p>
              <p className="text-xs text-gray-600 mt-1">Уроков</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {Math.round(totalDurationMinutes / 60 * 10) / 10}
              </p>
              <p className="text-xs text-gray-600 mt-1">Часов обучения</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{completedLessonsCount}</p>
              <p className="text-xs text-gray-600 mt-1">Завершено</p>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span className="font-medium">Прогресс прохождения курса</span>
              <span>{completedLessonsCount} из {totalLessonsCount} уроков</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-600 to-blue-700 h-3 rounded-full transition-all duration-300"
                style={{ width: `${courseProgress}%` }}
              />
            </div>
            <div className="text-sm text-gray-600 mt-2 text-right font-medium">
              {courseProgress}% завершено
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Course Structure */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-gray-900">Программа курса</h2>
              </div>
              
              <div className="space-y-3">
                {courseModules.map(module => {
                  const moduleLessons = module.lessons && Array.isArray(module.lessons) ? module.lessons : [];
                  // Модуль считается завершенным, если все его уроки завершены
                  const isModuleCompleted = moduleLessons.length > 0 && 
                    moduleLessons.every(lesson => lesson.completed === true);
                  const completedLessonsInModule = moduleLessons.filter(l => l.completed === true).length;
                  const moduleProgress = moduleLessons.length > 0 
                    ? Math.round((completedLessonsInModule / moduleLessons.length) * 100) 
                    : 0;
                  
                  return (
                    <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleModule(module.id)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isModuleCompleted ? (
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 text-left truncate">
                            {module.title}
                          </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {completedLessonsInModule}/{moduleLessons.length} уроков
                              </span>
                              {moduleLessons.length > 0 && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-xs text-gray-500">{moduleProgress}%</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {expandedModules.includes(module.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                        )}
                      </button>

                      {/* Module Description */}
                      {module.description && expandedModules.includes(module.id) && (
                        <div className="px-3 pb-2">
                          <p className="text-xs text-gray-600 leading-relaxed">{module.description}</p>
                        </div>
                      )}

                      {expandedModules.includes(module.id) && (
                        <div className="border-t border-gray-100 bg-gray-50">
                          <div className="p-2 space-y-1">
                            {moduleLessons.map((lesson, index) => {
                            const isLocked = false; // TODO: Add logic for locked lessons
                              const isSelected = selectedLesson?.id === lesson.id;
                              
                            return (
                              <button
                                key={lesson.id}
                                onClick={() => !isLocked && setSelectedLesson(lesson)}
                                disabled={isLocked}
                                  className={`w-full flex items-start gap-2 p-2.5 rounded-lg transition-colors text-left ${
                                    isSelected
                                      ? 'bg-blue-100 border border-blue-300 text-blue-900'
                                    : isLocked
                                      ? 'opacity-50 cursor-not-allowed bg-white'
                                      : 'hover:bg-white text-gray-700 bg-white'
                                }`}
                              >
                                  <div className="flex-shrink-0 mt-0.5">
                                {isLocked ? (
                                      <Lock className="w-4 h-4 text-gray-400" />
                                ) : lesson.completed === true ? (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                      <Circle className="w-4 h-4 text-gray-400" />
                                )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{lesson.title}</p>
                                        {lesson.description && (
                                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                            {lesson.description}
                                          </p>
                                  )}
                                </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {lesson.duration > 0 && (
                                          <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <Clock className="w-3 h-3" />
                                            <span>{lesson.duration} мин</span>
                                          </div>
                                        )}
                                        <div className={`
                                          ${lesson.type === 'video' ? 'text-purple-600' : ''}
                                          ${lesson.type === 'pdf' ? 'text-red-600' : ''}
                                          ${lesson.type === 'ppt' ? 'text-orange-600' : ''}
                                          ${lesson.type === 'quiz' ? 'text-green-600' : ''}
                                          ${lesson.type === 'text' ? 'text-blue-600' : ''}
                                        `}>
                                          {getLessonIcon(lesson.type, 'w-4 h-4')}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                              </button>
                            );
                          })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {courseModules.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Программа курса пуста</p>
            </div>
              )}

              {/* Final Test Block */}
              {isExamAvailable && course.final_test_id && (
                <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                        <Award className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{t('lms.coursePlayer.finalTest')}</h3>
                      <p className="text-gray-700 mb-4">
                        {t('lms.coursePlayer.finalTestDesc')}
                      </p>
                      
                      {loadingFinalTestStatus ? (
                        <div className="text-sm text-gray-600">Проверка статуса...</div>
                      ) : (
                        <>
                          {/* Отображение количества попыток */}
                          <div className="mb-4 text-sm text-gray-700">
                            <span>Попыток использовано: </span>
                            <span className="font-semibold">
                              {finalTestAttempts.length} / {(() => {
                                const maxAttempts = finalTestData?.maxAttempts || finalTestData?.max_attempts || 3;
                                const approvedCount = finalTestExtraAttemptRequests.filter(r => r.status === 'approved').length;
                                return maxAttempts + approvedCount;
                              })()}
                            </span>
                            {finalTestPassed && (
                              <span className="ml-2 text-green-600 font-semibold">✓ Пройден</span>
                            )}
                          </div>

                          {/* Кнопки действий */}
                          <div className="flex flex-wrap gap-2">
                            {/* Продолжить незавершенную попытку */}
                            {finalTestAttempts.some(attempt => !attempt.completed_at && !attempt.completedAt) && (
                              <button
                                onClick={() => {
                                  const incompleteAttempt = finalTestAttempts.find(
                                    attempt => !attempt.completed_at && !attempt.completedAt
                                  );
                                  if (incompleteAttempt) {
                                    handleContinueFinalTest(incompleteAttempt.id);
                                  }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Продолжить тест
                              </button>
                            )}

                            {/* Начать новую попытку (если тест не пройден) */}
                            {!finalTestPassed && (
                              <button
                                onClick={handleStartFinalTest}
                                disabled={loadingTest}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <PlayCircle className="w-5 h-5" />
                                {loadingTest ? t('lms.coursePlayer.loading') : t('lms.coursePlayer.takeFinalTest')}
                              </button>
                            )}

                            {/* Запрос дополнительной попытки */}
                            {!finalTestPassed && (
                              <button
                                onClick={() => setShowFinalTestExtraAttemptModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                              >
                                <Send className="w-4 h-4" />
                                Запросить попытку
                              </button>
                            )}

                            {/* Просмотр результатов прошлых попыток */}
                            {finalTestAttempts.filter(attempt => attempt.completed_at || attempt.completedAt).length > 0 && (
                              <div className="w-full mt-2">
                                <p className="text-sm font-medium text-gray-700 mb-2">Результаты попыток:</p>
                                <div className="space-y-2">
                                  {finalTestAttempts
                                    .filter(attempt => attempt.completed_at || attempt.completedAt)
                                    .sort((a, b) => {
                                      const dateA = a.completed_at || a.completedAt || '';
                                      const dateB = b.completed_at || b.completedAt || '';
                                      return dateB > dateA ? 1 : -1;
                                    })
                                    .map((attempt) => (
                                      <button
                                        key={attempt.id}
                                        onClick={() => handleViewFinalTestResult(String(attempt.id))}
                                        className="w-full text-left px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                                      >
                                        <div>
                                          <span className="text-sm font-medium text-gray-900">
                                            Попытка {finalTestAttempts.filter(a => a.completed_at || a.completedAt).indexOf(attempt) + 1}
                                          </span>
                                          <span className="ml-2 text-xs text-gray-500">
                                            {attempt.completed_at || attempt.completedAt
                                              ? new Date(attempt.completed_at || attempt.completedAt).toLocaleDateString('ru-RU')
                                              : ''}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-semibold ${attempt.passed ? 'text-green-600' : 'text-red-600'}`}>
                                            {attempt.score !== undefined && attempt.score !== null ? Number(attempt.score).toFixed(2) : '0.00'}%
                                          </span>
                                          {attempt.passed ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          )}
                                          <Eye className="w-4 h-4 text-gray-400" />
                                        </div>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Кнопка "Завершить курс" или статус ожидания */}
              {(() => {
                // Приоритет: enrollment_status > enrollmentStatus > status
                // enrollment_status - это статус enrollment студента (из with_progress endpoint)
                // status - это статус самого курса (published, draft и т.д.)
                const enrollmentStatus = course.enrollment_status || course.enrollmentStatus || course.status;
                const allCompleted = allLessonsCompleted && (course.final_test_id ? finalTestPassed : true);
                
                console.log('Course completion status check:', {
                  enrollmentStatus,
                  enrollment_status: course.enrollment_status,
                  enrollmentStatus_field: course.enrollmentStatus,
                  course_status: course.status,
                  allCompleted,
                  allLessonsCompleted,
                  finalTestPassed,
                  courseId: course.id,
                  course: course
                });
                
                // Если курс в статусе pending_pdek - показываем статус ожидания (кнопка НЕ показывается)
                if (enrollmentStatus === 'pending_pdek') {
                  return (
                    <div className="mt-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-lg p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                            <Clock className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{t('lms.coursePlayer.pendingReview')}</h3>
                          <p className="text-gray-700 mb-2">
                            {t('lms.coursePlayer.pendingReviewDesc')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {t('common.status')}: <span className="font-semibold text-orange-700">{t('lms.coursePlayer.pendingReviewStatus')}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Если курс завершен - показываем статус завершения (кнопка НЕ показывается)
                if (enrollmentStatus === 'completed') {
                  return (
                    <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                            <Award className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{t('lms.coursePlayer.courseCompleted')}</h3>
                          <p className="text-gray-700 mb-2">
                            {t('lms.coursePlayer.courseCompletedDesc')}
                          </p>
                          <Link
                            to="/student/documents"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                          >
                            <FileCheck className="w-5 h-5" />
                            Перейти к документам
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Если все уроки завершены, но курс еще не завершен и не в ожидании - показываем кнопку завершения
                // Важно: проверяем, что статус НЕ pending_pdek и НЕ completed
                const isPendingOrCompleted = enrollmentStatus === 'pending_pdek' || enrollmentStatus === 'completed';
                if (allCompleted && !isPendingOrCompleted) {
                  return (
                    <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{t('lms.coursePlayer.readyToComplete')}</h3>
                          <p className="text-gray-700 mb-4">
                            {t('lms.coursePlayer.readyToCompleteDesc', { finalTest: course.final_test_id ? t('lms.coursePlayer.readyToCompleteDescWithTest') : '' })}
                          </p>
                          <button
                            onClick={handleRequestCompletionOTP}
                            disabled={loadingOTP}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="w-5 h-5" />
                            {loadingOTP ? t('lms.coursePlayer.loading') : t('lms.coursePlayer.completeCourse')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Если ничего не подошло - не показываем ничего
                return null;
              })()}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {selectedLesson ? (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Lesson Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                  <div className="flex items-center gap-3 mb-2">
                    {getLessonIcon(selectedLesson.type, 'text-white')}
                    <span className="text-sm font-medium opacity-90">
                      {getLessonTypeName(selectedLesson.type)}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{selectedLesson.title}</h2>
                  {selectedLesson.duration && (
                    <p className="text-blue-100 text-sm">
                      Длительность: {selectedLesson.duration} минут
                    </p>
                  )}
                </div>

                {/* Lesson Content */}
                <div className="p-8">
                  {selectedLesson.type === 'video' && (
                    <div className="mb-6">
                      {getVideoPlayer(selectedLesson)}
                    </div>
                  )}

                  {selectedLesson.type === 'text' && (
                    <div className="prose max-w-none">
                      <div className="text-gray-800 leading-relaxed space-y-4">
                        <p>
                          {selectedLesson.content || 
                            'Законодательство Республики Казахстан в области промышленной безопасности основывается на Конституции РК и состоит из Закона РК «О гражданской защите» и иных нормативных правовых актов РК.'}
                        </p>
                        <h3 className="text-xl font-bold text-gray-900 mt-6">Основные принципы</h3>
                        <ul className="list-disc list-inside space-y-2">
                          <li>Приоритет жизни и здоровья работников</li>
                          <li>Предупреждение и профилактика опасных ситуаций</li>
                          <li>Постоянный контроль и мониторинг</li>
                          <li>Ответственность работодателя</li>
                        </ul>
                        <p className="mt-6">
                          Изучение данного материала является обязательным для всех специалистов, работающих на опасных производственных объектах.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedLesson.type === 'pdf' && (selectedLesson.pdfUrl || selectedLesson.pdf_url) && (
                    <PdfViewer 
                      url={selectedLesson.pdfUrl || selectedLesson.pdf_url || ''} 
                      title="PDF Документ"
                    />
                  )}
                  {selectedLesson.type === 'pdf' && !selectedLesson.pdfUrl && !selectedLesson.pdf_url && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="font-bold text-gray-900 mb-2">PDF Документ</h3>
                      <p className="text-gray-600">URL PDF файла не указан</p>
                    </div>
                  )}

                  {selectedLesson.type === 'ppt' && (selectedLesson.pptUrl || selectedLesson.ppt_url) && (
                    <PPTViewer 
                      url={selectedLesson.pptUrl || selectedLesson.ppt_url || ''} 
                      title="PPT Презентация"
                      lessonId={selectedLesson.id}
                    />
                  )}
                  {selectedLesson.type === 'ppt' && !selectedLesson.pptUrl && !selectedLesson.ppt_url && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="font-bold text-gray-900 mb-2">PPT Презентация</h3>
                      <p className="text-gray-600">URL PPT файла не указан</p>
                    </div>
                  )}

                  {selectedLesson.type === 'quiz' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <div className="flex items-start gap-3 mb-4">
                        <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-1">Проверочный тест</h3>
                          <p className="text-gray-600 text-sm">
                        Ответьте на вопросы для проверки усвоения материала модуля.
                      </p>
                        </div>
                      </div>
                      
                      {/* Требования к прохождению теста */}
                      {(selectedLesson.testId || selectedLesson.test_id) && (
                        <div className="mb-4 p-4 bg-white rounded-lg border border-blue-100">
                          <h4 className="font-semibold text-gray-900 mb-3 text-sm">Требования к прохождению:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-orange-600" />
                              <div>
                                <p className="text-xs text-gray-500">Проходной балл</p>
                                <p className="font-semibold text-gray-900">
                                  {(selectedLesson.passingScore || selectedLesson.passing_score || course.passingScore || course.passing_score || 80)}%
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <RotateCcw className="w-4 h-4 text-purple-600" />
                              <div>
                                <p className="text-xs text-gray-500">Макс. попыток</p>
                                <p className="font-semibold text-gray-900">
                                  {(selectedLesson.maxAttempts || selectedLesson.max_attempts || course.maxAttempts || course.max_attempts || 3)}
                                </p>
                              </div>
                            </div>
                            {(course.hasTimer || course.has_timer) && (course.timerMinutes || course.timer_minutes) && (
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-600" />
                                <div>
                                  <p className="text-xs text-gray-500">Время на тест</p>
                                  <p className="font-semibold text-gray-900">
                                    {course.timerMinutes || course.timer_minutes} мин
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Информация о попытках */}
                      {selectedLesson.testId || selectedLesson.test_id ? (
                        <>
                          {loadingAttempts ? (
                            <div className="mb-4 p-3 bg-white rounded-lg border border-blue-100">
                              <div className="text-sm text-gray-500">Загрузка информации о попытках...</div>
                            </div>
                          ) : (
                            <div className="mb-4 p-4 bg-white rounded-lg border border-blue-100">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                <RotateCcw className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-700">
                                    История попыток
                                  </span>
                                </div>
                                <span className="text-sm text-gray-600">
                                  <strong className="text-gray-900">{testAttempts.length}</strong> из{' '}
                                  <strong className="text-gray-900">
                                    {(() => {
                                      if (test && (test.maxAttempts || test.max_attempts)) {
                                        return test.maxAttempts || test.max_attempts;
                                      }
                                      return selectedLesson.maxAttempts || selectedLesson.max_attempts || course.maxAttempts || course.max_attempts || 3;
                                    })()}
                                  </strong>
                                </span>
                              </div>
                              {testAttempts.length > 0 ? (
                                <div className="space-y-2">
                                  {testAttempts.map((attempt, index) => {
                                    const completedDate = attempt.completed_at || attempt.completedAt;
                                    const startedDate = attempt.started_at || attempt.startedAt;
                                    const dateStr = completedDate 
                                      ? (typeof completedDate === 'string' ? new Date(completedDate).toLocaleString('ru-RU') : completedDate.toLocaleString('ru-RU'))
                                      : (startedDate ? (typeof startedDate === 'string' ? new Date(startedDate).toLocaleString('ru-RU') : startedDate.toLocaleString('ru-RU')) : '—');
                                    const score = attempt.score !== undefined && attempt.score !== null ? Number(attempt.score).toFixed(2) : null;
                                    const passed = attempt.passed !== undefined ? attempt.passed : (score ? Number(score) >= (selectedLesson.passingScore || selectedLesson.passing_score || course.passingScore || course.passing_score || 80) : false);
                                    
                                    const isCompleted = !!completedDate;
                                    
                                    return (
                                      <div key={attempt.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                        <div className="flex items-center gap-2 flex-1">
                                          <span className="text-xs font-medium text-gray-500">#{testAttempts.length - index}</span>
                                          <div className="flex-1">
                                            <p className="text-xs text-gray-600">{dateStr}</p>
                                            {score !== null && isCompleted && (
                                              <p className={`text-xs font-semibold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                                                {score}% {passed ? '✓ Сдал' : '✗ Не сдал'}
                                              </p>
                                            )}
                                            {!isCompleted && (
                                              <p className="text-xs font-semibold text-orange-600">
                                                Незавершен
                                              </p>
                                  )}
                                </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {isCompleted ? (
                                            <>
                                              {passed && (
                                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                              )}
                                              <button
                                                onClick={() => handleViewTestResult(attempt.id)}
                                                className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
                                                title="Посмотреть результаты"
                                              >
                                                <Eye className="w-3 h-3" />
                                                Результаты
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              onClick={() => handleContinueTest(attempt.id)}
                                              className="px-2 py-1 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors flex items-center gap-1"
                                              title={t('lms.coursePlayer.continueTestTitle')}
                                            >
                                              <Play className="w-3 h-3" />
                                              {t('lms.coursePlayer.continue')}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 text-center py-2">
                                  Попытки еще не использованы
                                </p>
                              )}
                            </div>
                          )}
                          
                          {(() => {
                            const maxAttempts = test?.maxAttempts || test?.max_attempts || selectedLesson.maxAttempts || selectedLesson.max_attempts || course.maxAttempts || course.max_attempts || 3;
                            const approvedCount = extraAttemptRequests.filter(r => r.status === 'approved').length;
                            const maxAllowed = maxAttempts + approvedCount;
                            const allAttemptsUsed = testAttempts.length >= maxAllowed;
                            
                            // Проверяем, есть ли отличная попытка (score >= 90)
                            const hasExcellentPass = testAttempts.some(
                              attempt => {
                                const completedAt = attempt.completed_at || attempt.completedAt;
                                const score = attempt.score;
                                const passed = attempt.passed;
                                return completedAt && score !== null && score !== undefined && score >= 90 && passed;
                              }
                            );
                            
                            // Проверяем, есть ли хотя бы одна неудачная попытка
                            const hasFailedAttempt = testAttempts.some(
                              attempt => {
                                const completedAt = attempt.completed_at || attempt.completedAt;
                                const passed = attempt.passed;
                                return completedAt && passed === false;
                              }
                            );
                            
                            // Проверяем, все ли попытки завершены
                            const allAttemptsCompleted = testAttempts.length > 0 && testAttempts.every(
                              attempt => {
                                const completedAt = attempt.completed_at || attempt.completedAt;
                                return completedAt !== null && completedAt !== undefined;
                              }
                            );
                            
                            if (allAttemptsUsed && !hasExcellentPass && hasFailedAttempt && allAttemptsCompleted) {
                              // Находим последний pending запрос
                              const lastPendingRequest = extraAttemptRequests
                                .filter(r => r.status === 'pending')
                                .sort((a, b) => {
                                  const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
                                  const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
                                  return dateB - dateA;
                                })[0];
                              
                              // Находим последний rejected запрос
                              const lastRejectedRequest = extraAttemptRequests
                                .filter(r => r.status === 'rejected')
                                .sort((a, b) => {
                                  const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
                                  const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
                                  return dateB - dateA;
                                })[0];
                              
                              // Показываем информацию о последнем pending запросе, если есть
                              if (lastPendingRequest) {
                                return (
                                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="font-semibold text-blue-900 mb-1">Запрос на рассмотрении</p>
                                        <p className="text-sm text-blue-800 mb-3">
                                          Ваш запрос на дополнительные попытки находится на рассмотрении администратора. Вы получите уведомление о результате.
                                        </p>
                                        <button
                                          onClick={() => setShowExtraAttemptModal(true)}
                                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                                        >
                                          <Send className="w-4 h-4" />
                                          Создать еще один запрос
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Показываем информацию о последнем rejected запросе, если есть
                              if (lastRejectedRequest) {
                                return (
                                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="font-semibold text-red-900 mb-1">Последний запрос отклонен</p>
                                        <p className="text-sm text-red-800 mb-3">
                                          {lastRejectedRequest.admin_response || 'Ваш последний запрос на дополнительные попытки был отклонен.'}
                                        </p>
                                        <button
                                          onClick={() => setShowExtraAttemptModal(true)}
                                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                                        >
                                          <Send className="w-4 h-4" />
                                          Создать новый запрос
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Нет запросов или все обработаны, показываем возможность создать
                              return (
                                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                  <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="font-semibold text-orange-900 mb-2">Все попытки использованы</p>
                                      <p className="text-sm text-orange-800 mb-3">
                                        Вы использовали все доступные попытки для прохождения этого теста.
                                      </p>
                                      <button
                                        onClick={() => setShowExtraAttemptModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                                      >
                                        <Send className="w-4 h-4" />
                                        Запросить дополнительные попытки
                                      </button>
                                </div>
                              </div>
                            </div>
                              );
                            }
                            return null;
                          })()}
                        </>
                      ) : null}
                      
                      <button 
                        onClick={handleStartQuiz}
                        disabled={
                          loadingTest || 
                          loadingAttempts ||
                          (!selectedLesson.testId && !selectedLesson.test_id) ||
                          (() => {
                            // Проверяем, есть ли отличная попытка (score >= 90)
                            const hasExcellentPass = testAttempts.some(
                              attempt => {
                                const completedAt = attempt.completed_at || attempt.completedAt;
                                const score = attempt.score;
                                const passed = attempt.passed;
                                return completedAt && score !== null && score !== undefined && score >= 90 && passed;
                              }
                            );
                            if (hasExcellentPass) return true;
                            
                            const maxAttempts = test?.maxAttempts || test?.max_attempts || selectedLesson.maxAttempts || selectedLesson.max_attempts || course.maxAttempts || course.max_attempts || 3;
                            const approvedCount = extraAttemptRequests.filter(r => r.status === 'approved').length;
                            const maxAllowed = maxAttempts + approvedCount;
                            return testAttempts.length >= maxAllowed;
                          })()
                        }
                        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {loadingTest ? t('lms.coursePlayer.loadingTest') : t('lms.coursePlayer.startTest')}
                      </button>
                      {(() => {
                        // Показываем сообщение, если есть отличная попытка
                        const hasExcellentPass = testAttempts.some(
                          attempt => {
                            const completedAt = attempt.completed_at || attempt.completedAt;
                            const score = attempt.score;
                            const passed = attempt.passed;
                            return completedAt && score !== null && score !== undefined && score >= 90 && passed;
                          }
                        );
                        if (hasExcellentPass) {
                          return (
                            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-green-800">
                                  {t('lms.coursePlayer.excellentPassBlocked') || 'Тест уже пройден на отлично (90%+). Дополнительные попытки недоступны.'}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {!selectedLesson.testId && !selectedLesson.test_id && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">
                              Тест не привязан к этому уроку. Обратитесь к администратору.
                        </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                    <div>
                      {selectedLesson.completed === true && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">Урок завершен</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      {selectedLesson.completed !== true && (
                        <button
                          onClick={handleLessonComplete}
                          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                        >
                          Завершить урок
                        </button>
                      )}
                      
                      {getNextLesson() && (
                        <button
                          onClick={() => setSelectedLesson(getNextLesson())}
                          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Следующий урок
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <PlayCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Выберите урок</h3>
                <p className="text-gray-600">Выберите урок из программы курса для начала обучения</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test Modal */}
      {showTestModal && test && testAttemptId && (() => {
        // Получаем сохраненные ответы из попытки для восстановления
        // Проверяем, это финальный тест или обычный тест урока
        const isFinalTest = course.final_test_id && String(test.id) === String(course.final_test_id);
        const attemptsToSearch = isFinalTest ? finalTestAttempts : testAttempts;
        let currentAttempt = attemptsToSearch.find(a => String(a.id) === String(testAttemptId));
        
        // Если попытка не найдена в списке, пытаемся загрузить из localStorage
        if (!currentAttempt) {
          const savedProgress = localStorage.getItem(`test_${test.id}_progress`);
          if (savedProgress) {
            try {
              const progress = JSON.parse(savedProgress);
              if (progress.answers) {
                currentAttempt = {
                  id: String(testAttemptId),
                  answers: progress.answers,
                  started_at: progress.startedAt
                } as TestAttempt;
              }
            } catch (e) {
              console.error('Failed to parse saved progress:', e);
            }
          }
        }
        
        const savedAnswers = currentAttempt?.answers || {};
        const startedAtDate = currentAttempt?.started_at || currentAttempt?.startedAt;
        
        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
                <h2 className="text-xl font-bold text-gray-900">
                  {currentAttempt && !currentAttempt.completed_at && !currentAttempt.completedAt 
                    ? 'Продолжение теста' 
                    : 'Проверочный тест'}
                </h2>
              <button
                onClick={handleTestCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TestInterface
                testId={test.id}
                attemptId={testAttemptId}
                title={test.title}
                timeLimit={test.timeLimit || test.time_limit || 30}
                questions={test.questions || []}
                requiresVideoRecording={test.requiresVideoRecording || test.requires_video_recording || false}
                onComplete={handleTestComplete}
                onCancel={handleTestCancel}
                inModal={true}
                savedAnswers={Object.keys(savedAnswers).length > 0 ? savedAnswers : undefined}
                startedAt={startedAtDate}
              />
              </div>
            </div>
          </div>
        );
      })()}

      {/* SMS Verification Modal */}
      {showSMSVerification && user && (
        <SMSVerification
          phone={user.phone}
          onVerified={handleSMSVerified}
          onCancel={() => {
            setShowSMSVerification(false);
          }}
          title="Завершение курса"
          description="Введите код подтверждения из SMS для завершения курса"
          purpose="verification"
          onResend={async () => {
            if (course.id) {
              const response = await coursesService.requestCompletionOTP(course.id);
              if (response.otp_is_new !== false) {
                toast.success(t('lms.coursePlayer.smsSent'));
              }
            }
          }}
        />
      )}

      {/* Test Result Modal */}
      {showResultModal && test && testResult && (
        <TestResultModal
          test={test}
          result={testResult}
          attemptsUsed={(() => {
            const isFinalTest = course.final_test_id && String(test.id) === String(course.final_test_id);
            return isFinalTest ? finalTestAttempts.length : testAttempts.length;
          })()}
          attemptsTotal={test.maxAttempts || test.max_attempts || 3}
          timeSpent={testTimeSpent}
          onClose={() => {
            setShowResultModal(false);
            // Больше не вызываем handleRequestCompletionOTP автоматически
            // Пользователь должен нажать кнопку "Завершить курс" самостоятельно
            setTestResult(null);
            setTestTimeSpent(0);
          }}
          onRetry={() => {
            setShowResultModal(false);
            setTestResult(null);
            setTestTimeSpent(0);
            if (course.final_test_id && String(test.id) === String(course.final_test_id)) {
              handleStartFinalTest();
            } else {
            handleStartQuiz();
            }
          }}
          onBackToCourse={() => {
            setShowResultModal(false);
            // Больше не вызываем handleRequestCompletionOTP автоматически
            // Пользователь должен нажать кнопку "Завершить курс" самостоятельно
            setTestResult(null);
            setTestTimeSpent(0);
          }}
        />
      )}

      {/* Extra Attempt Request Modal for Lesson Tests */}
      {showExtraAttemptModal && selectedLesson && (selectedLesson.testId || selectedLesson.test_id) && (
        <ExtraAttemptRequestModal
          testId={selectedLesson.testId || selectedLesson.test_id || ''}
          existingRequest={null}
          onSuccess={(request) => {
            // Добавляем новый запрос в массив
            setExtraAttemptRequests(prev => [...prev, request]);
            setShowExtraAttemptModal(false);
            // Перезагружаем запросы для актуального состояния
            const testId = selectedLesson.testId || selectedLesson.test_id;
            if (testId) {
              examsService.getExtraAttemptRequests().then(allRequests => {
                const requestsForThisTest = allRequests.filter(r => {
                  const rTestId = typeof r.test === 'object' ? r.test?.id : r.testId || r.test;
                  return String(rTestId) === String(testId);
                });
                setExtraAttemptRequests(requestsForThisTest);
              });
            }
          }}
          onCancel={() => setShowExtraAttemptModal(false)}
        />
      )}

      {/* Extra Attempt Request Modal for Final Test */}
      {showFinalTestExtraAttemptModal && course.final_test_id && (
        <ExtraAttemptRequestModal
          testId={String(course.final_test_id)}
          existingRequest={null}
          onSuccess={(request) => {
            // Добавляем новый запрос в массив
            setFinalTestExtraAttemptRequests(prev => [...prev, request]);
            setShowFinalTestExtraAttemptModal(false);
            // Перезагружаем запросы для актуального состояния
            examsService.getExtraAttemptRequests().then(allRequests => {
              const requestsForFinalTest = allRequests.filter(r => {
                const rTestId = typeof r.test === 'object' ? r.test?.id : r.testId || r.test;
                return String(rTestId) === String(course.final_test_id);
              });
              setFinalTestExtraAttemptRequests(requestsForFinalTest);
              }).catch(console.error);
              examsService.getTestAttempts(String(course.final_test_id)).then(setFinalTestAttempts).catch(console.error);
          }}
          onCancel={() => setShowFinalTestExtraAttemptModal(false)}
        />
      )}
    </div>
  );
}

function getLessonIcon(type: string, className: string = 'w-4 h-4 text-gray-400') {
  switch (type) {
    case 'video':
      return <Video className={className} />;
    case 'pdf':
      return <FileText className={className} />;
    case 'ppt':
      return <FileText className={className} />;
    case 'quiz':
      return <CheckCircle className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function getLessonTypeName(type: string): string {
  const names: Record<string, string> = {
    'text': 'Текстовый материал',
    'video': 'Видео урок',
    'pdf': 'PDF документ',
    'ppt': 'PPT презентация',
    'quiz': 'Проверочный тест',
  };
  return names[type] || type;
}

function getCategoryName(category: any): string {
  // Если category - объект, извлекаем название
  if (category && typeof category === 'object') {
    return category.name || category.name_kz || category.name_en || '—';
  }
  
  // Если category - строка, используем маппинг
  if (typeof category === 'string') {
    const names: Record<string, string> = {
      'industrial_safety': 'Промышленная безопасность',
      'fire_safety': 'Пожарная безопасность',
      'electrical_safety': 'Электробезопасность',
      'labor_protection': 'Охрана труда',
      'professions': 'Рабочие профессии',
    };
    return names[category] || category;
  }
  
  return '—';
}

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  
  // Различные форматы YouTube URL
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

function getVideoPlayer(lesson: Lesson): React.ReactElement {
  const videoUrl = lesson.videoUrl || lesson.video_url || '';
  const youtubeVideoId = getYouTubeVideoId(videoUrl);
  
  if (youtubeVideoId) {
    // YouTube embed URL
    const embedUrl = `https://www.youtube.com/embed/${youtubeVideoId}?rel=0&modestbranding=1`;
    
    return (
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
        <iframe
          src={embedUrl}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
      </div>
    );
  }
  
  // Если это не YouTube URL или URL не распознан, показываем демо
  return (
    <div className="aspect-video bg-gray-900 rounded-lg mb-6 flex items-center justify-center">
      <div className="text-center text-white">
        <PlayCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-sm">Видео плеер (демо)</p>
        {videoUrl && (
          <p className="text-xs opacity-70 mt-2 break-all px-4">{videoUrl}</p>
        )}
        {!videoUrl && (
          <p className="text-xs opacity-70 mt-2">URL видео не указан</p>
        )}
      </div>
    </div>
  );
}
