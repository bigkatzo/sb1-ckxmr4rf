import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';

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
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, right: 0 });
  const [dropdownPosition, setDropdownPosition] = useState<'left' | 'right'>('right');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside dropdown
  useEffect(() => {
    if (!isOpen) return;
    
    function handleClickOutside(event: MouseEvent) {
      if (buttonRef.current?.contains(event.target as Node)) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calculate dropdown position and coordinates when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const menuWidth = 200; // Approximate menu width
      
      let finalPos: 'left' | 'right' = position === 'auto' ? 'right' : position;
      
      // For auto position, determine direction based on available space
      if (position === 'auto') {
        if (buttonRect.right + menuWidth > viewportWidth) {
          finalPos = 'left';
        }
      }
      
      setDropdownPosition(finalPos);
      
      // Calculate absolute position for the menu
      const topPosition = buttonRect.bottom + window.scrollY;
      
      if (finalPos === 'right') {
        setMenuPosition({
          top: topPosition,
          left: buttonRect.left + window.scrollX,
          right: 0
        });
      } else {
        setMenuPosition({
          top: topPosition,
          left: 0,
          right: window.innerWidth - buttonRect.right - window.scrollX
        });
      }
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

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={triggerClassName}
        title="More options"
      >
        {triggerIcon}
      </button>

      {isOpen && createPortal(
        <div 
          ref={menuRef}
          style={{
            position: 'absolute',
            top: `${menuPosition.top}px`,
            ...(dropdownPosition === 'right' 
              ? { left: `${menuPosition.left}px` } 
              : { right: `${menuPosition.right}px` }),
            zIndex: 9999,
            marginTop: '4px'
          }}
          className={`${menuClassName}`}
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
        </div>,
        document.body
      )}
    </>
  );
} 