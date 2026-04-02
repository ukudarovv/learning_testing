import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PasswordResetPage } from './pages/PasswordResetPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { StudentCoursesPage } from './pages/StudentCoursesPage';
import { StudentHistoryPage } from './pages/StudentHistoryPage';
import { StudentTestsPage } from './pages/StudentTestsPage';
import { StudentSupportPage } from './pages/StudentSupportPage';
import { PDEKDashboardPage } from './pages/PDEKDashboardPage';
import { TestPage } from './pages/TestPage';
import { CoursePage } from './pages/CoursePage';
import { DocumentsPage } from './pages/DocumentsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminCertificatesPage } from './pages/AdminCertificatesPage';
import { EditTestPage } from './pages/EditTestPage';
import { CreateTestPage } from './pages/CreateTestPage';
import { EditCoursePage } from './pages/EditCoursePage';
import { VerifyCertificatePage } from './pages/VerifyCertificatePage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function RedirectHome() {
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/construction/*" element={<RedirectHome />} />
        <Route path="/education" element={<RedirectHome />} />
        <Route path="/projects/*" element={<RedirectHome />} />
        <Route path="/news/*" element={<RedirectHome />} />
        <Route path="/contacts" element={<RedirectHome />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/password-reset" element={<PasswordResetPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/verify/:certificateNumber?" element={<VerifyCertificatePage />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        
        {/* Student Routes */}
        <Route path="/student/dashboard" element={
          <ProtectedRoute requiredRole="student">
            <StudentDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/student/courses" element={
          <ProtectedRoute requiredRole="student">
            <StudentCoursesPage />
          </ProtectedRoute>
        } />
        <Route path="/student/history" element={
          <ProtectedRoute requiredRole="student">
            <StudentHistoryPage />
          </ProtectedRoute>
        } />
        <Route path="/student/tests" element={
          <ProtectedRoute requiredRole="student">
            <StudentTestsPage />
          </ProtectedRoute>
        } />
        <Route path="/student/support" element={
          <ProtectedRoute requiredRole="student">
            <StudentSupportPage />
          </ProtectedRoute>
        } />
        <Route path="/student/course/:courseId" element={
          <ProtectedRoute requiredRole="student">
            <CoursePage />
          </ProtectedRoute>
        } />
        <Route path="/student/test/:testId" element={
          <ProtectedRoute requiredRole="student">
            <TestPage />
          </ProtectedRoute>
        } />
        <Route path="/student/documents" element={
          <ProtectedRoute requiredRole="student">
            <DocumentsPage />
          </ProtectedRoute>
        } />
        
        {/* PDEK Routes */}
        <Route path="/pdek/dashboard" element={
          <ProtectedRoute requiredRole={['pdek_member', 'pdek_chairman']}>
            <PDEKDashboardPage />
          </ProtectedRoute>
        } />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/certificates" element={
          <ProtectedRoute requiredRole="admin">
            <AdminCertificatesPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/tests/new" element={
          <ProtectedRoute requiredRole="admin">
            <CreateTestPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/tests/:testId/edit" element={
          <ProtectedRoute requiredRole="admin">
            <EditTestPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/courses/:courseId/edit" element={
          <ProtectedRoute requiredRole="admin">
            <EditCoursePage />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
