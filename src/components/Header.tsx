import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { Logo } from './ui/Logo';

export function Header() {
  const { currentTheme, isCollectionTheme } = useTheme();
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            {isCollectionTheme && currentTheme.logoUrl ? (
              <img 
                src={currentTheme.logoUrl} 
                alt="Collection Logo" 
                className="h-8 w-auto object-contain"
                onError={(e) => {
                  // Fallback to default logo if collection logo fails to load
                  console.warn('Collection logo failed to load, falling back to default');
                  e.currentTarget.style.display = 'none';
                  // Show default logo by triggering a re-render
                  e.currentTarget.parentElement?.querySelector('.fallback-logo')?.classList.remove('hidden');
                }}
                loading="lazy"
              />
            ) : null}
            {/* Default logo - hidden when collection logo is shown */}
            <div className={`fallback-logo ${isCollectionTheme && currentTheme.logoUrl ? 'hidden' : ''}`}>
              <Logo />
            </div>
          </Link>
        </div>
        
        {/* Rest of your header content */}
      </div>
    </header>
  );
} 