import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

interface CartButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CartButton({ className = '', size = 'md' }: CartButtonProps) {
  const { toggleCart, count } = useCart();
  
  const sizeClasses = {
    sm: 'h-4.5 w-4.5',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };
  
  const badgeClasses = {
    sm: 'min-w-[16px] h-4 text-[9px] -top-1 -right-1',
    md: 'min-w-[18px] h-[18px] text-[10px] -top-1.5 -right-1.5',
    lg: 'min-w-[20px] h-5 text-[11px] -top-2 -right-2'
  };

  return (
    <button
      onClick={toggleCart}
      className={`relative p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors ${className}`}
      aria-label="Open cart"
    >
      <ShoppingCart className={sizeClasses[size]} />
      {count > 0 && (
        <span className={`absolute ${badgeClasses[size]} flex items-center justify-center rounded-full bg-secondary text-white font-bold px-1`}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
} 