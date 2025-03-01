import React, { useState } from 'react';
import { Plus, Image as ImageIcon, Info } from 'lucide-react';
import { CollectionForm } from './forms/CollectionForm';
import { createCollection, updateCollection, toggleFeatured, toggleSaleEnded, deleteCollection } from '../../services/collections';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { EditButton } from '../ui/EditButton';
import { StarButton } from '../ui/StarButton';
import { DeleteButton } from '../ui/DeleteButton';
import { Toggle } from '../ui/Toggle';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RefreshButton } from '../ui/RefreshButton';
import { Tooltip } from '../ui/Tooltip';
import { toast } from 'react-toastify';
import { Spinner } from '../ui/Spinner';
import { useAuth } from '../../hooks/useAuth';

export function CollectionsTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const { 
    collections, 
    loading: collectionsLoading, 
    refreshCollections,
    updateCollectionAccess,
    changingAccessId
  } = useMerchantCollections();

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
      refreshCollections();
    } catch (error) {
      console.error('Error with collection:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save collection');
    }
  };

  const handleToggleFeatured = async (id: string, featured: boolean) => {
    try {
      setTogglingIds(prev => new Set([...prev, id]));
      await toggleFeatured(id, !featured);
      await refreshCollections();
      toast.success(featured ? 'Collection unfeatured' : 'Collection featured');
    } catch (error) {
      console.error('Error toggling featured status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update featured status');
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleSaleEnded = async (id: string, saleEnded: boolean) => {
    try {
      setTogglingIds(prev => new Set([...prev, id]));
      await toggleSaleEnded(id, !saleEnded);
      await refreshCollections();
      toast.success(saleEnded ? 'Sale restarted' : 'Sale ended');
    } catch (error) {
      console.error('Error toggling sale ended status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update sale status');
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await deleteCollection(id);
      setShowConfirmDialog(false);
      refreshCollections();
      toast.success('Collection deleted successfully');
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete collection');
    } finally {
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
            <RefreshButton onRefresh={refreshCollections} />
          </div>
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
        </div>
      </div>

      {collections.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-sm">No collections created yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="bg-gray-900 rounded-lg overflow-hidden flex flex-col"
            >
              <div className="relative aspect-video bg-gray-800">
                {collection.imageUrl ? (
                  <img
                    src={collection.imageUrl}
                    alt={collection.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-gray-700" />
                  </div>
                )}
                {collection.isOwner && (
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <StarButton
                      featured={collection.featured}
                      onClick={() => handleToggleFeatured(collection.id, collection.featured)}
                      loading={togglingIds.has(collection.id)}
                    />
                    <EditButton
                      onClick={() => {
                        setEditingCollection(collection);
                        setShowForm(true);
                      }}
                    />
                    <DeleteButton
                      onClick={() => {
                        setDeletingId(collection.id);
                        setShowConfirmDialog(true);
                      }}
                      loading={deletingId === collection.id}
                    />
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-lg leading-tight">{collection.name}</h3>
                  {collection.accessType && (
                    <Tooltip content={`You have ${collection.accessType} access to this collection`}>
                      <div className="flex-shrink-0">
                        <Info className="h-4 w-4 text-gray-400" />
                      </div>
                    </Tooltip>
                  )}
                </div>
                <p className="text-gray-400 text-sm mb-4 flex-1">
                  {collection.description || 'No description provided.'}
                </p>
                {collection.isOwner && (
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={collection.visible}
                        onCheckedChange={(checked) => {
                          updateCollection(collection.id, { visible: checked });
                        }}
                        size="sm"
                        label="Visible"
                      />
                      <Toggle
                        checked={collection.sale_ended}
                        onCheckedChange={() => handleToggleSaleEnded(collection.id, collection.sale_ended)}
                        size="sm"
                        label="Sale Ended"
                        loading={togglingIds.has(collection.id)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CollectionForm
          collection={editingCollection}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingCollection(null);
          }}
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
              refreshCollections();
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