import { useState, useEffect } from 'react';
import { Plus, Store, Unlink, Crown, AlertTriangle, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Collection as BaseCollection } from '../../types';
import { toast } from 'react-toastify';
import { VerificationBadge } from '../ui/VerificationBadge';
import { ManageAccessModal } from '../merchant/ManageAccessModal';

interface CollectionAccessProps {
  userId: string;
}

interface CollectionAccessData {
  collection_id: string;
  access_type: 'view' | 'edit' | 'collaborator' | null;
  collections: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    launch_date: string;
    featured: boolean;
    visible: boolean;
    sale_ended: boolean;
    slug: string;
    user_id: string;
  };
}

interface Collection extends BaseCollection {
  accessType: 'view' | 'edit' | 'collaborator' | null;
  isOwner?: boolean;
  owner_username?: string;
  ownerMerchantTier?: string;
}

interface UserForTransfer {
  id: string;
  username: string;
  email: string;
  role: string;
  merchant_tier: string;
  display_name: string;
}

export function CollectionAccess({ userId }: CollectionAccessProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedAccessType, setSelectedAccessType] = useState<'view' | 'edit' | 'collaborator' | 'owner'>('view');
  
  // State for ManageAccessModal
  const [showManageAccessModal, setShowManageAccessModal] = useState(false);
  const [selectedCollectionForManagement, setSelectedCollectionForManagement] = useState<any>(null);

  useEffect(() => {
    fetchCollections();
  }, [userId]);

  async function fetchCollections() {
    try {
      setLoading(true);
      setError(null);

      // Get collections this user has access to (either owned or granted access)
      const { data: collections, error: collectionsError } = await supabase
        .from('collection_access')
        .select(`
          collection_id,
          access_type,
          collections:collection_id (
            id,
            name,
            description,
            image_url,
            launch_date,
            featured,
            visible,
            sale_ended,
            slug,
            user_id
          )
        `)
        .eq('user_id', userId) as { data: CollectionAccessData[] | null, error: any };
      if (collectionsError) throw collectionsError;

      // Also get collections owned by this user
      const { data: ownedCollections, error: ownedError } = await supabase
        .from('merchant_collections')
        .select('*')
        .eq('user_id', userId);
      if (ownedError) throw ownedError;

      // Transform collections data
      const accessCollections = (collections || []).map((collection: CollectionAccessData) => ({
        id: collection.collections.id,
        name: collection.collections.name,
        description: collection.collections.description || '',
        imageUrl: collection.collections.image_url || '',
        launchDate: new Date(collection.collections.launch_date),
        featured: collection.collections.featured,
        visible: collection.collections.visible,
        saleEnded: collection.collections.sale_ended,
        slug: collection.collections.slug,
        categories: [],
        products: [],
        accessType: collection.access_type,
        isOwner: collection.collections.user_id === userId
      }));

      const transformedOwnedCollections = (ownedCollections || []).map(collection => ({
        id: collection.id,
        name: collection.name,
        description: collection.description || '',
        imageUrl: collection.image_url || '',
        launchDate: new Date(collection.launch_date),
        featured: collection.featured,
        visible: collection.visible,
        saleEnded: collection.sale_ended,
        slug: collection.slug,
        categories: [],
        products: [],
        accessType: null,
        isOwner: true
      }));

      // Combine and deduplicate collections
      const allCollections = [...transformedOwnedCollections, ...accessCollections]
        .filter((collection, index, self) => 
          index === self.findIndex(c => c.id === collection.id)
        );

      setCollections(allCollections);

      // Fetch all collections for the assign modal
      const { data: allCollectionsData, error: allCollectionsError } = await supabase
        .from('merchant_collections')
        .select('id, name')
        .order('name');
      if (allCollectionsError) throw allCollectionsError;

      setAllCollections(allCollectionsData.map(c => ({
        id: c.id,
        name: c.name,
        description: '',
        imageUrl: '',
        launchDate: new Date(),
        featured: false,
        visible: true,
        saleEnded: false,
        slug: '',
        categories: [],
        products: [],
        accessType: null as null
      })));
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
      if (selectedAccessType === 'owner') {
        // Handle ownership transfer via assignment
        const { error } = await supabase.rpc('manage_collection_access', {
          p_collection_id: selectedCollection,
          p_target_user_id: userId,
          p_action: 'transfer_ownership',
          p_access_type: 'owner'
        });

        if (error) throw error;
        toast.success('Ownership transferred successfully');
        toast.info('Previous owner now has Editor access');
      } else {
        // Handle regular access assignment
        const { error } = await supabase.rpc('manage_collection_access', {
          p_collection_id: selectedCollection,
          p_target_user_id: userId,
          p_action: 'add',
          p_access_type: selectedAccessType
        });

        if (error) throw error;
        toast.success(`${getAccessTypeLabel(selectedAccessType)} access granted successfully`);
      }

      setShowAssignModal(false);
      setSelectedCollection('');
      setSelectedAccessType('view');
      await fetchCollections();
    } catch (err) {
      console.error('Error assigning collection:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign collection';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  }

  async function handleRevokeAccess(collectionId: string) {
    try {
      const { error } = await supabase.rpc('manage_collection_access', {
        p_collection_id: collectionId,
        p_target_user_id: userId,
        p_action: 'remove'
      });

      if (error) throw error;
      toast.success('Access revoked successfully');
      await fetchCollections();
    } catch (err) {
      console.error('Error revoking access:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke access';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  }

  const handleManageAccess = (collection: Collection) => {
    // Prepare collection object for the ManageAccessModal
    const collectionForModal = {
      id: collection.id,
      name: collection.name,
      user_id: collection.isOwner ? userId : '', // This will be corrected by the modal when it loads
      owner_username: collection.isOwner ? '' : collection.owner_username
    };
    
    setSelectedCollectionForManagement(collectionForModal);
    setShowManageAccessModal(true);
  };

  const handleAccessModalClose = () => {
    setShowManageAccessModal(false);
    setSelectedCollectionForManagement(null);
    // Refresh collections after any changes
    fetchCollections();
  };

  const handleAccessChange = () => {
    // Refresh collections when access changes are made
    fetchCollections();
  };

  const getAccessTypeLabel = (accessType: string) => {
    switch (accessType) {
      case 'view': return 'View';
      case 'edit': return 'Editor';
      case 'collaborator': return 'Collaborator';
      case 'owner': return 'Owner';
      default: return 'Unknown';
    }
  };

  const getAccessTypeColor = (accessType: string) => {
    switch (accessType) {
      case 'view': return 'bg-gray-500/10 text-gray-400';
      case 'edit': return 'bg-primary/10 text-primary';
      case 'collaborator': return 'bg-yellow-500/10 text-yellow-400';
      case 'owner': return 'bg-green-500/10 text-green-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  // Get current user's display name for transfer confirmation
  const [currentUserName, setCurrentUserName] = useState<string>('');

  useEffect(() => {
    async function getCurrentUserName() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('display_name')
            .eq('id', user.id)
            .single();
          
          setCurrentUserName(profile?.display_name || user.email?.split('@')[0] || 'Current User');
        }
      } catch (err) {
        console.error('Error getting current user name:', err);
        setCurrentUserName('Current User');
      }
    }
    getCurrentUserName();
  }, []);

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
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-2.5 py-1.5 rounded-lg transition-colors text-xs"
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
            <div 
              key={collection.id} 
              onClick={() => handleManageAccess(collection)}
              className="flex items-center justify-between p-3 bg-gray-900 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" />
                  <h4 className="font-medium group-hover:text-white transition-colors">{collection.name}</h4>
                  {collection.isOwner && (
                    <Crown className="h-4 w-4 text-yellow-400" />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {collection.isOwner ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                      Owner
                    </span>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getAccessTypeColor(collection.accessType || 'view')}`}>
                      {getAccessTypeLabel(collection.accessType || 'view')}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                    Click to manage access
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {!collection.isOwner && (
                  <button
                    onClick={() => handleRevokeAccess(collection.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Revoke access"
                  >
                    <Unlink className="h-4 w-4" />
                  </button>
                )}
              </div>
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
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
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
                  onChange={(e) => setSelectedAccessType(e.target.value as 'view' | 'edit' | 'collaborator' | 'owner')}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="view">View Only - Can browse and see all items</option>
                  <option value="edit">Editor - Can add, modify, and organize items</option>
                  <option value="collaborator">Collaborator - Can create and manage own products/categories</option>
                  <option value="owner">Transfer Ownership - Full control + can manage access</option>
                </select>
              </div>

              {selectedAccessType === 'owner' && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-200">
                      <p className="font-medium mb-1">Transfer Ownership</p>
                      <p className="text-xs text-red-200/80">
                        This will transfer full ownership of the collection to this user. 
                        The current owner will automatically receive Editor access.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                  className="bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
                >
                  {selectedAccessType === 'owner' ? 'Transfer Ownership' : 'Assign Access'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Access Modal */}
      {showManageAccessModal && selectedCollectionForManagement && (
        <ManageAccessModal
          isOpen={showManageAccessModal}
          onClose={handleAccessModalClose}
          collection={selectedCollectionForManagement}
          onAccessChange={handleAccessChange}
        />
      )}
    </div>
  );
}