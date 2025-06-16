import { useState, useEffect } from 'react';
import { X, Crown, Edit3, Eye, UserPlus, Trash2, AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserSelector } from './UserSelector';
import { ProfileImage } from '../ui/ProfileImage';
import { VerificationBadge } from '../ui/VerificationBadge';
import { toast } from 'react-toastify';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';
type UserRole = 'user' | 'merchant' | 'admin';
type AccessType = 'view' | 'edit' | 'owner';

interface UserForTransfer {
  id: string;
  username: string;
  email: string;
  role: string;
  merchant_tier: MerchantTier;
  display_name: string;
  profile_image: string;
}

interface AccessUser {
  user_id: string;
  access_type: AccessType;
  username: string;
  email: string;
  display_name: string;
  profile_image: string;
  role: UserRole;
  merchant_tier: MerchantTier;
  created_at: string;
}

interface CollectionAccessDetails {
  collection_id: string;
  collection_name: string;
  owner_id: string;
  owner_username: string;
  owner_merchant_tier: MerchantTier;
  owner_display_name: string;
  owner_profile_image: string;
  access_users: AccessUser[];
}

interface Collection {
  id: string;
  name: string;
  owner_username?: string | null;
  user_id: string;
}

interface ManageAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
  onAccessChange: () => void;
}

