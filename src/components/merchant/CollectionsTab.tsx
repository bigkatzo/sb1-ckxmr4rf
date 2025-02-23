import React, { useState } from 'react';
import { Plus, Image as ImageIcon } from 'lucide-react';
import { CollectionForm } from './forms/CollectionForm';
import { createCollection, updateCollection, toggleFeatured, toggleSaleEnded, deleteCollection } from '../../services/collections';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { EditButton } from '../ui/EditButton';
import { StarButton } from '../ui/StarButton';
import { DeleteButton } from '../ui/DeleteButton';
import { Toggle } from '../ui/Toggle';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RefreshButton } from '../ui/RefreshButton';
import { toast } from 'react-toastify';

export function CollectionsTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const { collections, loading: collectionsLoading, refreshCollections } = useMerchantCollections();

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
      await toggleFeatured(id, !featured);
      await refreshCollections();
      toast.success(featured ? 'Collection unfeatured' : 'Collection featured');
    } catch (error) {
      console.error('Error toggling featured status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update featured status');
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

  if (collectionsLoading) {
    return (
      <div className="px-3 sm:px-6 lg:px-8 animate-pulse space-y-4">
        <div className="h-10 bg-gray-800 rounded w-1/4" />
        <div className="h-40 bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold">Collections</h2>
            <RefreshButton onRefresh={refreshCollections} className="scale-90" />
          </div>
          <button
            onClick={() => {
              setEditingCollection(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg transition-colors text-xs sm:text-sm"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Add Collection</span>
          </button>
        </div>
      </div>

      {collections.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-xs sm:text-sm">No collections created yet.</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {collections.map((collection) => (
            <div key={collection.id} className="bg-gray-900 rounded-lg p-2.5 sm:p-3 group">
              <div className="flex items-start gap-2 sm:gap-3">
                {collection.imageUrl ? (
                  <img
                    src={collection.imageUrl}
                    alt={collection.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-xs sm:text-sm truncate">{collection.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          !collection.accessType ? 'bg-purple-500/10 text-purple-500' :
                          collection.accessType === 'edit' ? 'bg-green-500/10 text-green-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {!collection.accessType ? 'Owner' :
                           collection.accessType === 'edit' ? 'Edit' : 'View'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-[10px] sm:text-xs line-clamp-2 mt-1">
                        {collection.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {(collection.accessType === 'edit' || !collection.accessType) && (
                          <Toggle
                            checked={collection.saleEnded}
                            onChange={() => handleToggleSaleEnded(collection.id, collection.saleEnded)}
                            loading={togglingIds.has(collection.id)}
                            className="scale-75 sm:scale-90"
                          >
                            {collection.saleEnded ? 'Sale Ended' : 'Sale Active'}
                          </Toggle>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(collection.accessType === 'edit' || !collection.accessType) && (
                        <>
                          <StarButton
                            active={collection.featured}
                            onClick={() => handleToggleFeatured(collection.id, collection.featured)}
                            className="scale-75 sm:scale-90"
                          />
                          <EditButton
                            onClick={() => {
                              setEditingCollection(collection);
                              setShowForm(true);
                            }}
                            className="scale-75 sm:scale-90"
                          />
                        </>
                      )}
                      {!collection.accessType && (
                        <DeleteButton
                          onClick={() => {
                            setDeletingId(collection.id);
                            setShowConfirmDialog(true);
                          }}
                          className="scale-75 sm:scale-90"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CollectionForm
          initialData={editingCollection}
          onClose={() => {
            setShowForm(false);
            setEditingCollection(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {showConfirmDialog && deletingId && (
        <ConfirmDialog
          title="Delete Collection"
          message="Are you sure you want to delete this collection? All products and categories in this collection will also be deleted. This action cannot be undone."
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
          onCancel={() => {
            setShowConfirmDialog(false);
            setDeletingId(null);
          }}
        />
      )}
    </div>
  );
}