import { Header } from '../components/Header';
import { ContactsSection } from '../components/ContactsSection';
import { SiteFooter } from '../components/SiteFooter';

export function ContactsPage() {
  return (
    <>
      <Header />
      <main className="pt-20">
        <ContactsSection />
      </main>
      <SiteFooter />
    </>
  );
}