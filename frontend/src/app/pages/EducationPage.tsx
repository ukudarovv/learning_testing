import { useEffect } from 'react';
import { Header } from '../components/Header';
import { CoursesUnicover } from '../components/CoursesUnicover';
import { OnlineLearning } from '../components/OnlineLearning';
import { FooterUnicover } from '../components/FooterUnicover';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { scrollToSection } from '../utils/scrollToSection';

export function EducationPage() {
  const { t } = useTranslation();
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
      <main className="pt-20">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('education.pageTitle')}</h1>
          <p className="text-lg text-gray-600 mb-12 max-w-3xl">
            {t('education.pageDescription')}
          </p>
        </div>
        <CoursesUnicover />
        <OnlineLearning />
      </main>
      <FooterUnicover />
    </>
  );
}