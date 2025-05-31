import { Link } from 'react-router-dom';

interface SectionHeaderProps {
  title: string;
  description?: string;
  to?: string;
  onClick?: () => void;
  secondaryTitle?: string;
  secondaryTo?: string;
  secondaryOnClick?: () => void;
}

export function SectionHeader({
  title,
  description,
  to,
  onClick,
  secondaryTitle,
  secondaryTo,
  secondaryOnClick
}: SectionHeaderProps) {
  const commonStyles = "text-lg sm:text-2xl font-bold text-text";
  const linkStyles = to || onClick ? "hover:opacity-95 transition-opacity" : "";
  const secondaryStyles = "text-lg sm:text-2xl font-normal text-gray-400 hover:text-gray-300 transition-opacity ml-3";

  // Secondary link component
  const SecondaryLink = () => {
    if (!secondaryTitle) return null;
    
    if (secondaryTo) {
      return (
        <Link to={secondaryTo} className={secondaryStyles}>
          {secondaryTitle}
        </Link>
      );
    } else if (secondaryOnClick) {
      return (
        <button onClick={secondaryOnClick} className={secondaryStyles}>
          {secondaryTitle}
        </button>
      );
    } else {
      return <span className={secondaryStyles.replace('hover:text-gray-300', '')}>{secondaryTitle}</span>;
    }
  };

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex flex-wrap items-center">
        {to ? (
          <Link to={to} className={`${commonStyles} ${linkStyles}`}>
            {title}
          </Link>
        ) : onClick ? (
          <button onClick={onClick} className={`${commonStyles} ${linkStyles}`}>
            {title}
          </button>
        ) : (
          <h2 className={commonStyles}>{title}</h2>
        )}
        
        {secondaryTitle && <SecondaryLink />}
      </div>
      {description && <p className="mt-1 sm:mt-2 text-xs sm:text-base text-text-muted">{description}</p>}
    </div>
  );
}