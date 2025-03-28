import { useState, useEffect } from 'react';
import { Plus, Image as ImageIcon, EyeOff, Ban } from 'lucide-react';
import { CollectionForm } from '../../components/merchant/forms/CollectionForm';
import { createCollection, updateCollection, toggleFeatured, deleteCollection } from '../../services/collections';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { EditButton } from '../../components/ui/EditButton';
import { StarButton } from '../../components/ui/StarButton';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { OptimizedImage } from '../../components/ui/OptimizedImage';

export function CollectionsTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMerchant, setIsMerchant] = useState(false);

  const { collections, loading: collectionsLoading, refetch } = useMerchantCollections();

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
      toast.error('Failed to save collection');
    }
  };

  const handleToggleFeatured = async (id: string, featured: boolean) => {
    try {
      await toggleFeatured(id, !featured);
      toast.success(`Collection ${!featured ? 'featured' : 'unfeatured'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling featured status:', error);
      toast.error('Failed to toggle featured status');
    }
  };

  if (collectionsLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 animate-pulse space-y-4">
        <div className="h-10 bg-gray-800 rounded w-1/4" />
        <div className="h-40 bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Collections</h2>
            <RefreshButton onRefresh={refetch} />
          </div>
          {isMerchant && (
            <button
              onClick={() => {
                setEditingCollection(null);
                setShowForm(true);
              }}
              className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Collection</span>
            </button>
          )}
        </div>
      </div>

      {collections.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-sm">No collections created yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((collection) => {
            const canEdit = isAdmin || collection.isOwner || collection.accessType === 'edit';
            
            return (
              <div key={collection.id} className="bg-gray-900 rounded-lg p-3 group">
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
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400">
                                <Ban className="h-3 w-3" />
                                Sale Ended
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs line-clamp-2 mt-1">
                          {collection.description}
                        </p>
                        <p className="text-purple-400 text-xs mt-2">
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
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-purple-500/20 text-purple-400">
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
            setEditingCollection(null);
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
          description="Are you sure you want to delete this collection? All products and categories in this collection will also be deleted. This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={async () => {
            try {
              await deleteCollection(deletingId);
              refetch();
              toast.success('Collection deleted successfully');
            } catch (error) {
              console.error('Error deleting collection:', error);
              toast.error('Failed to delete collection');
            } finally {
              setShowConfirmDialog(false);
              setDeletingId(null);
            }
          }}
        />
      )}
    </div>
  );
}