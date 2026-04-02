import { Header } from '../components/Header';
import { PDEKDashboard } from '../components/lms/PDEKDashboard';
import { SiteFooter } from '../components/SiteFooter';

export function PDEKDashboardPage() {
  return (
    <>
      <Header />
      <PDEKDashboard />
      <SiteFooter />
    </>
  );
}
