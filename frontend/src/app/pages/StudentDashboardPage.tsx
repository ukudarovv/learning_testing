import { Header } from '../components/Header';
import { StudentDashboard } from '../components/lms/StudentDashboard';
import { SiteFooter } from '../components/SiteFooter';

export function StudentDashboardPage() {
  return (
    <>
      <Header />
      <StudentDashboard />
      <SiteFooter />
    </>
  );
}
