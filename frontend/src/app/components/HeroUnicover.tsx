import { GraduationCap, Shield, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function HeroUnicover() {
  const { t } = useTranslation();
  
  return (
    <section id="home" className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBidWlsZGluZ3xlbnwwfHx8fDE3MzQ4MDA2NDV8MA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Background"
          className="w-full h-full object-cover"
        />
      </div>
      
      <div className="container mx-auto px-4 py-24 md:py-32 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">{t('homepage.hero.bin')}</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              {t('homepage.hero.companyName')}
            </h1>
            <p className="text-xl md:text-2xl mb-4 text-blue-50">
              {t('homepage.hero.subtitle')}
            </p>
            <p className="text-lg mb-8 text-blue-100 max-w-3xl mx-auto">
              {t('homepage.hero.description')}
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-12">
            <a
              href="#education"
              className="group block bg-white/10 backdrop-blur-sm p-8 rounded-2xl border-2 border-white/20 hover:bg-white/20 hover:border-white/40 transition-all"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">{t('homepage.hero.education.title')}</h3>
                  <p className="text-blue-100 text-sm mb-4">
                    {t('homepage.hero.education.description')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                {t('homepage.hero.learnMore')}
                <ArrowRight className="w-4 h-4" />
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Decorative wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 50L60 45C120 40 240 30 360 35C480 40 600 60 720 65C840 70 960 60 1080 50C1200 40 1320 30 1380 25L1440 20V100H1380C1320 100 1200 100 1080 100C960 100 840 100 720 100C600 100 480 100 360 100C240 100 120 100 60 100H0V50Z" fill="white"/>
        </svg>
      </div>
    </section>
  );
}
