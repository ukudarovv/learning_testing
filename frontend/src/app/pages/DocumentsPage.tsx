import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { DocumentsView } from '../components/lms/DocumentsView';

export function DocumentsPage() {
  return (
    <>
      <Header />
      <DocumentsView />
      <SiteFooter />
    </>
  );
}
