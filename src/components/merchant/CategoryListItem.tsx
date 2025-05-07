import { EyeOff, Ban, Trash, Eye, Tag } from 'lucide-react';
import { EditButton } from '../ui/EditButton';
import { DropdownMenu } from '../ui/DropdownMenu';
import { CategoryDiamond } from '../collections/CategoryDiamond';
import { getCategoryTypeInfo } from '../collections/CategoryTypeInfo';

interface CategoryListItemProps {
  category: {
    id: string;
    name: string;
    description?: string;
    type: string;
    visible: boolean;
    saleEnded: boolean;
    eligibilityRules?: {
      groups: any[];
    };
    productCount?: number;
  };
  index: number;
  selected?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: (visible: boolean) => void;
  onToggleSaleEnded?: (saleEnded: boolean) => void;
  canEdit?: boolean;
}

export function CategoryListItem({
  category,
  index,
  selected = false,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleSaleEnded,
  canEdit = false
}: CategoryListItemProps) {
  // Only show actions if user has edit permission
  const showActions = canEdit && (onEdit || onDelete || onToggleVisibility || onToggleSaleEnded);
  
  // Generate dropdown menu items based on available actions
  const dropdownItems = [];
  
  if (canEdit && onToggleVisibility) {
    dropdownItems.push({
      label: category.visible ? 'Hide Category' : 'Show Category',
      icon: category.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
      onClick: () => {
        onToggleVisibility(!category.visible);
      }
    });
  }
  
  if (canEdit && onToggleSaleEnded) {
    dropdownItems.push({
      label: category.saleEnded ? 'Resume Sale' : 'End Sale',
      icon: <Tag className="h-4 w-4" />,
      onClick: () => {
        onToggleSaleEnded(!category.saleEnded);
      }
    });
  }
  
  if (canEdit && onDelete) {
    dropdownItems.push({
      label: 'Delete',
      icon: <Trash className="h-4 w-4" />,
      onClick: () => {
        onDelete();
      },
      destructive: true
    });
  }

  // Get type information for styling and badge display
  const typeInfo = getCategoryTypeInfo(
    category.type, 
    category.eligibilityRules?.groups || []
  );

  return (
    <div className={`bg-gray-900 hover:bg-gray-800 transition-colors rounded-lg overflow-hidden`}>
      <div className="flex items-center p-3">
        <div className="flex-shrink-0 mr-4">
          <CategoryDiamond 
            type={category.type}
            index={index}
            selected={selected}
            size="md"
            className={selected ? "ring-2 ring-primary" : ""}
          />
        </div>
        
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">{category.name}</h3>
                <div className="flex items-center gap-1">
                {category.visible === false && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400 whitespace-nowrap">
                    <EyeOff className="h-3 w-3" />
                    Hidden
                  </span>
                )}
                {category.saleEnded && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 whitespace-nowrap">
                    <Ban className="h-3 w-3" />
                    Sale Ended
                  </span>
                )}
              </div>
              </div>
              <p className="text-gray-400 text-xs line-clamp-2 mt-1">
                {category.description || 'No description'}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {category.productCount || 0} products
                </p>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${typeInfo.style}`}>
                  {typeInfo.icon}
                  <span className="font-medium">{typeInfo.label}</span>
                </div>
              </div>
            </div>
            {showActions && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {canEdit && onEdit && (
                  <EditButton 
                    onClick={() => onEdit()} 
                    className="scale-90" 
                  />
                )}
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
        </div>
      </div>
    </div>
  );
} 