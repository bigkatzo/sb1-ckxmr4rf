import { Link } from 'react-router-dom';
import { Twitter, Send, Mail } from 'lucide-react';
import { Logo } from '../ui/Logo';

export function Footer() {
  const socialLinks = [
    { 
      href: 'https://x.com/storedotfun',
      label: 'X (Twitter)',
      icon: <Twitter className="h-3.5 w-3.5" />
    },
    { 
      href: 'https://t.me/storedotfun',
      label: 'Telegram',
      icon: <Send className="h-3.5 w-3.5" />
    },
    { 
      href: 'mailto:support@store.fun',
      label: 'Email',
      icon: <Mail className="h-3.5 w-3.5" />
    }
  ];

  return (
    <footer className="bg-black/95 backdrop-blur-sm text-gray-400 py-3 sm:py-4 mt-auto relative z-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 order-2 sm:order-1">
            <Logo className="text-xs sm:text-sm" />
            <span className="text-[10px] sm:text-xs">© {new Date().getFullYear()}</span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 order-1 sm:order-2">
            <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
              <Link 
                to="/merchant/signin" 
                className="text-[10px] sm:text-xs hover:text-purple-400 transition-colors"
              >
                Merchant Portal
              </Link>
              <Link 
                to="/privacy" 
                className="text-[10px] sm:text-xs hover:text-purple-400 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms" 
                className="text-[10px] sm:text-xs hover:text-purple-400 transition-colors"
              >
                Terms of Use
              </Link>
              <a
                href="https://t.me/storedotfun"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] sm:text-xs hover:text-purple-400 transition-colors"
              >
                Support
              </a>
            </nav>
            
            <div className="flex items-center gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-purple-400 transition-colors"
                  title={link.label}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}