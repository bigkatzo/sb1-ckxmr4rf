import { useState, useEffect } from 'react';
import { Plus, Image as ImageIcon, EyeOff, Ban } from 'lucide-react';
import { CollectionForm } from '../../components/merchant/forms/CollectionForm';
import { createCollection, updateCollection, toggleFeatured, deleteCollection } from '../../services/collections';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { useCollectionOptimisticUpdate } from '../../hooks/useCollectionOptimisticUpdate';
import { EditButton } from '../../components/ui/EditButton';
import { StarButton } from '../../components/ui/StarButton';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { OptimizedImage } from '../../components/ui/OptimizedImage';
import type { Collection } from '../../types/collections';

export function CollectionsTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | undefined>();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMerchant, setIsMerchant] = useState(false);

  const { collections: initialCollections, loading: collectionsLoading, refetch: refreshCollections } = useMerchantCollections();
  const {
    collections,
    addCollection,
    updateCollection: updateCollectionInState,
    removeCollection,
    revertCollections,
    toggleFeaturedStatus
  } = useCollectionOptimisticUpdate(initialCollections);

  // Update collections when initialCollections changes
  useEffect(() => {
    revertCollections(initialCollections);
  }, [initialCollections, revertCollections]);

  useEffect(() => {
    async function checkUserRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.role === 'admin');
      setIsMerchant(profile?.role === 'merchant' || profile?.role === 'admin');
    }
    checkUserRole();
  }, []);

  const handleSubmit = async (data: FormData) => {
    try {
      if (editingCollection) {
        // Optimistically update the collection
        const optimisticCollection = {
          ...editingCollection,
          name: data.get('name') as string,
          description: data.get('description') as string,
          // Add other fields as needed
        };
        updateCollectionInState(editingCollection.id, optimisticCollection);

        const updatedCollection = await updateCollection(editingCollection.id, data);
        if (updatedCollection) {
          updateCollectionInState(editingCollection.id, updatedCollection);
          toast.success('Collection updated successfully');
        }
      } else {
        // Create a temporary ID for optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticCollection = {
          id: tempId,
          name: data.get('name') as string,
          description: data.get('description') as string || '',
          imageUrl: '',
          visible: true,
          featured: false,
          saleEnded: false,
          // Add other required fields
        } as Collection;
        addCollection(optimisticCollection);

        const newCollection = await createCollection(data);
        if (newCollection) {
          // Remove temp collection and add the real one
          removeCollection(tempId);
          addCollection(newCollection);
          toast.success('Collection created successfully');
        }
      }
      setShowForm(false);
      setEditingCollection(undefined);
    } catch (error) {
      console.error('Error with collection:', error);
      toast.error('Failed to save collection');
      // Revert to initial state on error
      revertCollections(initialCollections);
    }
  };

  const handleToggleFeatured = async (id: string, featured: boolean) => {
    // Optimistically update the featured status
    toggleFeaturedStatus(id, !featured);

    try {
      await toggleFeatured(id, !featured);
    } catch (error) {
      console.error('Error toggling featured status:', error);
      toast.error('Failed to update featured status');
      // Revert on error
      toggleFeaturedStatus(id, featured);
    }
  };

  const handleDelete = async (id: string) => {
    const originalCollections = [...collections];
    try {
      // Optimistically remove the collection
      removeCollection(id);

      await deleteCollection(id);
      setShowConfirmDialog(false);
      setDeletingId(null);
      toast.success('Collection deleted successfully');
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Failed to delete collection');
      // Revert on error
      revertCollections(originalCollections);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-semibold">Collections</h2>
          <RefreshButton onRefresh={refreshCollections} className="scale-90" />
        </div>
        {isMerchant && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>New Collection</span>
          </button>
        )}
      </div>

      {collectionsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg aspect-[16/10] animate-pulse" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-xl">
          <p className="text-gray-400">No collections available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {collections.map((collection) => {
            const canEdit = isAdmin || collection.isOwner || collection.accessType === 'edit';

            return (
              <div key={collection.id} className="group relative bg-gray-900 rounded-lg overflow-hidden">
                <div className="aspect-[16/10] relative">
                  {collection.imageUrl ? (
                    <OptimizedImage
                      src={collection.imageUrl}
                      alt={collection.name}
                      width={800}
                      height={500}
                      quality={80}
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-800 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-gray-600" />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                    {/* Status Tags */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                      {!collection.visible && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium shadow-lg">
                          <EyeOff className="h-2.5 w-2.5" />
                          Hidden
                        </span>
                      )}
                      {collection.saleEnded && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium shadow-lg">
                          <Ban className="h-2.5 w-2.5" />
                          Sale Ended
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white line-clamp-1">{collection.name}</h3>
                    {canEdit && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <StarButton
                            featured={collection.featured}
                            onClick={() => handleToggleFeatured(collection.id, collection.featured)}
                            className="scale-90"
                          />
                        )}
                        <EditButton 
                          onClick={() => {
                            setEditingCollection(collection);
                            setShowForm(true);
                          }}
                          className="scale-90"
                        />
                        <DeleteButton 
                          onClick={() => {
                            setDeletingId(collection.id);
                            setShowConfirmDialog(true);
                          }}
                          className="scale-90"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CollectionForm
          collection={editingCollection}
          onClose={() => {
            setShowForm(false);
            setEditingCollection(undefined);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {showConfirmDialog && deletingId && (
        <ConfirmDialog
          open={showConfirmDialog}
          onClose={() => {
            setShowConfirmDialog(false);
            setDeletingId(null);
          }}
          title="Delete Collection"
          description="Are you sure you want to delete this collection? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deletingId)}
        />
      )}
    </div>
  );
}