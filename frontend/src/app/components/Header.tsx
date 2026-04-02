import { Menu, X, Mail, MapPin, Phone, User, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from './BrandLogo';

export function Header() {
  const navigate = useNavigate();
  const { user: currentUser, logout } = useUser();
  const { i18n, t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [language, setLanguage] = useState<string>(i18n.language || 'ru');

  useEffect(() => {
    // Sync language state with i18n
    const currentLang = i18n.language || localStorage.getItem('language') || 'ru';
    setLanguage(currentLang);
    i18n.changeLanguage(currentLang);
  }, [i18n]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    navigate('/');
    }
  };

  const getDashboardLink = () => {
    if (!currentUser) return '/login';
    
    switch (currentUser.role) {
      case 'student':
        return '/student/dashboard';
      case 'pdek_member':
      case 'pdek_chairman':
        return '/pdek/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/dashboard';
    }
  };

  const closeMobileMenu = () => setIsMenuOpen(false);

  return (
    <header className="bg-white sticky top-0 z-50 shadow-md">
      {/* Top Bar with Contact Info */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-between py-2 text-sm gap-4">
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <a href={`mailto:${t('brand.headerEmail')}`} className="flex items-center gap-2 hover:text-blue-300 transition-colors">
                <Mail className="w-4 h-4" />
                <span>{t('brand.headerEmail')}</span>
              </a>
              <div className="flex items-center gap-2 max-w-md">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">{t('brand.headerAddress')}</span>
              </div>
              <a href="tel:+77075577444" className="flex items-center gap-2 hover:text-blue-300 transition-colors">
                <Phone className="w-4 h-4" />
                <span>{t('brand.headerPhone')}</span>
              </a>
            </div>
            
            {/* Language Selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  i18n.changeLanguage('ru');
                  setLanguage('ru');
                  localStorage.setItem('language', 'ru');
                }}
                className={`text-xs px-3 py-1 rounded ${language === 'ru' ? 'bg-blue-600 text-white' : 'hover:text-blue-300'}`}
              >
                {t('header.russian')}
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={() => {
                  i18n.changeLanguage('kz');
                  setLanguage('kz');
                  localStorage.setItem('language', 'kz');
                }}
                className={`text-xs px-3 py-1 rounded ${language === 'kz' ? 'bg-blue-600 text-white' : 'hover:text-blue-300'}`}
              >
                {t('header.kazakh')}
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={() => {
                  i18n.changeLanguage('en');
                  setLanguage('en');
                  localStorage.setItem('language', 'en');
                }}
                className={`text-xs px-3 py-1 rounded ${language === 'en' ? 'bg-blue-600 text-white' : 'hover:text-blue-300'}`}
              >
                {t('header.english')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center">
            <BrandLogo onClick={closeMobileMenu} className="min-h-[3.5rem] justify-center" />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6 flex-wrap justify-end">
            <Link to="/" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              {t('common.home')}
            </Link>
            <a href="/#about" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              {t('common.about')}
            </a>
            <a href="/#education" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              {t('common.education')}
            </a>
            <a href="/#contacts" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              {t('common.contacts')}
            </a>
            <Link to="/verify" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              {t('education.certificateVerification')}
            </Link>
            
            {currentUser ? (
              <div className="flex items-center gap-3">
                <Link
                  to={getDashboardLink()}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-md"
                >
                  <User className="w-4 h-4" />
                  {currentUser?.full_name?.split(' ')[0] || currentUser?.fullName?.split(' ')[0] || t('header.personalCabinet')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  title={t('common.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-md"
              >
                <User className="w-4 h-4" />
                Личный кабинет
              </Link>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:text-blue-600"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col gap-4">
              <Link to="/" onClick={closeMobileMenu} className="text-gray-700 hover:text-blue-600 py-2">
                Главная
              </Link>
              <a href="/#about" onClick={closeMobileMenu} className="text-gray-700 hover:text-blue-600 py-2">
                О компании
              </a>
              <a href="/#education" onClick={closeMobileMenu} className="text-gray-700 hover:text-blue-600 py-2">
                {t('common.education')}
              </a>
              <a href="/#contacts" onClick={closeMobileMenu} className="text-gray-700 hover:text-blue-600 py-2">
                {t('common.contacts')}
              </a>
              <Link to="/verify" onClick={closeMobileMenu} className="text-gray-700 hover:text-blue-600 py-2">
                {t('education.certificateVerification')}
              </Link>
              <Link to="/login" onClick={closeMobileMenu} className="text-blue-600 font-medium py-2 border-t border-gray-200">
                {t('header.personalCabinet')}
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}