export function ManageAccessModal({ 
  isOpen, 
  onClose, 
  collection, 
  onAccessChange 
}: ManageAccessModalProps) {
  const [accessDetails, setAccessDetails] = useState<CollectionAccessDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserForTransfer | null>(null);
  const [selectedAccessType, setSelectedAccessType] = useState<AccessType>('view');
  const [showAddUser, setShowAddUser] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferTarget, setTransferTarget] = useState<UserForTransfer | null>(null);

  // Load access details when modal opens
  useEffect(() => {
    if (isOpen && collection.id) {
      loadAccessDetails();
    }
  }, [isOpen, collection.id]);

  const loadAccessDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_collection_access_details', {
        p_collection_id: collection.id
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const details = data[0];
        setAccessDetails({
          ...details,
          access_users: details.access_users || []
        });
      }
    } catch (err) {
      console.error('Error loading access details:', err);
      toast.error('Failed to load access details');
    } finally {
      setLoading(false);
    }
  };

  const handleManageAccess = async (
    targetUserId: string, 
    action: string, 
    accessType: AccessType | null = null
  ) => {
    try {
      setActionLoading(targetUserId);

      const { data, error } = await supabase.rpc('manage_collection_access', {
        p_collection_id: collection.id,
        p_target_user_id: targetUserId,
        p_action: action,
        p_access_type: accessType
      });

      if (error) throw error;

      // Show success message based on action
      switch (action) {
        case 'add':
          toast.success(`Added ${data.user_username} with ${accessType} access`);
          break;
        case 'update':
          toast.success(`Updated ${data.user_username} to ${accessType} access`);
          break;
        case 'remove':
          toast.success(`Removed ${data.user_username} from collection`);
          break;
        case 'transfer_ownership':
          toast.success(`Ownership transferred to ${data.new_owner_username}`);
          toast.info(`Previous owner now has edit access`);
          break;
      }

      // Reload access details and notify parent
      await loadAccessDetails();
      onAccessChange();

      // Reset form
      setSelectedUser(null);
      setShowAddUser(false);
      setShowTransferConfirm(false);
      setTransferTarget(null);

    } catch (err) {
      console.error('Error managing access:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to manage access';
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddUser = () => {
    if (!selectedUser) return;

    if (selectedAccessType === 'owner') {
      setTransferTarget(selectedUser);
      setShowTransferConfirm(true);
    } else {
      handleManageAccess(selectedUser.id, 'add', selectedAccessType);
    }
  };

  const handleTransferOwnership = () => {
    if (!transferTarget) return;
    handleManageAccess(transferTarget.id, 'transfer_ownership', 'owner');
  };

  const getAccessTypeIcon = (accessType: AccessType) => {
    switch (accessType) {
      case 'view': return <Eye className="h-4 w-4" />;
      case 'edit': return <Edit3 className="h-4 w-4" />;
      case 'owner': return <Crown className="h-4 w-4" />;
    }
  };

  const getAccessTypeColor = (accessType: AccessType) => {
    switch (accessType) {
      case 'view': return 'text-gray-400 bg-gray-500/20';
      case 'edit': return 'text-blue-400 bg-blue-500/20';
      case 'owner': return 'text-yellow-400 bg-yellow-500/20';
    }
  };

  const getAvailableAccessTypes = (userRole: UserRole): AccessType[] => {
    switch (userRole) {
      case 'user': return ['view', 'edit'];
      case 'merchant':
      case 'admin': return ['view', 'edit', 'owner'];
      default: return ['view'];
    }
  };

  const handleClose = () => {
    if (!actionLoading) {
      setSelectedUser(null);
      setShowAddUser(false);
      setShowTransferConfirm(false);
      setTransferTarget(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            Manage Access
          </h2>
          <button
            onClick={handleClose}
            disabled={!!actionLoading}
            className="p-1 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : accessDetails ? (
            <div className="space-y-6">
              {/* Collection Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-300">Collection</h3>
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="font-medium text-white mb-2">{accessDetails.collection_name}</p>
                  
                  {/* Owner */}
                  <div className="flex items-center gap-3">
                    <ProfileImage
                      src={accessDetails.owner_profile_image || null}
                      alt={accessDetails.owner_display_name || accessDetails.owner_username}
                      displayName={accessDetails.owner_display_name || accessDetails.owner_username}
                      size="sm"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm font-medium text-white">
                          {accessDetails.owner_display_name || accessDetails.owner_username}
                        </span>
                        <VerificationBadge 
                          tier={accessDetails.owner_merchant_tier} 
                          className="text-xs" 
                          showTooltip={true}
                        />
                      </div>
                      <p className="text-xs text-yellow-400">Owner</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Access */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">Current Access</h3>
                  <button
                    onClick={() => setShowAddUser(!showAddUser)}
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add User
                  </button>
                </div>

                {accessDetails.access_users.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No additional users have access</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accessDetails.access_users.map((user) => (
                      <div key={user.user_id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                        <ProfileImage
                          src={user.profile_image || null}
                          alt={user.display_name || user.username}
                          displayName={user.display_name || user.username}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">
                              {user.display_name || user.username}
                            </p>
                            <VerificationBadge 
                              tier={user.merchant_tier} 
                              className="text-xs" 
                              showTooltip={true}
                            />
                          </div>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getAccessTypeColor(user.access_type)}`}>
                            {getAccessTypeIcon(user.access_type)}
                            {user.access_type.charAt(0).toUpperCase() + user.access_type.slice(1)}
                          </span>
                          <button
                            onClick={() => handleManageAccess(user.user_id, 'remove')}
                            disabled={!!actionLoading}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === user.user_id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add User Form */}
              {showAddUser && (
                <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h4 className="text-sm font-medium text-gray-300">Add New User</h4>
                  
                  <UserSelector
                    onSelect={setSelectedUser}
                    excludeUserId={accessDetails.owner_id}
                    selectedUser={selectedUser}
                    onClear={() => setSelectedUser(null)}
                  />

                  {selectedUser && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Access Level
                        </label>
                        <div className="flex gap-2">
                          {getAvailableAccessTypes(selectedUser.role as UserRole).map((type) => (
                            <button
                              key={type}
                              onClick={() => setSelectedAccessType(type)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                selectedAccessType === type
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {getAccessTypeIcon(type)}
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleAddUser}
                          disabled={!!actionLoading}
                          className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                        >
                          {selectedAccessType === 'owner' ? 'Transfer Ownership' : 'Add Access'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddUser(false);
                            setSelectedUser(null);
                          }}
                          disabled={!!actionLoading}
                          className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Transfer Ownership Confirmation */}
              {showTransferConfirm && transferTarget && (
                <div className="space-y-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <h4 className="text-sm font-medium text-red-200">Confirm Ownership Transfer</h4>
                  </div>
                  
                  <p className="text-sm text-red-200">
                    This will transfer full ownership of "{accessDetails.collection_name}" to{' '}
                    <strong>{transferTarget.display_name || transferTarget.username}</strong>.
                    The current owner will retain edit access.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={handleTransferOwnership}
                      disabled={!!actionLoading}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                    >
                      Transfer Ownership
                    </button>
                    <button
                      onClick={() => {
                        setShowTransferConfirm(false);
                        setTransferTarget(null);
                      }}
                      disabled={!!actionLoading}
                      className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p>Failed to load access details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 