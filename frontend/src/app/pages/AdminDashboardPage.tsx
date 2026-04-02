import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { AdminDashboard } from '../components/lms/AdminDashboard';

export function AdminDashboardPage() {
  return (
    <>
      <Header />
      <AdminDashboard />
      <SiteFooter />
    </>
  );
}
