import { Image as ImageIcon, EyeOff, Ban, Copy, Trash, Eye, Tag, ExternalLink, Pin } from 'lucide-react';
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
  onPin?: (pinOrder: number | null) => void;
  onClick?: () => void;
  categoryIndex?: number;
  canEdit?: boolean;
}

export function ProductListItem({ 
  product, 
  onEdit, 
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onToggleSaleEnded,
  onPin,
  onClick,
  categoryIndex = 0,
  canEdit = false
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

  // Only show actions if user has edit permission
  const showActions = canEdit && (onEdit || onDelete || onDuplicate || onToggleVisibility || onToggleSaleEnded);

  // Generate dropdown menu items based on available actions
  const dropdownItems = [];
  
  // Add View Product as the first option if we have the slug
  if (product.slug && product.collectionSlug) {
    dropdownItems.push({
      label: 'View Product',
      icon: <ExternalLink className="h-4 w-4" />,
      as: Link,
      to: `/${product.collectionSlug}/${product.slug}`,
      target: "_blank"
    });
  }
  
  if (canEdit && onDuplicate) {
    dropdownItems.push({
      label: 'Duplicate',
      icon: <Copy className="h-4 w-4" />,
      onClick: onDuplicate
    });
  }
  
  if (canEdit && onToggleVisibility) {
    dropdownItems.push({
      label: product.visible ? 'Hide Product' : 'Show Product',
      icon: product.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
      onClick: () => onToggleVisibility(!product.visible)
    });
  }
  
  if (canEdit && onToggleSaleEnded && !product.categorySaleEnded && !product.collectionSaleEnded) {
    dropdownItems.push({
      label: product.saleEnded ? 'Resume Sale' : 'End Sale',
      icon: <Tag className="h-4 w-4" />,
      onClick: () => onToggleSaleEnded(!product.saleEnded)
    });
  }
  
  // Add pin/unpin options
  if (canEdit && onPin) {
    // If product is already pinned, show option to unpin
    if (product.pinOrder) {
      dropdownItems.push({
        label: 'Unpin Product',
        icon: <Pin className="h-4 w-4" />,
        onClick: () => onPin(null)
      });
    } else {
      // Add a single pin option - the backend will handle assigning the next available position
      dropdownItems.push({
        label: 'Pin Product',
        icon: <Pin className="h-4 w-4" />,
        onClick: () => onPin(0) // 0 is a special value that tells the backend to assign the next available position
      });
    }
  }
  
  if (canEdit && onDelete) {
    dropdownItems.push({
      label: 'Delete',
      icon: <Trash className="h-4 w-4" />,
      onClick: onDelete,
      destructive: true
    });
  }

  return (
    <div 
      className={`bg-gray-900 hover:bg-gray-800 rounded-lg overflow-hidden group transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex overflow-hidden p-3">
        <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-gray-800 rounded-md overflow-hidden mr-3">
          {product.imageUrl ? (
            <OptimizedImage
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
              sizes="80px"
            />
          ) : (
            <div className="flex items-center justify-center h-full w-full bg-gray-800 text-gray-600">
              <ImageIcon className="h-6 w-6" />
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
                {product.pinOrder && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-secondary/10 text-secondary-light">
                    <Pin className="h-3 w-3" />
                    <span className="font-bold">#{product.pinOrder}</span>
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
            
            {showActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                {canEdit && onEdit && <EditButton onClick={() => onEdit()} className="scale-90" />}
                {dropdownItems.length > 0 && (
                  <DropdownMenu 
                    items={dropdownItems}
                    triggerClassName="p-1 text-gray-400 hover:text-gray-300 transition-colors rounded-md scale-90"
                    menuClassName="bg-gray-800 rounded-md shadow-lg py-1 min-w-[160px] shadow-xl z-[100]"
                    position="auto"
                  />
                )}
              </div>
            )}
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