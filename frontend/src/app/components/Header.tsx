import { Menu, X, Mail, MapPin, Phone, User, Building2, GraduationCap, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useTranslation } from 'react-i18next';

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

  return (
    <header className="bg-white sticky top-0 z-50 shadow-md">
      {/* Top Bar with Contact Info */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-between py-2 text-sm gap-4">
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <a href="mailto:info@unicover.kz" className="flex items-center gap-2 hover:text-blue-300 transition-colors">
                <Mail className="w-4 h-4" />
                <span>info@unicover.kz</span>
              </a>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">г.Атырау, ул. Студенческий 25, БЦ Bayterek Plaza, 5 этаж</span>
              </div>
              <a href="tel:+77122208092" className="flex items-center gap-2 hover:text-blue-300 transition-colors">
                <Phone className="w-4 h-4" />
                <span>+7 (7122) 20-80-92</span>
              </a>
              <a href="tel:+77084208092" className="flex items-center gap-2 hover:text-blue-300 transition-colors">
                <Phone className="w-4 h-4" />
                <span>+7 708 420-80-92</span>
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
            <Link to="/" className="flex items-center">
              <img 
                src="/logo.jpg" 
                alt="UNICOVER Logo" 
                className="h-14 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            <Link to="/" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              {t('common.home')}
            </Link>
            <a href="/#about" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              {t('common.about')}
            </a>
            
            {/* Construction Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors font-medium">
                <Building2 className="w-4 h-4" />
                {t('common.construction')}
              </button>
              <div className="absolute top-full left-0 mt-2 w-64 bg-white shadow-xl rounded-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <Link to="/construction/about" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                  {t('construction.about')}
                </Link>
                <Link to="/construction/licenses" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                  {t('construction.licenses')}
                </Link>
                <Link to="/projects" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                  {t('construction.projects')}
                </Link>
                <Link to="/news" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                  {t('navigation.news') || 'Новости'}
                </Link>
                <Link to="/construction/vacancies" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                  {t('navigation.vacancies')}
                </Link>
                <a href="/#partners" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                  {t('construction.partners')}
                </a>
              </div>
            </div>

            {/* Education Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors font-medium">
                <GraduationCap className="w-4 h-4" />
                {t('common.education')}
              </button>
              <div className="absolute top-full left-0 mt-2 w-64 bg-white shadow-xl rounded-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <a href="/#education" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                  {t('education.about')}
                </a>
                <Link to="/education" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                  {t('education.programs')}
                </Link>
                <Link to="/verify" className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                  {t('education.certificateVerification')}
                </Link>
              </div>
            </div>

            <Link to="/contacts" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              {t('common.contacts')}
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
              <Link to="/" className="text-gray-700 hover:text-blue-600 py-2">
                Главная
              </Link>
              <a href="/#about" className="text-gray-700 hover:text-blue-600 py-2">
                О компании
              </a>
              <div className="border-t border-gray-200 pt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('common.construction')}</p>
                <Link to="/construction/about" className="text-gray-700 hover:text-blue-600 py-2 pl-4 block">
                  {t('construction.about')}
                </Link>
                <Link to="/construction/licenses" className="text-gray-700 hover:text-blue-600 py-2 pl-4 block">
                  {t('construction.licenses')}
                </Link>
                <Link to="/construction" className="text-gray-700 hover:text-blue-600 py-2 pl-4 block">
                  {t('construction.completedWorks')}
                </Link>
                <Link to="/projects" className="text-gray-700 hover:text-blue-600 py-2 pl-4 block">
                  {t('construction.projects')}
                </Link>
                <Link to="/news" className="text-gray-700 hover:text-blue-600 py-2 pl-4 block">
                  {t('navigation.news') || 'Новости'}
                </Link>
                <a href="/#partners" className="text-gray-700 hover:text-blue-600 py-2 pl-4 block">
                  {t('construction.partners')}
                </a>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('common.education')}</p>
                <a href="/#education" className="text-gray-700 hover:text-blue-600 py-2 pl-4 block">
                  {t('education.about')}
                </a>
                <Link to="/education" className="text-gray-700 hover:text-blue-600 py-2 pl-4 block">
                  {t('education.programs')}
                </Link>
                <Link to="/verify" className="text-gray-700 hover:text-blue-600 py-2 pl-4 block">
                  {t('education.certificateVerification')}
                </Link>
              </div>
              <Link to="/contacts" className="text-gray-700 hover:text-blue-600 py-2">
                {t('common.contacts')}
              </Link>
              <Link to="/login" className="text-blue-600 font-medium py-2 border-t border-gray-200">
                {t('header.personalCabinet')}
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}