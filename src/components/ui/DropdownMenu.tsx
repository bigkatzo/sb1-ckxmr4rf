import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  href?: string;
  to?: string;
  target?: string;
  as?: React.ElementType;
}

interface DropdownMenuProps {
  items: DropdownItem[];
  triggerIcon?: React.ReactNode;
  triggerClassName?: string;
  menuClassName?: string;
  position?: 'left' | 'right' | 'auto';
}

export function DropdownMenu({
  items,
  triggerIcon = <MoreVertical className="h-4 w-4" />,
  triggerClassName = "p-1 text-gray-400 hover:text-gray-300 transition-colors rounded-md",
  menuClassName = "bg-gray-800 rounded-md shadow-lg py-1 min-w-[160px]",
  position = 'auto'
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'left' | 'right'>('right');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && position === 'auto' && buttonRef.current && menuRef.current) {
      // Default to right positioning
      let menuPos: 'left' | 'right' = 'right';
      
      // Get button's position and dimensions
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuWidth = menuRef.current.offsetWidth;
      
      // Check if opening to the right would overflow the viewport
      if (buttonRect.right + menuWidth > window.innerWidth) {
        menuPos = 'left';
      }
      
      setDropdownPosition(menuPos);
    }
  }, [isOpen, position]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleItemClick = (e: React.MouseEvent, item: DropdownItem) => {
    e.stopPropagation();
    if (item.onClick) {
      item.onClick();
    }
    setIsOpen(false);
  };

  // Determine final position
  const finalPosition = position === 'auto' ? dropdownPosition : position;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={triggerClassName}
        title="More options"
      >
        {triggerIcon}
      </button>

      {isOpen && (
        <div 
          ref={menuRef}
          className={`absolute z-[100] mt-1 ${finalPosition === 'right' ? 'right-0' : 'left-0'} ${menuClassName}`}
        >
          <div className="overflow-hidden">
            {items.map((item, index) => {
              // Render according to item type
              if (item.to && item.as === Link) {
                return (
                  <Link
                    key={index}
                    to={item.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-700 transition-colors text-sm whitespace-nowrap ${
                      item.destructive ? 'text-red-400 hover:text-red-300' : 'text-gray-200'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              } else if (item.href) {
                return (
                  <a
                    key={index}
                    href={item.href}
                    target={item.target || "_blank"}
                    rel="noopener noreferrer"
                    className={`block w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-700 transition-colors text-sm whitespace-nowrap ${
                      item.destructive ? 'text-red-400 hover:text-red-300' : 'text-gray-200'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </a>
                );
              } else {
                return (
                  <button
                    key={index}
                    onClick={(e) => handleItemClick(e, item)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-700 transition-colors text-sm whitespace-nowrap ${
                      item.destructive ? 'text-red-400 hover:text-red-300' : 'text-gray-200'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              }
            })}
          </div>
        </div>
      )}
    </div>
  );
} 