import { useState, useEffect } from 'react';
import { CourseEnrollmentRequest, TestEnrollmentRequest } from '../types/lms';
import { coursesService } from '../services/courses';
import { testsService } from '../services/tests';
import { useUser } from '../contexts/UserContext';

export function useEnrollmentRequests() {
  const { user } = useUser();
  const [courseRequests, setCourseRequests] = useState<CourseEnrollmentRequest[]>([]);
  const [testRequests, setTestRequests] = useState<TestEnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const [courseData, testData] = await Promise.all([
          coursesService.getMyEnrollmentRequests(),
          testsService.getMyEnrollmentRequests()
        ]);
        // Ensure data is an array
        setCourseRequests(Array.isArray(courseData) ? courseData : []);
        setTestRequests(Array.isArray(testData) ? testData : []);
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки запросов');
        console.error('Failed to fetch enrollment requests:', err);
        setCourseRequests([]);
        setTestRequests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [user?.id]);

  const refresh = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const [courseData, testData] = await Promise.all([
        coursesService.getMyEnrollmentRequests(),
        testsService.getMyEnrollmentRequests()
      ]);
      // Ensure data is an array
      setCourseRequests(Array.isArray(courseData) ? courseData : []);
      setTestRequests(Array.isArray(testData) ? testData : []);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки запросов');
      console.error('Failed to fetch enrollment requests:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    courseRequests,
    testRequests,
    loading,
    error,
    refresh
  };
}
