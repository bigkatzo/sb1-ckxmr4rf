import { Image as ImageIcon } from 'lucide-react';
import { EditButton } from '../ui/EditButton';
import { DeleteButton } from '../ui/DeleteButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import { useOrderStats } from '../../hooks/useOrderStats';
import { getCategoryColorSet } from '../../utils/category-colors';
import type { Product } from '../../types';

interface ProductListItemProps {
  product: Product;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  categoryIndex?: number;
}

export function ProductListItem({ 
  product, 
  onEdit, 
  onDelete, 
  onClick,
  categoryIndex = 0 
}: ProductListItemProps) {
  const { currentOrders, loading } = useOrderStats(product.id);

  const handleEditClick = () => {
    onEdit?.();
  };

  const handleDeleteClick = () => {
    onDelete?.();
  };

  const getStockDisplay = () => {
    if (loading) return "Loading...";
    if (product.stock === null) return 'Unlimited';
    const remaining = product.stock - currentOrders;
    if (remaining <= 0) return `0/${product.stock} (Sold out)`;
    return `${remaining}/${product.stock}`;
  };

  return (
    <div 
      onClick={onClick}
      className={`
        bg-gray-900 rounded-lg group
        ${onClick ? 'cursor-pointer hover:bg-gray-800 transition-colors' : ''}
      `}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
          {product.imageUrl ? (
            <OptimizedImage
              src={product.imageUrl}
              alt={product.name}
              width={160}
              height={160}
              quality={75}
              className="object-cover w-full h-full"
              sizes="80px"
              priority
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-gray-600" />
            </div>
          )}
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-white truncate">{product.name}</h3>
              
              <div className="flex items-center gap-2 mt-1">
                {product.category && (
                  <span className={`
                    inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                    ${getCategoryColorSet(categoryIndex).bg}
                    ${getCategoryColorSet(categoryIndex).base}
                  `}>
                    {product.category.name}
                  </span>
                )}
              </div>

              {product.sku && (
                <p className="text-xs text-gray-500 mt-2">SKU: {product.sku}</p>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {onEdit && <EditButton onClick={handleEditClick} />}
              {onDelete && <DeleteButton onClick={handleDeleteClick} />}
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{product.price} SOL</span>
              <span className={`text-xs ${loading ? 'text-gray-500' : 'text-gray-400'}`}>
                Stock available: {getStockDisplay()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}