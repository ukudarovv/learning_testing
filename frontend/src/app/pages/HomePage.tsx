import { useEffect } from 'react';
import { Header } from '../components/Header';
import { HomeHero } from '../components/HomeHero';
import { AboutSection } from '../components/AboutSection';
import { EducationSection } from '../components/EducationSection';
import { Partners } from '../components/Partners';
import { ContactsSection } from '../components/ContactsSection';
import { SiteFooter } from '../components/SiteFooter';
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
        <HomeHero />
        <AboutSection />
        <EducationSection />
        <Partners />
        <ContactsSection />
      </main>
      <SiteFooter />
    </>
  );
}