import { Header } from '../components/Header';
import { Dashboard } from '../components/Dashboard';
import { SiteFooter } from '../components/SiteFooter';

export function DashboardPage() {
  return (
    <>
      <Header />
      <main className="pt-20">
        <Dashboard />
      </main>
      <SiteFooter />
    </>
  );
}
