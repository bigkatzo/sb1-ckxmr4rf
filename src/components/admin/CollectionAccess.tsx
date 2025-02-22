import React, { useState, useEffect } from 'react';
import { Plus, Store, Unlink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Collection } from '../../types';
import { message } from 'antd';

interface CollectionAccessProps {
  userId: string;
}

interface CollectionAccessData {
  collection_id: string;
  access_type: 'view' | 'edit';
  collections: {
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
    launchDate: string;
    featured: boolean;
    visible: boolean;
    saleEnded: boolean;
    slug: string;
  };
}

export function CollectionAccess({ userId }: CollectionAccessProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedAccessType, setSelectedAccessType] = useState<'view' | 'edit'>('view');

  useEffect(() => {
    fetchCollections();
  }, [userId]);

  async function fetchCollections() {
    try {
      setLoading(true);
      setError(null);

      // Fetch all collections for the assign modal
      const { data: allCollectionsData, error: allCollectionsError } = await supabase
        .from('collections')
        .select('*')
        .order('name');
      if (allCollectionsError) throw allCollectionsError;
      setAllCollections(allCollectionsData);

      // Fetch user's collection access
      const { data: accessData, error: accessError } = await supabase
        .from('collection_access')
        .select(`
          collection_id,
          access_type,
          collections (
            id,
            name,
            description,
            imageUrl,
            launchDate,
            featured,
            visible,
            saleEnded,
            slug
          )
        `)
        .eq('user_id', userId);
      if (accessError) throw accessError;

      // Transform data to include collection details
      const collectionsWithAccess: Collection[] = ((accessData as unknown) as CollectionAccessData[]).map(access => ({
        id: access.collections.id,
        name: access.collections.name,
        description: access.collections.description,
        imageUrl: access.collections.imageUrl || '',
        launchDate: new Date(access.collections.launchDate),
        featured: access.collections.featured || false,
        visible: access.collections.visible || false,
        saleEnded: access.collections.saleEnded || false,
        slug: access.collections.slug || '',
        categories: [],
        products: [],
        accessType: access.access_type
      }));

      setCollections(collectionsWithAccess);
    } catch (err) {
      console.error('Error fetching collections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch collections');
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignCollection() {
    if (!selectedCollection || !selectedAccessType) return;

    try {
      const selectedCollectionName = allCollections.find(c => c.id === selectedCollection)?.name;
      const { error } = await supabase.rpc('grant_collection_access', {
        p_user_id: userId,
        p_collection_id: selectedCollection,
        p_access_type: selectedAccessType
      });

      if (error) throw error;

      message.success(`Successfully granted ${selectedAccessType} access to collection "${selectedCollectionName}"`);
      setShowAssignModal(false);
      setSelectedCollection('');
      setSelectedAccessType('view');
      await fetchCollections();
    } catch (err) {
      console.error('Error assigning collection:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign collection';
      message.error(errorMessage);
      setError(errorMessage);
    }
  }

  async function handleRevokeAccess(collectionId: string) {
    try {
      const collectionName = collections.find(c => c.id === collectionId)?.name;
      const { error } = await supabase.rpc('revoke_collection_access', {
        p_user_id: userId,
        p_collection_id: collectionId
      });

      if (error) throw error;

      message.success(`Successfully revoked access to collection "${collectionName}"`);
      await fetchCollections();
    } catch (err) {
      console.error('Error revoking access:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke access';
      message.error(errorMessage);
      setError(errorMessage);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 text-red-500 p-4 rounded-lg">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Collection Access</h3>
        <button
          onClick={() => setShowAssignModal(true)}
          className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-lg transition-colors text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Assign Collection</span>
        </button>
      </div>
      
      {collections.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-sm">No collections assigned.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((collection) => (
            <div key={collection.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-purple-400" />
                  <h4 className="font-medium">{collection.name}</h4>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    collection.accessType === 'edit' 
                      ? 'bg-purple-500/10 text-purple-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {collection.accessType === 'edit' ? 'Full Access' : 'View Only'}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => handleRevokeAccess(collection.id)}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Revoke access"
              >
                <Unlink className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Assign Collection Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <h3 className="text-lg font-semibold mb-4">Assign Collection</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Collection</label>
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Choose a collection</option>
                  {allCollections
                    .filter(c => !collections.some(ac => ac.id === c.id))
                    .map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Access Type</label>
                <select
                  value={selectedAccessType}
                  onChange={(e) => setSelectedAccessType(e.target.value as 'view' | 'edit')}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="view">View Only</option>
                  <option value="edit">Full Access</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignCollection}
                  disabled={!selectedCollection}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
                >
                  Assign Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}