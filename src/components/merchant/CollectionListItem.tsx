import { Image as ImageIcon, EyeOff, Ban, Trash, Eye, Tag, ExternalLink } from 'lucide-react';
import { EditButton } from '../ui/EditButton';
import { StarButton } from '../ui/StarButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import { DropdownMenu } from '../ui/DropdownMenu';
import { Link } from 'react-router-dom';

interface CollectionListItemProps {
  collection: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    launchDate: string | Date;
    visible: boolean;
    saleEnded: boolean;
    featured?: boolean;
    isOwner?: boolean;
    accessType?: string | null;
    owner_username?: string | null;
    slug?: string;
  };
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: (visible: boolean) => void;
  onToggleSaleEnded?: (saleEnded: boolean) => void;
  onToggleFeatured?: (featured: boolean) => void;
  canEdit?: boolean;
}

export function CollectionListItem({
  collection,
  isAdmin = false,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleSaleEnded,
  onToggleFeatured,
  canEdit = false
}: CollectionListItemProps) {
  // Only show actions if user has edit permission
  const showActions = canEdit || isAdmin;
  
  // Generate dropdown menu items based on available actions
  const dropdownItems = [];
  
  // Add View Collection as the first option
  if (collection.slug) {
    dropdownItems.push({
      label: 'View Collection',
      icon: <ExternalLink className="h-4 w-4" />,
      as: Link,
      to: `/${collection.slug}`,
      target: "_blank"
    });
  }
  
  if (canEdit && onToggleVisibility) {
    dropdownItems.push({
      label: collection.visible ? 'Hide Collection' : 'Show Collection',
      icon: collection.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
      onClick: () => onToggleVisibility(collection.visible)
    });
  }
  
  if (canEdit && onToggleSaleEnded) {
    dropdownItems.push({
      label: collection.saleEnded ? 'Resume Sale' : 'End Sale',
      icon: <Tag className="h-4 w-4" />,
      onClick: () => onToggleSaleEnded(collection.saleEnded)
    });
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
    <div className="bg-gray-900 rounded-lg p-3 group">
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
          {collection.imageUrl ? (
            <OptimizedImage
              src={collection.imageUrl}
              alt={collection.name}
              width={160}
              height={160}
              quality={75}
              className="object-cover w-full h-full"
              sizes="80px"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-gray-600" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">{collection.name}</h3>
                <div className="flex items-center gap-1">
                  {collection.visible === false && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400">
                      <EyeOff className="h-3 w-3" />
                      Hidden
                    </span>
                  )}
                  {collection.saleEnded && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 whitespace-nowrap">
                      <Ban className="h-3 w-3" />
                      Sale Ended
                    </span>
                  )}
                </div>
              </div>
              <p className="text-gray-400 text-xs line-clamp-2 mt-1">
                {collection.description}
              </p>
              <p className="text-white text-xs mt-2">
                Launches {new Date(collection.launchDate).toLocaleDateString()}
              </p>
              <div className="mt-1 flex items-center gap-2">
                {isAdmin ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-green-500/10 text-green-400">
                    Owner: {collection.owner_username}
                  </span>
                ) : (
                  <>
                    {collection.isOwner ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-primary/20 text-primary">
                        Owner
                      </span>
                    ) : (
                      <>
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium ${
                          collection.accessType === 'edit' 
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {collection.accessType === 'edit' ? 'Full Access' : 'View Only'}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            {showActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isAdmin && onToggleFeatured && (
                  <StarButton
                    featured={collection.featured || false}
                    onClick={() => onToggleFeatured(collection.featured || false)}
                    className="scale-90"
                  />
                )}
                {canEdit && onEdit && <EditButton onClick={onEdit} className="scale-90" />}
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