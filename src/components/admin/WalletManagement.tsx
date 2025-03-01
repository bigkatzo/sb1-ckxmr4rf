import { useState, useEffect } from 'react';
import { Plus, Star, X, Wallet, Store, Unlink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { EditButton } from '../ui/EditButton';
import { DeleteButton } from '../ui/DeleteButton';
import { Toggle } from '../ui/Toggle';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RefreshButton } from '../ui/RefreshButton';
import { toast } from 'react-toastify';
import type { Collection } from '../../types';

interface MerchantWallet {
  id: string;
  address: string;
  label: string;
  is_active: boolean;
  is_main: boolean;
}

interface CollectionWallet {
  id: string;
  collection_id: string;
  wallet_id: string;
}

export function WalletManagement() {
  const [wallets, setWallets] = useState<MerchantWallet[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionWallets, setCollectionWallets] = useState<CollectionWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [editingWallet, setEditingWallet] = useState<MerchantWallet | null>(null);
  const [deletingWallet, setDeletingWallet] = useState<MerchantWallet | null>(null);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const [walletsRes, collectionsRes, collectionWalletsRes] = await Promise.all([
        supabase.from('merchant_wallets').select('*').order('created_at', { ascending: false }),
        supabase.from('collections').select('*').order('name'),
        supabase.from('collection_wallets').select('*')
      ]);

      if (walletsRes.error) throw walletsRes.error;
      if (collectionsRes.error) throw collectionsRes.error;
      if (collectionWalletsRes.error) throw collectionWalletsRes.error;

      setWallets(walletsRes.data);
      setCollections(collectionsRes.data);
      setCollectionWallets(collectionWalletsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: FormData) => {
    try {
      if (editingWallet) {
        await updateWallet(editingWallet.id, data);
        toast.success('Wallet updated successfully');
      } else {
        await createWallet(data);
        toast.success('Wallet created successfully');
      }
      setShowAddModal(false);
      setShowEditModal(false);
      setEditingWallet(null);
      fetchData();
    } catch (error) {
      console.error('Error with wallet:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save wallet');
    }
  };

  const handleToggleMain = async (id: string, isMain: boolean) => {
    try {
      await setMainWallet(id);
      fetchData();
      toast.success(isMain ? 'Main wallet unset' : 'Main wallet set');
    } catch (error) {
      console.error('Error toggling main status:', error);
      toast.error('Failed to update main status');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('merchant_wallets')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      fetchData();
      toast.success(isActive ? 'Wallet deactivated' : 'Wallet activated');
    } catch (error) {
      console.error('Error toggling active status:', error);
      toast.error('Failed to update active status');
    }
  };

  const handleAssignWallet = async () => {
    if (!selectedWallet || !selectedCollection) return;

    try {
      const { error } = await supabase
        .from('collection_wallets')
        .insert({
          collection_id: selectedCollection,
          wallet_id: selectedWallet
        });

      if (error) throw error;
      setShowAssignModal(false);
      setSelectedWallet(null);
      setSelectedCollection(null);
      fetchData();
      toast.success('Wallet assigned successfully');
    } catch (error) {
      console.error('Error assigning wallet:', error);
      toast.error('Failed to assign wallet');
    }
  };

  const handleUnassignWallet = async (collectionId: string) => {
    try {
      const { error } = await supabase
        .from('collection_wallets')
        .delete()
        .eq('collection_id', collectionId);

      if (error) throw error;
      fetchData();
      toast.success('Wallet unassigned successfully');
    } catch (error) {
      console.error('Error unassigning wallet:', error);
      toast.error('Failed to unassign wallet');
    }
  };

  const createWallet = async (data: FormData) => {
    const { error } = await supabase
      .from('merchant_wallets')
      .insert({
        address: data.get('address'),
        label: data.get('label'),
        is_active: true
      });

    if (error) throw error;
  };

  const updateWallet = async (id: string, data: FormData) => {
    const { error } = await supabase
      .from('merchant_wallets')
      .update({
        address: data.get('address'),
        label: data.get('label')
      })
      .eq('id', id);

    if (error) throw error;
  };

  const setMainWallet = async (id: string) => {
    const { error } = await supabase
      .rpc('set_main_wallet', {
        p_wallet_id: id
      });

    if (error) throw error;
  };

  if (loading) {
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
            <h2 className="text-base sm:text-lg font-semibold">Merchant Wallets</h2>
            <RefreshButton onRefresh={fetchData} className="scale-90" />
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Add Wallet</span>
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
            >
              <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Assign</span>
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-red-500/10 text-red-500 rounded-lg p-4">
          <p className="text-xs sm:text-sm">{error}</p>
        </div>
      ) : wallets.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-xs sm:text-sm">No wallets added yet.</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {wallets.map((wallet) => (
            <div key={wallet.id} className="bg-gray-900 rounded-lg p-2.5 sm:p-3 group">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 sm:p-2 bg-gray-800 rounded-lg">
                    <Wallet className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">{wallet.label}</p>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-mono truncate">
                      {wallet.address}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleMain(wallet.id, wallet.is_main)}
                    className={`p-2 rounded-lg transition-colors ${
                      wallet.is_main 
                        ? 'text-yellow-400 hover:text-yellow-500 bg-yellow-400/10 hover:bg-yellow-400/20' 
                        : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                    }`}
                    title={wallet.is_main ? 'Main wallet' : 'Set as main wallet'}
                  >
                    <Star className="h-4 w-4" fill={wallet.is_main ? 'currentColor' : 'none'} />
                  </button>
                  <EditButton 
                    onClick={() => {
                      setEditingWallet(wallet);
                      setShowEditModal(true);
                    }}
                    className="scale-90"
                  />
                  <DeleteButton 
                    onClick={() => {
                      setDeletingWallet(wallet);
                      setShowDeleteModal(true);
                    }}
                    className="scale-90"
                  />
                  <Toggle
                    checked={wallet.is_active}
                    onCheckedChange={() => handleToggleActive(wallet.id, wallet.is_active)}
                    size="sm"
                  />
                </div>
              </div>

              {/* Show assigned collections */}
              {collectionWallets.some(cw => cw.wallet_id === wallet.id) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {collections
                    .filter(c => collectionWallets.some(cw => cw.wallet_id === wallet.id && cw.collection_id === c.id))
                    .map(collection => (
                      <span 
                        key={collection.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400"
                      >
                        <Store className="h-2.5 w-2.5" />
                        {collection.name}
                        <button
                          onClick={() => handleUnassignWallet(collection.id)}
                          className="hover:text-red-400 transition-colors"
                          title="Unassign wallet"
                        >
                          <Unlink className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Wallet Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingWallet ? 'Edit Wallet' : 'Add Merchant Wallet'}
              </h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setEditingWallet(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(new FormData(e.currentTarget));
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Wallet Label
                  </label>
                  <input
                    type="text"
                    name="label"
                    defaultValue={editingWallet?.label}
                    required
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Wallet Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={editingWallet?.address}
                    required
                    pattern="^[1-9A-HJ-NP-Za-km-z]{32,44}$"
                    title="Enter a valid Solana wallet address"
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingWallet(null);
                    }}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors"
                  >
                    {editingWallet ? 'Update' : 'Add'} Wallet
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Wallet Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Assign Wallet to Collection</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Wallet</label>
                <select
                  value={selectedWallet || ''}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Choose a wallet</option>
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.label} ({wallet.address.slice(0, 4)}...{wallet.address.slice(-4)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select Collection</label>
                <select
                  value={selectedCollection || ''}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Choose a collection</option>
                  {collections
                    .filter(c => !collectionWallets.some(cw => cw.collection_id === c.id))
                    .map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))
                  }
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
                  onClick={handleAssignWallet}
                  disabled={!selectedWallet || !selectedCollection}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-lg transition-colors"
                >
                  Assign Wallet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingWallet && (
        <ConfirmDialog
          open={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeletingWallet(null);
          }}
          title="Delete Wallet"
          description={`Are you sure you want to delete this wallet? ${
            deletingWallet.is_main ? 'Warning: This is currently set as the main wallet.' : ''
          }`}
          confirmLabel="Delete"
          onConfirm={async () => {
            try {
              const { error } = await supabase.rpc('delete_merchant_wallet', {
                p_wallet_id: deletingWallet.id
              });

              if (error) throw error;
              fetchData();
              toast.success('Wallet deleted successfully');
            } catch (error) {
              console.error('Error deleting wallet:', error);
              toast.error('Failed to delete wallet');
            } finally {
              setShowDeleteModal(false);
              setDeletingWallet(null);
            }
          }}
        />
      )}
    </div>
  );
}