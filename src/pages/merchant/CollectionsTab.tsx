import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { CollectionForm } from '../../components/merchant/forms/CollectionForm';
import { CollectionListItem } from '../../components/merchant/CollectionListItem';
import { 
  createCollection, 
  updateCollection, 
  toggleFeatured, 
  deleteCollection,
  toggleVisibility,
  toggleSaleEnded
} from '../../services/collections';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';

export function CollectionsTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMerchant, setIsMerchant] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { collections, loading: collectionsLoading, refreshing, refetch } = useMerchantCollections();

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
      setActionLoading(id);
      await toggleFeatured(id, !featured);
      toast.success(`Collection ${!featured ? 'featured' : 'unfeatured'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling featured status:', error);
      toast.error('Failed to toggle featured status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleVisibility = async (id: string, visible: boolean) => {
    try {
      setActionLoading(id);
      await toggleVisibility(id, !visible);
      toast.success(`Collection ${!visible ? 'shown' : 'hidden'} successfully`);
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
      await toggleSaleEnded(id, !saleEnded);
      toast.success(`Sale ${!saleEnded ? 'ended' : 'resumed'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling sale status:', error);
      toast.error('Failed to toggle sale status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCollection(id);
      refetch();
      toast.success('Collection deleted successfully');
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Failed to delete collection');
    } finally {
      setShowConfirmDialog(false);
      setDeletingId(null);
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
            <RefreshButton onRefresh={refetch} loading={refreshing} />
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
            const isActionDisabled = actionLoading === collection.id;
            
            // Map collection data to format expected by CollectionListItem component
            const collectionProps = {
              id: collection.id,
              name: collection.name,
              description: collection.description,
              imageUrl: collection.imageUrl,
              launchDate: collection.launchDate,
              visible: collection.visible,
              saleEnded: collection.saleEnded,
              featured: collection.featured,
              isOwner: collection.isOwner,
              accessType: collection.accessType,
              owner_username: collection.owner_username,
              slug: collection.slug
            };
            
            return (
              <CollectionListItem
                key={collection.id}
                collection={collectionProps}
                isAdmin={isAdmin}
                onEdit={canEdit ? () => {
                  setEditingCollection(collection);
                  setShowForm(true);
                } : undefined}
                onDelete={canEdit && !isActionDisabled ? () => {
                  setDeletingId(collection.id);
                  setShowConfirmDialog(true);
                } : undefined}
                onToggleVisibility={canEdit && !isActionDisabled ? 
                  (visible) => handleToggleVisibility(collection.id, visible) : undefined}
                onToggleSaleEnded={canEdit && !isActionDisabled ? 
                  (saleEnded) => handleToggleSaleEnded(collection.id, saleEnded) : undefined}
                onToggleFeatured={isAdmin && !isActionDisabled ? 
                  (featured) => handleToggleFeatured(collection.id, featured) : undefined}
              />
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
          onConfirm={() => handleDelete(deletingId)}
        />
      )}
    </div>
  );
}