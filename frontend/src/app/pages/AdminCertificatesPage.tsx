import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { CertificateManagement } from '../components/admin/CertificateManagement';

export function AdminCertificatesPage() {
  return (
    <>
      <Header />
      <CertificateManagement />
      <SiteFooter />
    </>
  );
}
