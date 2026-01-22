import { useEffect } from 'react';
import { Header } from '../components/Header';
import { HeroUnicover } from '../components/HeroUnicover';
import { AboutUnicover } from '../components/AboutUnicover';
import { ConstructionSection } from '../components/ConstructionSection';
import { EducationSection } from '../components/EducationSection';
import { Partners } from '../components/Partners';
import { ContactsUnicover } from '../components/ContactsUnicover';
import { FooterUnicover } from '../components/FooterUnicover';
import { useLocation } from 'react-router-dom';
import { scrollToSection } from '../utils/scrollToSection';

export function HomePage() {
  const location = useLocation();

  useEffect(() => {
    // Handle hash navigation when page loads or hash changes
    if (location.hash) {
      const sectionId = location.hash.replace('#', '');
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        scrollToSection(sectionId);
      }, 100);
    }
  }, [location.hash]);

  return (
    <>
      <Header />
      <main>
        <HeroUnicover />
        <AboutUnicover />
        <ConstructionSection />
        <EducationSection />
        <Partners />
        <ContactsUnicover />
      </main>
      <FooterUnicover />
    </>
  );
}