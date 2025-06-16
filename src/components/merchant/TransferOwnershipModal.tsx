import { useState } from 'react';
import { X, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserSelector } from './UserSelector';
import { toast } from 'react-toastify';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';

interface UserForTransfer {
  id: string;
  username: string;
  email: string;
  role: string;
  merchant_tier: MerchantTier;
  display_name: string;
}

interface Collection {
  id: string;
  name: string;
  owner_username?: string | null;
  user_id: string;
}

interface TransferOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
  onTransferComplete: () => void;
}

export function TransferOwnershipModal({ 
  isOpen, 
  onClose, 
  collection, 
  onTransferComplete 
}: TransferOwnershipModalProps) {
  const [selectedUser, setSelectedUser] = useState<UserForTransfer | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const handleUserSelect = (user: UserForTransfer) => {
    setSelectedUser(user);
  };

  const handleUserClear = () => {
    setSelectedUser(null);
  };

  const handleNext = () => {
    if (selectedUser) {
      setShowConfirmation(true);
    }
  };

  const handleBack = () => {
    setShowConfirmation(false);
  };

  const handleTransfer = async () => {
    if (!selectedUser) return;

    try {
      setTransferring(true);

      const { data, error } = await supabase.rpc('transfer_collection_ownership', {
        p_collection_id: collection.id,
        p_new_owner_id: selectedUser.id,
        p_preserve_old_owner_access: true
      });

      if (error) throw error;

      // Show success messages
      toast.success(`Ownership transferred to ${selectedUser.display_name || selectedUser.username}`);
      
      // Notify new owner (they might be online)
      toast.info(`${selectedUser.display_name || selectedUser.username} now owns "${collection.name}"`);
      
      // Notify about previous owner access
      if (data.preserved_access) {
        toast.info(`Previous owner "${data.old_owner_username}" now has edit access`);
      }

      onTransferComplete();
      onClose();
    } catch (err) {
      console.error('Error transferring ownership:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to transfer ownership';
      toast.error(errorMessage);
    } finally {
      setTransferring(false);
    }
  };

  const handleClose = () => {
    if (!transferring) {
      setSelectedUser(null);
      setShowConfirmation(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            {showConfirmation ? 'Confirm Transfer' : 'Transfer Ownership'}
          </h2>
          <button
            onClick={handleClose}
            disabled={transferring}
            className="p-1 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showConfirmation ? (
            /* Step 1: User Selection */
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-300">Collection</h3>
                <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="font-medium text-white">{collection.name}</p>
                  <p className="text-sm text-gray-400">
                    Current owner: {collection.owner_username}
                  </p>
                </div>
              </div>

              <UserSelector
                onSelect={handleUserSelect}
                excludeUserId={collection.user_id}
                selectedUser={selectedUser}
                onClear={handleUserClear}
              />

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-200">
                    <p className="font-medium mb-1">Transfer Rules:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Previous owner will retain edit access</li>
                      <li>• New owner must have merchant role or higher</li>
                      <li>• All products and categories stay with collection</li>
                      <li>• This action can be reversed by admins</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Confirmation */
            <div className="space-y-4">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Confirm Ownership Transfer
                </h3>
                <p className="text-gray-400 text-sm">
                  This will transfer ownership of the collection to another user.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-400">From</p>
                    <p className="font-medium text-white">{collection.owner_username}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500" />
                  <div className="text-right">
                    <p className="text-sm text-gray-400">To</p>
                    <p className="font-medium text-white">
                      {selectedUser?.display_name || selectedUser?.username}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Collection</p>
                  <p className="font-medium text-white">{collection.name}</p>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm text-red-200">
                  <strong>Are you sure?</strong> This will immediately change the collection owner.
                  The previous owner will retain edit access.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          {!showConfirmation ? (
            <>
              <button
                onClick={handleClose}
                disabled={transferring}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                disabled={!selectedUser || transferring}
                className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBack}
                disabled={transferring}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {transferring ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Transferring...
                  </>
                ) : (
                  'Transfer Ownership'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 