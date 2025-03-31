import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, X as XIcon, Package, Twitter, Mail, Send } from 'lucide-react';
import { SearchBar } from '../search/SearchBar';
import { Logo } from '../ui/Logo';
import { WalletButton } from '../wallet/WalletButton';
import { HowItWorksModal } from '../HowItWorksModal';

type MenuItem = {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
} & (
  | { to: string; external?: false }
  | { href: string; external: true }
);

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  const menuItems: MenuItem[] = [
    { to: '/orders', icon: <Package className="h-3.5 w-3.5" />, label: 'Orders' },
    { to: '#', label: 'How it Works', onClick: () => setIsHowItWorksOpen(true) },
    { to: '/terms', label: 'Terms of Use' },
    { to: '/privacy', label: 'Privacy Policy' },
    { 
      href: 'https://t.me/storedotfun',
      label: 'Support',
      external: true
    }
  ];

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
      href: 'mailto:store@dotfunenterprises.fun',
      label: 'Email',
      icon: <Mail className="h-3.5 w-3.5" />
    }
  ];

  const MenuContent = () => (
    <div>
      <div className="py-1 border-b border-gray-800">
        {menuItems.map((item) => 
          item.external ? (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          ) : item.onClick ? (
            <button
              key={item.label}
              onClick={() => {
                item.onClick?.();
                setIsMenuOpen(false);
              }}
              className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[13px] text-gray-400 hover:text-white hover:bg-gray-800"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        )}
      </div>
      <div className="flex justify-center gap-4 py-2">
        {socialLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            onClick={() => setIsMenuOpen(false)}
            title={link.label}
          >
            {link.icon}
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <nav className="fixed top-0 w-full bg-black/95 backdrop-blur-sm text-white z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center">
              <Logo />
            </Link>
            <div className="w-[120px] relative">
              <button
                onClick={() => setIsHowItWorksOpen(true)}
                className="absolute inset-0 text-gray-400 hover:font-bold transition-all hidden md:block"
              >
                [how it works]
              </button>
            </div>
          </div>

          {/* Desktop Search */}
          <div className="hidden md:block flex-1 max-w-xl px-8">
            <SearchBar />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <WalletButton />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors relative"
            >
              {isMenuOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <Search className="h-5 w-5" />
            </button>
            <WalletButton />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-400 hover:text-white"
            >
              {isMenuOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        {isSearchOpen && (
          <div className="md:hidden py-2 px-2 border-t border-gray-800">
            <SearchBar />
          </div>
        )}

        {/* Desktop Menu Dropdown */}
        {isMenuOpen && (
          <div className="absolute right-4 top-14 w-56 mt-2 bg-gray-900 rounded-lg shadow-lg border border-gray-800 overflow-hidden z-50 hidden md:block">
            <MenuContent />
          </div>
        )}

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute right-0 top-14 w-48 bg-gray-900 rounded-bl-lg border-l border-b border-gray-800 z-50">
            <MenuContent />
          </div>
        )}
      </div>

      {/* How it Works Modal */}
      {isHowItWorksOpen && (
        <HowItWorksModal onClose={() => setIsHowItWorksOpen(false)} />
      )}
    </nav>
  );
}