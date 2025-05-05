import { Image as ImageIcon, EyeOff, Ban, Copy, Trash, Eye, Tag, ExternalLink } from 'lucide-react';
import { EditButton } from '../ui/EditButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import { useOrderStats } from '../../hooks/useOrderStats';
import { getCategoryColorSet } from '../../utils/category-colors';
import { DropdownMenu } from '../ui/DropdownMenu';
import { Link } from 'react-router-dom';
import type { Product } from '../../types/variants';

interface ProductListItemProps {
  product: Product;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleVisibility?: (visible: boolean) => void;
  onToggleSaleEnded?: (saleEnded: boolean) => void;
  onClick?: () => void;
  categoryIndex?: number;
}

export function ProductListItem({ 
  product, 
  onEdit, 
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onToggleSaleEnded,
  onClick,
  categoryIndex = 0 
}: ProductListItemProps) {
  const { currentOrders, loading } = useOrderStats(product.id);
  
  // Check if sale has ended at any level
  const isSaleEnded = product.saleEnded || product.categorySaleEnded || product.collectionSaleEnded;

  const getStockDisplay = () => {
    if (loading) return "Loading...";
    if (product.stock === null) return 'Unlimited';
    const remaining = product.stock - currentOrders;
    if (remaining <= 0) return `0/${product.stock} (Sold out)`;
    return `${remaining}/${product.stock}`;
  };

  // Generate dropdown menu items based on available actions
  const dropdownItems = [];
  
  // Add View Product as the first option if we have the slug
  if (product.slug && product.collectionSlug) {
    dropdownItems.push({
      label: 'View Product',
      icon: <ExternalLink className="h-4 w-4" />,
      as: Link,
      to: `/${product.collectionSlug}/${product.slug}`
    });
  }
  
  if (onDuplicate) {
    dropdownItems.push({
      label: 'Duplicate',
      icon: <Copy className="h-4 w-4" />,
      onClick: onDuplicate
    });
  }
  
  if (onToggleVisibility) {
    dropdownItems.push({
      label: product.visible ? 'Hide Product' : 'Show Product',
      icon: product.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
      onClick: () => onToggleVisibility(product.visible || false)
    });
  }
  
  if (onToggleSaleEnded && !product.categorySaleEnded && !product.collectionSaleEnded) {
    dropdownItems.push({
      label: product.saleEnded ? 'Resume Sale' : 'End Sale',
      icon: <Tag className="h-4 w-4" />,
      onClick: () => onToggleSaleEnded(product.saleEnded || false)
    });
  }
  
  if (onDelete) {
    dropdownItems.push({
      label: 'Delete',
      icon: <Trash className="h-4 w-4" />,
      onClick: onDelete,
      destructive: true
    });
  }

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
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-white truncate">{product.name}</h3>
                {product.visible === false && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400">
                    <EyeOff className="h-3 w-3" />
                    Hidden
                  </span>
                )}
                {isSaleEnded && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 whitespace-nowrap">
                    <Ban className="h-3 w-3" />
                    Sale Ended
                  </span>
                )}
              </div>
              
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
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && <EditButton onClick={() => onEdit()} className="scale-90" />}
              {dropdownItems.length > 0 && (
                <DropdownMenu 
                  items={dropdownItems}
                  triggerClassName="p-1 text-gray-400 hover:text-gray-300 transition-colors rounded-md scale-90"
                />
              )}
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