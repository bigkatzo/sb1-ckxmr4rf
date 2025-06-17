import { useState, useEffect } from 'react';
import { Plus, ExternalLink, EyeOff, Eye, Tag, Trash, Ban, Clock, UserCheck } from 'lucide-react';
import { VerificationBadge } from '../../components/ui/VerificationBadge';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';
import { useFilterPersistence } from '../../hooks/useFilterPersistence';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { CollectionForm } from '../../components/merchant/forms/CollectionForm';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from 'react-toastify';
import { createCollection, updateCollection, deleteCollection, toggleVisibility, toggleSaleEnded, toggleFeatured } from '../../services/collections';
import { InlineFilterBar } from '../../components/merchant/InlineFilterBar';
import { EditButton } from '../../components/ui/EditButton';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import { StarButton } from '../../components/ui/StarButton';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CollapsibleSearchBar } from '../../components/merchant/CollapsibleSearchBar';
import { ManageAccessModal } from '../../components/merchant/ManageAccessModal';

// Define the filter state type
interface CollectionFilterState {
  searchQuery: string;
}

// Initial filter state
const initialFilterState: CollectionFilterState = {
  searchQuery: ''
};

export function CollectionsTab() {
  const { setSelectedCollection, selectedCollection } = useMerchantDashboard();
  
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMerchant, setIsMerchant] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferCollection, setTransferCollection] = useState<any>(null);

  // Use the filter persistence hook
  const [filters, setFilters] = useFilterPersistence<CollectionFilterState>(
    'merchant_collections',
    'all', // Collections don't have a parent scope, so we use a fixed key
    initialFilterState
  );
  
  const { collections, loading, error, refetch, refreshing } = useMerchantCollections();

  // Helper functions for updating individual filter properties
  const updateSearchQuery = (query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  };
  
  // Filter collections based on current filter settings
  const filteredCollections = collections.filter(collection => {
    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      if (!collection.name.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    return true;
  });

  const handleSubmit = async (data: FormData) => {
    try {
      if (editingCollection) {
        await updateCollection(editingCollection.id, data);
        toast.success('Collection updated successfully');
      } else {
        await createCollection(data);
        toast.success('Collection created successfully');
      }
      setShowForm(false);
      setEditingCollection(null);
      refetch();
    } catch (error) {
      console.error('Error with collection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save collection';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCollection(id);
      refetch();
      toast.success('Collection deleted successfully');
    } catch (error) {
      console.error('Error deleting collection:', error);
      if (error instanceof Error) {
        if (error.message.includes('Cannot delete collection with existing products')) {
          toast.error('This collection has products. Please delete these products first.');
        } else {
          toast.error(`Failed to delete collection: ${error.message}`);
        }
      } else {
        toast.error('Failed to delete collection');
      }
    } finally {
      setShowConfirmDialog(false);
      setDeletingId(null);
    }
  };

  const handleToggleVisibility = async (id: string, visible: boolean) => {
    try {
      setActionLoading(id);
      await toggleVisibility(id, visible);
      toast.success(`Collection ${visible ? 'shown' : 'hidden'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to toggle visibility');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSaleEnded = async (id: string, saleEnded: boolean) => {
    try {
      setActionLoading(id);
      await toggleSaleEnded(id, saleEnded);
      toast.success(`Sale ${saleEnded ? 'ended' : 'resumed'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling sale status:', error);
      toast.error('Failed to toggle sale status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleFeatured = async (id: string, featured: boolean) => {
    try {
      setActionLoading(id);
      await toggleFeatured(id, featured);
      toast.success(`Collection ${featured ? 'featured' : 'unfeatured'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling featured status:', error);
      toast.error('Failed to toggle featured status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectCollection = (collectionId: string) => {
    // Toggle selection: If the same collection is clicked again, deselect it
    if (selectedCollection === collectionId) {
      setSelectedCollection(''); // Deselect
      toast.info(`Collection deselected`, { autoClose: 2000 });
    } else {
      setSelectedCollection(collectionId); // Select
      const collection = collections.find(c => c.id === collectionId);
      if (collection) {
        toast.info(`Selected collection "${collection.name}"`, { autoClose: 2000 });
      }
    }
  };

  const handleTransferOwnership = (collection: any) => {
    setTransferCollection(collection);
    setShowTransferModal(true);
  };

  const handleTransferComplete = () => {
    setTransferCollection(null);
    setShowTransferModal(false);
    refetch(); // Refresh the collections list
  };

  const handleCloseTransferModal = () => {
    setTransferCollection(null);
    setShowTransferModal(false);
  };

  // Check if user is admin or merchant
  useEffect(() => {
    const checkPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        setIsAdmin(profile?.role === 'admin');
        setIsMerchant(profile?.role === 'admin' || profile?.role === 'merchant');
      }
    };
    
    checkPermissions();
  }, []);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 animate-pulse space-y-4">
        <div className="h-10 bg-gray-800 rounded w-1/4" />
        <div className="h-40 bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-5">
        {/* Single row with all controls */}
        <div className="flex items-center gap-2">
          {/* Global Filter - Proper width on desktop, more flexible on mobile */}
          <div className="w-auto md:w-auto lg:w-auto min-w-0">
            <InlineFilterBar />
          </div>
          
          {/* Search - Take remaining width, but allow buttons to stay right-aligned */}
          <div className="flex-1 min-w-0 mr-auto">
            <CollapsibleSearchBar
              searchQuery={filters.searchQuery}
              onSearchChange={updateSearchQuery}
              placeholder="Search collections by name..."
            />
          </div>
          
          {/* Actions - Always pinned to the right */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <RefreshButton onRefresh={refetch} loading={refreshing} />
            
            {isMerchant && (
              <button
                onClick={() => {
                  setEditingCollection(null);
                  setShowForm(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white p-2 md:px-4 md:py-2 rounded-lg transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Add Collection</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-red-500/10 text-red-500 rounded-lg p-4">
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          {!isMerchant ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Clock className="h-10 w-10 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">Almost There!</h3>
              <p className="text-gray-400 max-w-md mb-4">
                Contact support to gain merchant access and unlock all features.
              </p>
              <div className="flex items-center gap-3">
                <a 
                  href="https://t.me/storedotfun" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-secondary hover:text-secondary-hover transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="h-4 w-4">
                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.287 5.906c-.778.324-2.334.994-4.666 2.01-.378.15-.577.298-.595.442-.03.243.275.339.69.47l.175.055c.408.133.958.288 1.243.294.26.006.549-.1.868-.32 2.179-1.471 3.304-2.214 3.374-2.23.05-.012.12-.026.166.016.047.041.042.12.037.141-.03.129-1.227 1.241-1.846 1.817-.193.18-.33.307-.358.336a8.154 8.154 0 0 1-.188.186c-.38.366-.664.64.015 1.088.327.216.589.393.85.571.284.194.568.387.936.629.093.06.183.125.27.187.331.236.63.448.997.414.214-.02.435-.22.547-.82.265-1.417.786-4.486.906-5.751a1.426 1.426 0 0 0-.013-.315.337.337 0 0 0-.114-.217.526.526 0 0 0-.31-.093c-.3.005-.763.166-2.984 1.09z"/>
                  </svg>
                  <span>t.me/storedotfun</span>
                </a>
                <a 
                  href="mailto:support@store.fun" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-secondary hover:text-secondary-hover transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="h-4 w-4">
                    <path d="M2 2a2 2 0 0 0-2 2v8.01A2 2 0 0 0 2 14h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2zm.5 3a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11zm0 3a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11zm0 3a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11z"/>
                  </svg>
                  <span>support@store.fun</span>
                </a>
              </div>
            </div>
          ) : collections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-gray-300 text-lg font-medium mb-2">Ready to Get Started!</p>
              <p className="text-gray-400 text-sm max-w-md mb-4">
                Create your first collection to begin selling products and managing orders.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
              >
                Create Collection
              </button>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No collections match the current filters.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCollections.map((collection) => (
            <div 
              key={collection.id}
              className={`group cursor-pointer rounded-lg transition-colors ${
                selectedCollection === collection.id 
                  ? 'bg-primary/10 border-2 border-primary' 
                  : 'bg-gray-900 hover:bg-gray-800 border-2 border-transparent'
              }`}
              onClick={() => handleSelectCollection(collection.id)}
            >
              <div className="relative overflow-hidden">
                {collection.imageUrl && (
                  <img 
                    src={collection.imageUrl} 
                    alt={collection.name} 
                    className="w-full h-32 sm:h-40 object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent opacity-70" />
                
                <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
                  {isAdmin && (
                    <StarButton
                      featured={collection.featured || false}
                      onClick={() => handleToggleFeatured(collection.id, !collection.featured)}
                      loading={actionLoading === collection.id}
                      className="scale-90"
                    />
                  )}
                </div>
                
                <div className="absolute top-2 right-2 flex flex-row items-center gap-1">
                  {!collection.visible && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800/80 text-gray-400">
                      <EyeOff className="h-3 w-3" />
                      Hidden
                    </span>
                  )}
                  {collection.saleEnded && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/60 text-red-200">
                      <Ban className="h-3 w-3" />
                      Sale Ended
                    </span>
                  )}
                </div>
              </div>
              
              <div className="p-2 sm:p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 sm:gap-2 overflow-hidden">
                    <h3 className="font-medium text-base sm:text-lg truncate">{collection.name}</h3>
                    {!collection.isOwner && collection.accessType && (
                      <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400 whitespace-nowrap flex-shrink-0">
                        {collection.accessType === 'edit' ? 'Edit' : 'View'}
                      </span>
                    )}
                  </div>
                  {selectedCollection === collection.id && (
                    <div className="flex items-center justify-center h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-gray-400 text-xs line-clamp-2 mt-0.5 sm:mt-1">{collection.description || 'No description'}</p>
                
                {/* Add owner information for admins */}
                {isAdmin && collection.owner_username && (
                  <div className="mt-1 sm:mt-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-green-400 bg-green-900/40 px-1.5 py-0.5 rounded">
                      Owner: {collection.owner_username}
                      {collection.ownerMerchantTier && (
                        <VerificationBadge 
                          tier={collection.ownerMerchantTier} 
                          className="text-xs" 
                          showTooltip={true}
                        />
                      )}
                    </span>
                  </div>
                )}
                
                <div className="mt-2 sm:mt-3 flex justify-between items-center">
                  <div className="flex gap-1 sm:gap-2 text-[10px] sm:text-xs text-gray-400">
                    <span>{collection.productCount || 0} products</span>
                    <span>•</span>
                    <span>{collection.categoryCount || 0} categories</span>
                  </div>
                  
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    {collection.isOwner && (
                      <>
                        <EditButton 
                          onClick={() => {
                            setEditingCollection(collection);
                            setShowForm(true);
                          }}
                          className="scale-90"
                          disabled={actionLoading === collection.id}
                        />
                        <DropdownMenu
                          items={[
                            {
                              label: collection.visible ? 'View Collection' : 'Preview Collection',
                              icon: <ExternalLink className="h-4 w-4" />,
                              as: Link,
                              to: `/${collection.slug || collection.id}${!collection.visible ? '?preview' : ''}`,
                              target: "_blank"
                            },
                            {
                              label: collection.visible ? 'Hide Collection' : 'Show Collection',
                              icon: collection.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
                              onClick: actionLoading !== collection.id ? 
                                () => handleToggleVisibility(collection.id, !collection.visible) : 
                                undefined
                            },
                            {
                              label: collection.saleEnded ? 'Resume Sale' : 'End Sale',
                              icon: collection.saleEnded ? <Ban className="h-4 w-4" /> : <Tag className="h-4 w-4" />,
                              onClick: actionLoading !== collection.id ? 
                                () => handleToggleSaleEnded(collection.id, !collection.saleEnded) : 
                                undefined
                            },
                            ...((isAdmin || collection.isOwner) ? [{
                              label: 'Manage Access',
                              icon: <UserCheck className="h-4 w-4" />,
                              onClick: actionLoading !== collection.id ? 
                                () => handleTransferOwnership(collection) : 
                                undefined
                            }] : []),
                            {
                              label: 'Delete',
                              icon: <Trash className="h-4 w-4" />,
                              onClick: actionLoading !== collection.id ? 
                                () => {
                                  setDeletingId(collection.id);
                                  setShowConfirmDialog(true);
                                } : 
                                undefined,
                              destructive: true
                            }
                          ]}
                          triggerClassName={`p-1 text-gray-400 hover:text-gray-300 transition-colors rounded-md scale-90 ${
                            actionLoading === collection.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          menuClassName="bg-gray-800 rounded-md shadow-lg py-1 min-w-[160px] shadow-xl z-[100]"
                          position="auto"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CollectionForm
          collection={editingCollection}
          onClose={() => {
            setShowForm(false);
            setEditingCollection(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

        <ConfirmDialog
          open={showConfirmDialog}
          onClose={() => {
            setShowConfirmDialog(false);
            setDeletingId(null);
          }}
          title="Delete Collection"
        description="Are you sure you want to delete this collection? This action cannot be undone. All products in this collection must be deleted first."
          confirmLabel="Delete"
        onConfirm={() => deletingId && handleDelete(deletingId)}
        />

      {showTransferModal && transferCollection && (
        <ManageAccessModal
          isOpen={showTransferModal}
          onClose={handleCloseTransferModal}
          collection={transferCollection}
          onAccessChange={handleTransferComplete}
        />
      )}
    </div>
  );
}