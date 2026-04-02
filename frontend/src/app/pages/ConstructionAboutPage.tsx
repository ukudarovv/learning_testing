import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { Building2, Compass, PenTool, Hammer, CheckCircle2, Target, Award, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function ConstructionAboutPage() {
  const { t } = useTranslation();

  const services = [
    {
      icon: Compass,
      title: t('constructionAbout.services.surveying.title'),
      items: [
        t('constructionAbout.services.surveying.items.geological'),
        t('constructionAbout.services.surveying.items.hydrogeological'),
        t('constructionAbout.services.surveying.items.geodetic'),
        t('constructionAbout.services.surveying.items.equipment'),
      ],
    },
    {
      icon: PenTool,
      title: t('constructionAbout.services.design.title'),
      items: [
        t('constructionAbout.services.design.items.technological'),
        t('constructionAbout.services.design.items.architectural'),
        t('constructionAbout.services.design.items.urban'),
        t('constructionAbout.services.design.items.engineering'),
        t('constructionAbout.services.design.items.reconstruction'),
      ],
    },
    {
      icon: Hammer,
      title: t('constructionAbout.services.construction.title'),
      items: [
        t('constructionAbout.services.construction.items.category'),
        t('constructionAbout.services.construction.items.buildings'),
        t('constructionAbout.services.construction.items.installation'),
        t('constructionAbout.services.construction.items.modernization'),
        t('constructionAbout.services.construction.items.standards'),
      ],
    },
  ];

  const advantages = [
    {
      icon: Target,
      title: t('constructionAbout.advantages.experience.title'),
      description: t('constructionAbout.advantages.experience.description'),
    },
    {
      icon: Award,
      title: t('constructionAbout.advantages.licenses.title'),
      description: t('constructionAbout.advantages.licenses.description'),
    },
    {
      icon: Users,
      title: t('constructionAbout.advantages.team.title'),
      description: t('constructionAbout.advantages.team.description'),
    },
  ];

  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                <Building2 className="w-5 h-5" />
                <span className="font-medium">{t('constructionAbout.hero.badge')}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">{t('constructionAbout.hero.title')}</h1>
              <p className="text-xl text-blue-100 leading-relaxed">
                {t('constructionAbout.hero.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex items-center gap-2 text-sm text-gray-600">
              <Link to="/" className="hover:text-blue-600 transition-colors">{t('constructionAbout.breadcrumbs.home')}</Link>
              <span>/</span>
              <Link to="/construction" className="hover:text-blue-600 transition-colors">{t('constructionAbout.breadcrumbs.construction')}</Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">{t('constructionAbout.breadcrumbs.about')}</span>
            </nav>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          {/* About Section */}
          <section className="mb-16">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">{t('constructionAbout.about.title')}</h2>
              <div className="prose prose-lg max-w-none text-gray-700 space-y-4">
                <p>
                  {t('constructionAbout.about.paragraph1')}
                </p>
                <p>
                  {t('constructionAbout.about.paragraph2')}
                </p>
                <p>
                  {t('constructionAbout.about.paragraph3')}
                </p>
              </div>
            </div>
          </section>

          {/* Services Section */}
          <section className="mb-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('constructionAbout.services.title')}</h2>
              <p className="text-gray-600 max-w-3xl mx-auto">
                {t('constructionAbout.services.subtitle')}
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {services.map((service, index) => {
                const Icon = service.icon;
                return (
                  <div
                    key={index}
                    className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow border border-gray-200"
                  >
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-xl flex items-center justify-center mb-6">
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">{service.title}</h3>
                    <ul className="space-y-3">
                      {service.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Advantages Section */}
          <section className="mb-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('constructionAbout.advantages.title')}</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {advantages.map((advantage, index) => {
                const Icon = advantage.icon;
                return (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-xl border border-blue-200"
                  >
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-xl flex items-center justify-center mb-6">
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{advantage.title}</h3>
                    <p className="text-gray-700">{advantage.description}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* CTA Section */}
          <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-12 rounded-2xl text-center">
            <h2 className="text-3xl font-bold mb-4">{t('constructionAbout.cta.title')}</h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              {t('constructionAbout.cta.description')}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                to="/contacts"
                className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                {t('constructionAbout.cta.contact')}
              </Link>
              <Link
                to="/construction"
                className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                {t('constructionAbout.cta.projects')}
              </Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
