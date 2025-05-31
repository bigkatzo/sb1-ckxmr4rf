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
  const linkStyles = to || onClick ? "hover:text-primary transition-colors inline-flex items-center gap-1" : "";
  const secondaryStyles = "text-lg sm:text-2xl font-medium text-gray-500/70 hover:text-primary transition-colors inline-flex items-center gap-1 ml-3";
  
  const arrowIcon = (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      className="h-4 w-4 mt-1"
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M9 5l7 7-7 7" 
      />
    </svg>
  );

  // Secondary link component
  const SecondaryLink = () => {
    if (!secondaryTitle) return null;
    
    if (secondaryTo) {
      return (
        <Link to={secondaryTo} className={secondaryStyles}>
          {secondaryTitle}
          {arrowIcon}
        </Link>
      );
    } else if (secondaryOnClick) {
      return (
        <button onClick={secondaryOnClick} className={secondaryStyles}>
          {secondaryTitle}
          {arrowIcon}
        </button>
      );
    } else {
      return <span className={secondaryStyles.replace('hover:text-primary', '')}>{secondaryTitle}</span>;
    }
  };

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex flex-wrap items-center">
        {to ? (
          <Link to={to} className={`${commonStyles} ${linkStyles}`}>
            {title}
            {arrowIcon}
          </Link>
        ) : onClick ? (
          <button onClick={onClick} className={`${commonStyles} ${linkStyles}`}>
            {title}
            {arrowIcon}
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