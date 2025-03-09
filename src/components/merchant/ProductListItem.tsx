import { Image as ImageIcon } from 'lucide-react';
import { EditButton } from '../ui/EditButton';
import { DeleteButton } from '../ui/DeleteButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import type { Product } from '../../types';

interface ProductListItemProps {
  product: Product;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
}

export function ProductListItem({ product, onEdit, onDelete, onClick }: ProductListItemProps) {
  return (
    <div 
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 rounded-lg bg-gray-900 
        ${onClick ? 'cursor-pointer hover:bg-gray-800 transition-colors' : ''}
      `}
    >
      <div className="relative h-12 w-12 flex-shrink-0 rounded-md overflow-hidden bg-gray-800">
        {product.imageUrl ? (
          <OptimizedImage
            src={product.imageUrl}
            alt={product.name}
            width={96}
            height={96}
            quality={75}
            className="h-full w-full"
            sizes="48px"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-gray-600" />
          </div>
        )}
      </div>
      
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-white truncate">{product.name}</h3>
        <p className="text-xs text-gray-400 truncate">{product.description}</p>
      </div>
      
      <div className="text-right">
        <p className="text-sm font-medium text-white">{product.price} SOL</p>
        <p className="text-xs text-gray-400">{product.stock} left</p>
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <EditButton onClick={onEdit} className="scale-75 sm:scale-90" />
        )}
        {onDelete && (
          <DeleteButton onClick={onDelete} className="scale-75 sm:scale-90" />
        )}
      </div>
    </div>
  );
}