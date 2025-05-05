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
  };
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: (visible: boolean) => void;
  onToggleSaleEnded?: (saleEnded: boolean) => void;
}

export function CategoryListItem({
  category,
  index,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleSaleEnded
}: CategoryListItemProps) {
  // Generate dropdown menu items based on available actions
  const dropdownItems = [];
  
  if (onToggleVisibility) {
    dropdownItems.push({
      label: category.visible ? 'Hide Category' : 'Show Category',
      icon: category.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
      onClick: () => onToggleVisibility(!category.visible)
    });
  }
  
  if (onToggleSaleEnded) {
    dropdownItems.push({
      label: category.saleEnded ? 'Resume Sale' : 'End Sale',
      icon: <Tag className="h-4 w-4" />,
      onClick: () => onToggleSaleEnded(!category.saleEnded)
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

  const typeInfo = getCategoryTypeInfo(
    category.type, 
    category.eligibilityRules?.groups || []
  );

  return (
    <div className="bg-gray-900 rounded-lg p-2.5 sm:p-3 group">
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
          <CategoryDiamond 
            type={category.type}
            index={index}
            selected
            size="lg"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-xs sm:text-sm truncate">{category.name}</h3>
                {category.visible === false && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400">
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
              <p className="text-gray-400 text-[10px] sm:text-xs line-clamp-2 mt-1">
                {category.description}
              </p>
              <div className="mt-2">
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${typeInfo.style}`}>
                  {typeInfo.icon}
                  <span className="font-medium">{typeInfo.label}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && <EditButton onClick={onEdit} className="scale-75 sm:scale-90" />}
              {dropdownItems.length > 0 && (
                <DropdownMenu 
                  items={dropdownItems}
                  triggerClassName="p-1 text-gray-400 hover:text-gray-300 transition-colors rounded-md scale-75 sm:scale-90"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 