import { useState, useEffect } from 'react';
import { X, Crown, Edit3, Eye, UserPlus, Trash2, AlertTriangle, Shield, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [expandedAccessList, setExpandedAccessList] = useState(true);

  // Load access details when modal opens
  useEffect(() => {
    if (isOpen && collection.id) {
      loadAccessDetails();
    }
  }, [isOpen, collection.id]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount or when modal closes
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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
      setEditingUserId(null);

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

  const handleEditUserAccess = (user: AccessUser) => {
    setEditingUserId(user.user_id);
  };

  const handleUpdateUserAccess = (userId: string, newAccessType: AccessType) => {
    if (newAccessType === 'owner') {
      // Find the user info for transfer confirmation
      const user = accessDetails?.access_users.find(u => u.user_id === userId);
      if (user) {
        setTransferTarget({
          id: user.user_id,
          username: user.username,
          email: user.email,
          role: user.role,
          merchant_tier: user.merchant_tier,
          display_name: user.display_name,
          profile_image: user.profile_image
        });
        setShowTransferConfirm(true);
      }
    } else {
      handleManageAccess(userId, 'update', newAccessType);
    }
    setEditingUserId(null);
  };

  const handleClose = () => {
    if (!actionLoading) {
      setSelectedUser(null);
      setShowAddUser(false);
      setShowTransferConfirm(false);
      setTransferTarget(null);
      setEditingUserId(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/50">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Manage Access
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Control who can access "{collection.name}"
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={!!actionLoading}
            className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
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
              {/* Collection Owner */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-400" />
                  Collection Owner
                </h3>
                <div className="p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                  <div className="flex items-center gap-3">
                    <ProfileImage
                      src={accessDetails.owner_profile_image || null}
                      alt={accessDetails.owner_display_name || accessDetails.owner_username}
                      displayName={accessDetails.owner_display_name || accessDetails.owner_username}
                      size="md"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          {accessDetails.owner_display_name || accessDetails.owner_username}
                        </span>
                        <VerificationBadge 
                          tier={accessDetails.owner_merchant_tier} 
                          className="text-xs" 
                          showTooltip={true}
                        />
                      </div>
                      <p className="text-xs text-yellow-400/80">Full ownership access</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shared Access */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setExpandedAccessList(!expandedAccessList)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                    Shared Access ({accessDetails.access_users.length})
                    {expandedAccessList ? 
                      <ChevronUp className="h-4 w-4" /> : 
                      <ChevronDown className="h-4 w-4" />
                    }
                  </button>
                  <button
                    onClick={() => setShowAddUser(!showAddUser)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary hover:text-primary-hover bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add User
                  </button>
                </div>

                {expandedAccessList && (
                  <>
                    {accessDetails.access_users.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 bg-gray-800/30 rounded-lg border-dashed border border-gray-600">
                        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No additional users have access</p>
                        <p className="text-xs text-gray-500 mt-1">Click "Add User" to share this collection</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {accessDetails.access_users.map((user) => (
                          <div key={user.user_id} className="group flex items-center gap-3 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 hover:border-gray-600 transition-all">
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
                              {editingUserId === user.user_id ? (
                                <div className="flex items-center gap-1">
                                  {getAvailableAccessTypes(user.role).map((type) => (
                                    <button
                                      key={type}
                                      onClick={() => handleUpdateUserAccess(user.user_id, type)}
                                      disabled={!!actionLoading}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                        user.access_type === type
                                          ? getAccessTypeColor(type)
                                          : 'text-gray-400 bg-gray-600/50 hover:bg-gray-600'
                                      }`}
                                    >
                                      {getAccessTypeIcon(type)}
                                      {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                  ))}
                                  <button
                                    onClick={() => setEditingUserId(null)}
                                    className="p-1 text-gray-400 hover:text-gray-300 transition-colors ml-1"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEditUserAccess(user)}
                                    disabled={!!actionLoading}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:ring-2 hover:ring-primary/20 ${getAccessTypeColor(user.access_type)}`}
                                  >
                                    {getAccessTypeIcon(user.access_type)}
                                    {user.access_type.charAt(0).toUpperCase() + user.access_type.slice(1)}
                                  </button>
                                  <button
                                    onClick={() => handleManageAccess(user.user_id, 'remove')}
                                    disabled={!!actionLoading}
                                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    {actionLoading === user.user_id ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Add User Form */}
              {showAddUser && (
                <div className="space-y-4 p-5 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl border border-gray-600 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">Add New User</h4>
                    <button
                      onClick={() => {
                        setShowAddUser(false);
                        setSelectedUser(null);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <UserSelector
                    onSelect={setSelectedUser}
                    excludeUserId={accessDetails.owner_id}
                    selectedUser={selectedUser}
                    onClear={() => setSelectedUser(null)}
                  />

                  {selectedUser && (
                    <div className="space-y-4 mt-4 pt-4 border-t border-gray-600">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                          Select Access Level
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {getAvailableAccessTypes(selectedUser.role as UserRole).map((type) => (
                            <button
                              key={type}
                              onClick={() => setSelectedAccessType(type)}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all border-2 ${
                                selectedAccessType === type
                                  ? 'border-primary bg-primary/20 text-primary'
                                  : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:border-gray-500'
                              }`}
                            >
                              <div className={`p-1.5 rounded ${getAccessTypeColor(type)}`}>
                                {getAccessTypeIcon(type)}
                              </div>
                              <div className="text-left">
                                <div className="font-medium">
                                  {type.charAt(0).toUpperCase() + type.slice(1)} Access
                                </div>
                                <div className="text-xs opacity-75">
                                  {type === 'view' && 'Can view collection contents'}
                                  {type === 'edit' && 'Can modify and manage collection'}
                                  {type === 'owner' && 'Full control including deletion'}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleAddUser}
                          disabled={!!actionLoading}
                          className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
                        >
                          {selectedAccessType === 'owner' ? 'Transfer Ownership' : 'Grant Access'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddUser(false);
                            setSelectedUser(null);
                          }}
                          disabled={!!actionLoading}
                          className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
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
                <div className="space-y-5 p-5 bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-200 mb-2">Confirm Ownership Transfer</h4>
                      <p className="text-sm text-red-200/80 leading-relaxed">
                        This will transfer full ownership of{' '}
                        <span className="font-medium text-red-100">"{accessDetails.collection_name}"</span>{' '}
                        to <span className="font-medium text-red-100">
                          {transferTarget.display_name || transferTarget.username}
                        </span>.
                      </p>
                      
                      <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <p className="text-xs text-red-200/70">
                          • The current owner will automatically receive edit access<br/>
                          • This action cannot be undone<br/>
                          • Only the new owner can transfer ownership again
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleTransferOwnership}
                      disabled={!!actionLoading}
                      className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
                    >
                      {actionLoading ? 'Transferring...' : 'Transfer Ownership'}
                    </button>
                    <button
                      onClick={() => {
                        setShowTransferConfirm(false);
                        setTransferTarget(null);
                      }}
                      disabled={!!actionLoading}
                      className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
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