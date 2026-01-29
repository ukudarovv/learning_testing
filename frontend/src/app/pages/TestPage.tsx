import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { FooterUnicover } from '../components/FooterUnicover';
import { TestInterface } from '../components/lms/TestInterface';
import { TestResultPage } from '../components/lms/TestResultPage';
import { Answer, TestAttempt } from '../types/lms';
import { useTest } from '../hooks/useTests';
import { examsService } from '../services/exams';
import { useUser } from '../contexts/UserContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useEnrollmentRequests } from '../hooks/useEnrollmentRequests';
import { testsService } from '../services/tests';
import { TestAssignment } from '../types/lms';

export function TestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useUser();
  const { test, loading: testLoading } = useTest(testId);
  const { testRequests } = useEnrollmentRequests();
  const [testAssignments, setTestAssignments] = useState<TestAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true); // Начинаем с true, чтобы дождаться загрузки
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [testCompleted, setTestCompleted] = useState(false);
  const [testResult, setTestResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [starting, setStarting] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, any> | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [testAttemptResult, setTestAttemptResult] = useState<TestAttempt | null>(null);
  const [testTimeSpent, setTestTimeSpent] = useState(0);
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>([]);
  const [creatingRequest, setCreatingRequest] = useState(false);
  
  // Получаем courseId и attemptId из state (для финального теста)
  const courseId = (location.state as any)?.courseId;
  const stateAttemptId = (location.state as any)?.attemptId;
  const viewResults = (location.state as any)?.viewResults || false;
  
  // Проверяем, является ли тест частью курса (если передан courseId, то тест внутри курса)
  // Тесты внутри курса не требуют запроса на запись, они доступны через курс
  const isTestInCourse = !!courseId;
  const isStandaloneTest = !isTestInCourse;
  
  // Обрабатываем просмотр результатов завершенной попытки
  useEffect(() => {
    if (viewResults && stateAttemptId && !testCompleted && !testAttemptResult) {
      const loadCompletedAttempt = async () => {
        try {
          setStarting(true);
          
          // Загружаем попытку
          const attempt = await examsService.getTestAttempt(String(stateAttemptId));
          const completedAt = attempt.completed_at || attempt.completedAt;
          
          if (!completedAt) {
            // Попытка не завершена, но передан viewResults - это ошибка
            toast.error('Попытка теста еще не завершена');
            navigate('/student/dashboard');
            setStarting(false);
            return;
          }
          
          // Получаем testId из попытки, если тест еще не загружен
          const testIdFromAttempt = typeof attempt.test === 'object' ? attempt.test?.id : attempt.test;
          const testIdToUse = testIdFromAttempt || testId;
          
          // Вычисляем время прохождения
          const startedDate = attempt.started_at || attempt.startedAt;
          let timeSpent = 0;
          if (startedDate && completedAt) {
            const started = typeof startedDate === 'string' ? new Date(startedDate) : startedDate;
            const completed = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
            timeSpent = Math.floor((completed.getTime() - started.getTime()) / 1000);
          }
          
          // Загружаем все попытки для подсчета (если есть testId)
          if (testIdToUse) {
            try {
              const attempts = await examsService.getTestAttempts(String(testIdToUse));
              setTestAttempts(attempts);
            } catch (error) {
              console.error('Failed to load test attempts:', error);
              setTestAttempts([]);
            }
          }
          
          // Устанавливаем состояние для отображения результатов
          setTestAttemptResult(attempt);
          setTestTimeSpent(timeSpent);
          setTestResult({ 
            score: attempt.score || 0, 
            passed: attempt.passed || false 
          });
          setTestCompleted(true);
        } catch (error: any) {
          console.error('Failed to load completed attempt:', error);
          toast.error(error.message || 'Ошибка при загрузке результатов теста');
          navigate('/student/dashboard');
        } finally {
          setStarting(false);
        }
      };
      
      loadCompletedAttempt();
    }
  }, [viewResults, stateAttemptId, testCompleted, testAttemptResult, testId, navigate]);

  // Загружаем назначенные тесты
  useEffect(() => {
    const fetchAssignments = async () => {
      // Если это тест внутри курса, не нужно загружать назначения
      if (!isStandaloneTest) {
        setLoadingAssignments(false);
        setAssignmentsLoaded(true);
        return;
      }
      
      // Если пользователь не авторизован, не загружаем назначения
      if (!user) {
        setLoadingAssignments(false);
        setAssignmentsLoaded(true);
        return;
      }
      
      try {
        setLoadingAssignments(true);
        setAssignmentsLoaded(false);
        const assignments = await testsService.getMyTestAssignments();
        setTestAssignments(assignments);
        console.log('TestPage - Test assignments loaded:', assignments);
        console.log('TestPage - Current testId:', testId);
        console.log('TestPage - Assignments for current test:', assignments.filter(a => {
          const assignmentTestId = typeof a.test === 'object' ? a.test?.id : a.testId;
          return String(assignmentTestId) === String(testId);
        }));
      } catch (error) {
        console.error('Failed to fetch test assignments:', error);
        setTestAssignments([]);
      } finally {
        setLoadingAssignments(false);
        setAssignmentsLoaded(true);
      }
    };
    fetchAssignments();
  }, [user, isStandaloneTest, testId]);

  // Загружаем попытки теста
  useEffect(() => {
    const loadAttempts = async () => {
      if (test?.id) {
        try {
          const attempts = await examsService.getTestAttempts(test.id);
          setTestAttempts(attempts);
        } catch (error) {
          console.error('Failed to load test attempts:', error);
        }
      }
    };
    // Загружаем попытки если тест завершен
    if (test?.id && testCompleted && !viewResults) {
      loadAttempts();
    }
  }, [test?.id, testCompleted, viewResults]);

  // Начинаем попытку при загрузке теста или продолжаем незавершенную
  useEffect(() => {
    // Если передан viewResults, не начинаем новую попытку
    if (viewResults) {
      return;
    }
    
    // Ждем загрузки назначенных тестов перед проверкой доступа
    // Для standalone тестов ждем завершения загрузки назначений
    if (test && !attemptId && !starting && (!isStandaloneTest || assignmentsLoaded)) {
      const initializeAttempt = async () => {
        try {
          setStarting(true);
          
          // Проверяем доступ для тестов (кроме тестов внутри курса)
          // Тесты внутри курса доступны через курс и не требуют отдельного запроса
          if (!isTestInCourse && test.id) {
            // Проверяем наличие назначенного теста администратором
            const assignedTest = testAssignments.find(a => {
              const assignmentTestId = typeof a.test === 'object' ? a.test?.id : a.testId;
              return String(assignmentTestId) === String(test.id) && (a.status === 'assigned' || a.status === 'completed');
            });
            
            console.log('TestPage - Checking access for test:', test.id);
            console.log('TestPage - Test assignments:', testAssignments);
            console.log('TestPage - Assigned test found:', assignedTest);
            
            // Проверяем наличие одобренного запроса на запись
            const existingRequest = testRequests.find(r => {
              const requestTestId = typeof r.test === 'object' ? r.test?.id : r.testId;
              return String(requestTestId) === String(test.id);
            });
            
            console.log('TestPage - Existing request:', existingRequest);
            
            // Доступ есть, если тест назначен администратором ИЛИ есть одобренный запрос
            if (!assignedTest && (!existingRequest || existingRequest.status !== 'approved')) {
              // Нет доступа - показываем сообщение
              if (existingRequest && existingRequest.status === 'pending') {
                toast.info(t('lms.test.requestPending') || 'Запрос на запись уже подан и ожидает подтверждения администратора');
              } else {
                toast.info(t('lms.test.accessRequired') || 'Для прохождения этого теста требуется подтверждение администратора');
              }
              navigate('/student/dashboard');
              setStarting(false);
              return;
            }
            
            console.log('TestPage - Access granted');
          }
          
          // Если передан attemptId из state (для продолжения незавершенной попытки)
          if (stateAttemptId) {
            try {
              const attempt = await examsService.getTestAttempt(String(stateAttemptId));
              const attemptIdNum = Number(attempt.id);
              const completedAt = attempt.completed_at || attempt.completedAt;
              
              // Если попытка не завершена, продолжаем её
              if (!completedAt) {
                setAttemptId(attemptIdNum);
                
                // Сохраняем ответы и время начала для передачи в TestInterface
                const savedAnswersData = attempt.answers || {};
                const startedAtDate = attempt.started_at || attempt.startedAt;
                setSavedAnswers(savedAnswersData);
                setStartedAt(startedAtDate);
                
                // Сохраняем attemptId и ответы в localStorage для автосохранения
                localStorage.setItem(`test_${test.id}_progress`, JSON.stringify({
                  attemptId: attemptIdNum,
                  answers: savedAnswersData,
                  startedAt: startedAtDate
                }));
                setStarting(false);
                return;
              }
            } catch (error: any) {
              console.error('Failed to load attempt from state:', error);
              // Если не удалось загрузить попытку, продолжаем с проверкой localStorage
            }
          }
          
          // Проверяем localStorage для незавершенной попытки
          const savedProgress = localStorage.getItem(`test_${test.id}_progress`);
          if (savedProgress) {
            try {
              const progress = JSON.parse(savedProgress);
              if (progress.attemptId) {
                // Проверяем, существует ли эта попытка и не завершена ли она
                const attempt = await examsService.getTestAttempt(String(progress.attemptId));
                if (!attempt.completed_at && !attempt.completedAt) {
                  // Продолжаем незавершенную попытку
                  const attemptIdNum = Number(attempt.id);
                  setAttemptId(attemptIdNum);
                  
                  // Сохраняем ответы и время начала для передачи в TestInterface
                  const savedAnswersData = attempt.answers || {};
                  const startedAtDate = attempt.started_at || attempt.startedAt;
                  setSavedAnswers(savedAnswersData);
                  setStartedAt(startedAtDate);
                  
                  // Обновляем localStorage с актуальными данными
                  localStorage.setItem(`test_${test.id}_progress`, JSON.stringify({
                    attemptId: attemptIdNum,
                    answers: savedAnswersData,
                    startedAt: startedAtDate
                  }));
                  return;
                } else {
                  // Попытка завершена, удаляем из localStorage
                  localStorage.removeItem(`test_${test.id}_progress`);
                }
              }
            } catch (error: any) {
              console.error('Failed to load attempt from localStorage:', error);
              // Если не удалось загрузить попытку, удаляем из localStorage
              localStorage.removeItem(`test_${test.id}_progress`);
            }
          }
          
          // Проверяем незавершенные попытки через API
          try {
            const attempts = await examsService.getTestAttempts(test.id);
            setTestAttempts(attempts);
            
            const incompleteAttempt = attempts.find(
              attempt => !attempt.completed_at && !attempt.completedAt
            );
            
            if (incompleteAttempt) {
              // Продолжаем незавершенную попытку
              const attemptIdNum = Number(incompleteAttempt.id);
              setAttemptId(attemptIdNum);
              
              // Сохраняем ответы и время начала для передачи в TestInterface
              const savedAnswersData = incompleteAttempt.answers || {};
              const startedAtDate = incompleteAttempt.started_at || incompleteAttempt.startedAt;
              setSavedAnswers(savedAnswersData);
              setStartedAt(startedAtDate);
              
              // Сохраняем в localStorage
              localStorage.setItem(`test_${test.id}_progress`, JSON.stringify({
                attemptId: attemptIdNum,
                answers: savedAnswersData,
                startedAt: startedAtDate
              }));
              return;
            }
            
            // Проверяем, есть ли отличная попытка (score >= 90)
            const excellentAttempt = attempts.find(
              attempt => {
                const completedAt = attempt.completed_at || attempt.completedAt;
                const score = attempt.score;
                const passed = attempt.passed;
                return completedAt && score !== null && score !== undefined && score >= 90 && passed;
              }
            );
            
            if (excellentAttempt) {
              toast.error(t('lms.coursePlayer.excellentPassBlocked') || 'Тест уже пройден на отлично (90%+). Дополнительные попытки недоступны.');
              navigate('/student/dashboard');
              return;
            }
          } catch (error: any) {
            console.error('Failed to check incomplete attempts:', error);
            // Продолжаем с созданием новой попытки
          }
          
          // Начинаем новую попытку
          const attempt = await examsService.startTestAttempt(test.id);
          const attemptIdNum = Number(attempt.id);
          setAttemptId(attemptIdNum);
          
          // Сохраняем attemptId в localStorage для автосохранения
          localStorage.setItem(`test_${test.id}_progress`, JSON.stringify({
            attemptId: attemptIdNum,
          }));
        } catch (error: any) {
          toast.error(error.message || 'Ошибка при начале теста');
          navigate('/student/dashboard');
        } finally {
          setStarting(false);
        }
      };
      initializeAttempt();
    }
  }, [test, attemptId, starting, navigate, stateAttemptId, viewResults, isStandaloneTest, assignmentsLoaded, testAssignments, testRequests, isTestInCourse, t]);

  const handleTestComplete = async (answers: Answer[], timeSpent: number, videoBlob?: Blob) => {
    if (!attemptId || !test) return;

    try {
      const result = await examsService.submitTestAttempt(String(attemptId), videoBlob);
      
      // Удаляем сохраненный прогресс
      localStorage.removeItem(`test_${test.id}_progress`);
      
      // Сохраняем результат попытки и время
      setTestAttemptResult(result);
      setTestTimeSpent(timeSpent);
      
      setTestResult({ 
        score: result.score || 0, 
        passed: result.passed || false 
      });
      setTestCompleted(true);
      
      // Обновляем список попыток
      const updatedAttempts = await examsService.getTestAttempts(test.id);
      setTestAttempts(updatedAttempts);
      
      if (result.passed) {
        if (!isStandaloneTest) {
          toast.success(t('lms.test.testPassed') || 'Тест успешно сдан!');
        }
      } else {
        toast.error(t('lms.test.testFailed') || 'Тест не сдан. Попробуйте еще раз.');
      }
    } catch (error: any) {
      toast.error(error.message || t('lms.test.testCompleteError') || 'Ошибка при завершении теста');
    }
  };


  const handleCancel = () => {
    navigate('/student/dashboard');
  };

  // Показываем страницу результатов вместо модального окна
  // Для viewResults можем показать результаты даже если test еще загружается (данные есть в attempt)
  if (testCompleted && testResult && testAttemptResult) {
    // Если тест еще не загружен, но есть данные в попытке, используем их
    const testToShow = test || (testAttemptResult.test && typeof testAttemptResult.test === 'object' ? testAttemptResult.test : null);
    
    if (!testToShow) {
      // Если нет данных о тесте, показываем загрузку
      return (
        <>
          <Header />
          <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Загрузка теста...</p>
            </div>
          </div>
          <FooterUnicover />
        </>
      );
    }
    return (
      <>
        <Header />
        <TestResultPage
          test={testToShow}
          result={testAttemptResult}
          attemptsUsed={testAttempts.length}
          attemptsTotal={testToShow.max_attempts || testToShow.maxAttempts || 3}
          timeSpent={testTimeSpent}
          isStandalone={isStandaloneTest}
          onRetry={() => {
            setTestResult(null);
            setTestAttemptResult(null);
            setTestCompleted(false);
            setAttemptId(null);
            // Перезагружаем страницу для новой попытки
            window.location.reload();
          }}
          onBackToCourse={courseId ? () => navigate(`/student/course/${courseId}`) : undefined}
          onBackToDashboard={() => navigate('/student/dashboard')}
        />
        <FooterUnicover />
      </>
    );
  }

  // Показываем загрузку только если не просматриваем результаты и не завершен тест
  if (!testCompleted && (testLoading || starting || !test || (!viewResults && !attemptId))) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {starting ? 'Начало теста...' : 'Загрузка теста...'}
            </p>
          </div>
        </div>
        <FooterUnicover />
      </>
    );
  }

  if (!test.questions || test.questions.length === 0) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Тест не найден</h1>
            <button
              onClick={() => navigate('/student/dashboard')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Вернуться к курсам
            </button>
          </div>
        </div>
        <FooterUnicover />
      </>
    );
  }

  return (
    <>
      <Header />
      <TestInterface
        testId={testId || test.id}
        attemptId={attemptId}
        title={test.title}
        timeLimit={test.timeLimit || test.time_limit || 30}
        questions={test.questions || []}
        requiresVideoRecording={test.requiresVideoRecording || test.requires_video_recording || false}
        onComplete={handleTestComplete}
        onCancel={handleCancel}
        savedAnswers={savedAnswers || undefined}
        startedAt={startedAt || undefined}
      />
      <FooterUnicover />
    </>
  );
}
