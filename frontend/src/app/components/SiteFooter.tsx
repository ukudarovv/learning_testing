import { Facebook, Instagram, Youtube, MapPin, Phone, Mail, GraduationCap } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { scrollToSection } from '../utils/scrollToSection';
import { BrandLogo } from './BrandLogo';

export function SiteFooter() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const isHomePage = location.pathname === '/';

  const handleHashLink = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    e.preventDefault();
    if (isHomePage) {
      scrollToSection(hash.replace('#', ''));
    } else {
      navigate(`/${hash}`, { replace: false });
    }
  };

  const educationLinks = [
    { name: t('education.about'), href: '/education', isLink: true },
    { name: t('education.programs'), href: '/education', isLink: true },
    { name: t('education.certificateVerification'), href: '/verify', isLink: true },
    { name: t('education.cabinet'), href: '/login', isLink: true },
  ];

  const quickLinks = [
    { name: t('common.home'), href: '#home', isHash: true },
    { name: t('common.about'), href: '#about', isHash: true },
    { name: t('common.contacts'), href: '#contacts', isHash: true },
  ];

  const legalLinks = [
    { name: t('pages.terms.title'), to: '/terms' as const },
    { name: t('pages.privacy.title'), to: '/privacy' as const },
  ];

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Youtube, href: '#', label: 'YouTube' },
  ];

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-6">
              <BrandLogo variant="footer" />
            </div>
            <p className="text-sm mb-6">
              {t('footer.companyDescription')}
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social, index) => {
                const Icon = social.icon;
                return (
                  <a
                    key={index}
                    href={social.href}
                    aria-label={social.label}
                    className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Education Links */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white">{t('footer.education')}</h3>
            </div>
            <ul className="space-y-3">
              {educationLinks.map((link, index) => (
                <li key={index}>
                  {link.isLink ? (
                    <Link to={link.href} className="text-sm hover:text-blue-400 transition-colors">
                      {link.name}
                    </Link>
                  ) : (
                    <a 
                      href={link.href} 
                      onClick={(e) => handleHashLink(e, link.href)}
                      className="text-sm hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      {link.name}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-bold text-white mb-4">{t('footer.contacts')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm">
                <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <span>{t('contacts.addressValue')}</span>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Phone className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <a href="tel:+77075577444" className="hover:text-blue-400 transition-colors">
                  {t('brand.headerPhone')}
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Mail className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <a href={`mailto:${t('brand.headerEmail')}`} className="hover:text-blue-400 transition-colors">
                  {t('brand.headerEmail')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              {t('footer.copyright', { year: currentYear })}
            </p>
            <div className="flex flex-wrap gap-6 text-sm justify-center md:justify-end items-center">
              {quickLinks.map((link, index) => (
                <a 
                  key={index} 
                  href={link.href} 
                  onClick={(e) => handleHashLink(e, link.href)}
                  className="text-gray-400 hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {link.name}
                </a>
              ))}
              {legalLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-gray-400 hover:text-blue-400 transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
