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

interface MenuPosition {
  top: number;
  left: number;
  right: number;
  maxHeight: number;
  transformOrigin: string;
  isFlipped: boolean;
}

export function DropdownMenu({
  items,
  triggerIcon = <MoreVertical className="h-4 w-4" />,
  triggerClassName = "p-1 text-gray-400 hover:text-gray-300 transition-colors rounded-md",
  menuClassName = "bg-gray-800 rounded-md shadow-lg py-1 min-w-[160px]",
  position = 'auto'
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    top: 0,
    left: 0,
    right: 0,
    maxHeight: 300,
    transformOrigin: 'top left',
    isFlipped: false
  });
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

  // Calculate smart dropdown position with full viewport awareness
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      
      // Menu dimensions (estimated)
      const menuWidth = 200;
      const itemHeight = 40; // Approximate height per item
      const menuPadding = 8; // py-1 = 8px total
      const estimatedMenuHeight = Math.min(items.length * itemHeight + menuPadding, 320);
      
      // Safe margins from viewport edges
      const safeMargin = 8;
      const mobileBreakpoint = 768;
      const isMobile = viewportWidth < mobileBreakpoint;
      
      // Calculate available space in all directions
      const spaceRight = viewportWidth - buttonRect.right - safeMargin;
      const spaceLeft = buttonRect.left - safeMargin;
      const spaceBelow = viewportHeight - buttonRect.bottom - safeMargin;
      const spaceAbove = buttonRect.top - safeMargin;
      
      // Determine horizontal position
      let finalHorizontalPos: 'left' | 'right' = position === 'auto' ? 'right' : position;
      
      if (position === 'auto') {
        if (isMobile) {
          // On mobile, prefer the side with more space
          finalHorizontalPos = spaceRight >= spaceLeft ? 'right' : 'left';
        } else {
          // On desktop, check if menu fits on the right
          finalHorizontalPos = spaceRight >= menuWidth ? 'right' : 'left';
        }
      }
      
      // Determine vertical position (above or below)
      const shouldFlipVertically = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
      
      // Calculate final position
      let top: number;
      let left: number;
      let right: number;
      let maxHeight: number;
      let transformOrigin: string;
      
      // Vertical positioning
      if (shouldFlipVertically) {
        // Position above the button
        top = buttonRect.top + scrollY - 4; // Small gap above button
        maxHeight = Math.min(spaceAbove - 4, 320);
        transformOrigin = finalHorizontalPos === 'right' ? 'bottom left' : 'bottom right';
      } else {
        // Position below the button
        top = buttonRect.bottom + scrollY + 4; // Small gap below button
        maxHeight = Math.min(spaceBelow - 4, 320);
        transformOrigin = finalHorizontalPos === 'right' ? 'top left' : 'top right';
      }
      
      // Horizontal positioning
      if (finalHorizontalPos === 'right') {
        left = buttonRect.left + scrollX;
        right = 0;
        
        // Ensure menu doesn't go off-screen on the right
        if (left + menuWidth > viewportWidth - safeMargin) {
          left = viewportWidth - menuWidth - safeMargin + scrollX;
        }
      } else {
        left = 0;
        right = viewportWidth - buttonRect.right - scrollX;
        
        // Ensure menu doesn't go off-screen on the left
        if (right + menuWidth > viewportWidth - safeMargin) {
          right = viewportWidth - menuWidth - safeMargin;
        }
      }
      
      // On mobile, ensure menu fits within safe bounds
      if (isMobile) {
        const mobileMenuWidth = Math.min(menuWidth, viewportWidth - (safeMargin * 2));
        
        if (finalHorizontalPos === 'right') {
          left = Math.max(safeMargin + scrollX, Math.min(left, viewportWidth - mobileMenuWidth - safeMargin + scrollX));
        } else {
          right = Math.max(safeMargin, Math.min(right, viewportWidth - mobileMenuWidth - safeMargin));
        }
      }
      
      setDropdownPosition(finalHorizontalPos);
      setMenuPosition({
        top,
        left,
        right,
        maxHeight,
        transformOrigin,
        isFlipped: shouldFlipVertically
      });
    }
  }, [isOpen, position, items.length]);

  // Handle scroll and resize events to reposition dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      // Trigger recalculation by toggling isOpen
      setIsOpen(false);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

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
            maxHeight: `${menuPosition.maxHeight}px`,
            transformOrigin: menuPosition.transformOrigin,
            ...(menuPosition.isFlipped ? { marginTop: '-4px' } : { marginTop: '0px' })
          }}
          className={`${menuClassName} overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent animate-in fade-in-0 zoom-in-95 duration-100`}
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