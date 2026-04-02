import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type BrandLogoProps = {
  /** Larger text on auth pages; footer uses light colors on dark background */
  variant?: 'header' | 'auth' | 'footer';
  className?: string;
  onClick?: () => void;
};

export function BrandLogo({ variant = 'header', className = '', onClick }: BrandLogoProps) {
  const { t } = useTranslation();
  const nameSize =
    variant === 'auth'
      ? 'text-2xl sm:text-3xl'
      : variant === 'footer'
        ? 'text-lg sm:text-xl'
        : 'text-lg sm:text-2xl';
  const subSize = variant === 'auth' ? 'text-sm' : 'text-xs';
  const nameColor =
    variant === 'footer' ? 'text-white' : 'text-blue-900';
  const subColor =
    variant === 'footer' ? 'text-gray-400' : 'text-gray-600';

  const inner = (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className={`font-bold tracking-tight break-words ${nameColor} ${nameSize}`}>
        {t('brand.name')}
      </span>
      <span className={`font-medium ${subColor} ${subSize}`}>{t('brand.subtitle')}</span>
    </div>
  );

  return (
    <Link
      to="/"
      onClick={onClick}
      className="block hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      aria-label={`${t('brand.name')}, ${t('brand.subtitle')}`}
    >
      {inner}
    </Link>
  );
}
