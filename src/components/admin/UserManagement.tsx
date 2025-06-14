import React, { useState, useEffect } from 'react';
import { Users, Shield, Store, ChevronDown, ChevronUp, Pencil, Trash2, Globe, Copy, Check, Search, Filter, SortAsc, SortDesc, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CollectionAccess } from './CollectionAccess';
import { toast } from 'react-toastify';
import { RefreshButton } from '../ui/RefreshButton';
import { debounce } from '../../utils/debounce';
import { ProfileImage } from '../ui/ProfileImage';
import { VerificationBadge } from '../ui/VerificationBadge';
import { MerchantFeedback } from '../ui/MerchantFeedback';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'merchant' | 'user';
  merchant_tier: MerchantTier;
  created_at: string;
  display_name?: string | null;
  description?: string | null;
  website_url?: string | null;
  profile_image?: string | null;
  payout_wallet?: string | null;
  successful_sales_count?: number;
  collections?: Array<{
    id: string;
    name: string;
    isOwner: boolean;
  }>;
}

// Create a type for the basic user data from RPC call
interface BasicUserData {
  id: string;
  email: string;
  role: 'admin' | 'merchant' | 'user';
  merchant_tier: MerchantTier;
  created_at: string;
  collections_count: number;
  access_count: number;
}

// Type for sort options
type SortDirection = 'asc' | 'desc';
type SortOption = {
  field: keyof User;
  direction: SortDirection;
};

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // Store all users for filtering
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'merchant' | 'user'>('all');
  const [sortOption, setSortOption] = useState<SortOption>({ field: 'created_at', direction: 'desc' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = debounce((value: string) => {
    setSearchQuery(value);
  }, 300);

  const toggleSortDirection = () => {
    setSortOption(prev => ({
      ...prev,
      direction: prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Filter and sort users
  useEffect(() => {
    let filteredUsers = [...allUsers];
    
    // Apply role filter if not 'all'
    if (roleFilter !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.role === roleFilter);
    }
    
    // Apply search if query exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredUsers = filteredUsers.filter(user => {
        // Search in basic user info
        const basicMatch = 
          user.email.toLowerCase().includes(query) ||
          (user.display_name && user.display_name.toLowerCase().includes(query));
        
        // Search in collections if available
        const collectionMatch = user.collections?.some(collection => 
          collection.name.toLowerCase().includes(query)
        );
        
        return basicMatch || collectionMatch;
      });
    }
    
    // Apply sorting
    filteredUsers.sort((a, b) => {
      if (sortOption.field === 'created_at') {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOption.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });
    
    setUsers(filteredUsers);
  }, [searchQuery, roleFilter, sortOption, allUsers]);

  async function fetchUsers() {
    try {
      setLoading(true);
      setError(null);

      // First, fetch basic user data
      const { data: basicUserData, error: basicError } = await supabase.rpc('list_users');
      
      if (basicError) throw basicError;
      
      if (!basicUserData) {
        setUsers([]);
        setAllUsers([]);
        return;
      }
      
      // Then fetch additional profile data for all users
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, description, website_url, profile_image, payout_wallet, merchant_tier, successful_sales_count')
        .in('id', basicUserData.map((user: BasicUserData) => user.id));
        
      if (profilesError) throw profilesError;
      
      // Create a map for fast lookup
      const profileMap: {[key: string]: any} = {};
      if (profiles) {
        profiles.forEach((profile: any) => {
          profileMap[profile.id] = profile;
        });
      }
      
      // Combine the data
      const enrichedUsers = basicUserData.map((user: BasicUserData) => {
        const profile = profileMap[user.id] || {};
        
        return {
          ...user,
          display_name: profile.display_name || null,
          description: profile.description || null,
          website_url: profile.website_url || null,
          profile_image: profile.profile_image || null,
          payout_wallet: profile.payout_wallet || null,
          merchant_tier: user.merchant_tier || 'starter_merchant',
          successful_sales_count: profile.successful_sales_count || 0,
          collections: []
        };
      });

      // Set initial data
      setAllUsers(enrichedUsers);
      setUsers(enrichedUsers);
      
      // Fetch collections data
      try {
        const userIds = enrichedUsers.map((user: BasicUserData) => user.id);
        let userCollections: {[key: string]: Array<{id: string, name: string, isOwner: boolean}>} = {};
        
        // Initialize collections for each user
        enrichedUsers.forEach((user: User) => {
          userCollections[user.id] = [];
        });
        
        // Fetch collections owned by users
        const { data: ownedCollections } = await supabase
          .from('merchant_collections')
          .select('id, name, user_id')
          .in('user_id', userIds);
        
        // Fetch collections users have access to
        const { data: accessCollections } = await supabase
          .from('collection_access')
          .select('collection_id, user_id, collections:collection_id(id, name)')
          .in('user_id', userIds);

        // Add owned collections
        if (ownedCollections) {
          ownedCollections.forEach((col: any) => {
            if (userCollections[col.user_id]) {
              userCollections[col.user_id].push({
                id: col.id,
                name: col.name,
                isOwner: true
              });
            }
          });
        }
        
        // Add collections with access
        if (accessCollections) {
          accessCollections.forEach((acc: any) => {
            if (userCollections[acc.user_id] && acc.collections) {
              userCollections[acc.user_id].push({
                id: acc.collections.id,
                name: acc.collections.name,
                isOwner: false
              });
            }
          });
        }
        
        // Update users with their collections
        const updatedUsers = enrichedUsers.map((user: User) => ({
          ...user,
          collections: userCollections[user.id] || []
        }));
        
        setAllUsers(updatedUsers);
        setUsers(updatedUsers);
      } catch (collectionError) {
        console.error("Error fetching collections:", collectionError);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const role = formData.get('role') as 'admin' | 'merchant' | 'user';
      const merchantTier = formData.get('merchant_tier') as MerchantTier;

      // Validate role
      if (!['admin', 'merchant', 'user'].includes(role)) {
        throw new Error('Invalid role selected');
      }

      // Update role
      const { error: roleError } = await supabase.rpc('change_user_role', {
        p_user_id: editingUser.id,
        p_new_role: role
      });

      if (roleError) throw roleError;

      // Update merchant tier
      const { error: tierError } = await supabase.rpc('admin_set_merchant_tier', {
        p_user_id: editingUser.id,
        p_tier: merchantTier
      });

      if (tierError) throw tierError;

      setShowEditModal(false);
      setEditingUser(null);
      await fetchUsers();
      toast.success('User updated successfully');
    } catch (err) {
      console.error('Error updating user:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user';
      toast.error(errorMessage);
    }
  }

  async function deleteUser() {
    if (!deletingUser) return;

    try {
      const { error: deleteError } = await supabase.rpc('delete_user', {
        p_user_id: deletingUser.id
      });

      if (deleteError) throw deleteError;

      setShowDeleteModal(false);
      setDeletingUser(null);
      await fetchUsers();
      toast.success('User deleted successfully');
    } catch (err) {
      console.error('Error deleting user:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
      toast.error(errorMessage);
    }
  }

  // Add a function to copy the wallet address to clipboard
  const copyWalletToClipboard = (wallet: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    
    navigator.clipboard.writeText(wallet).then(() => {
      setCopiedWallet(wallet);
      toast.success('Wallet address copied to clipboard');
      
      // Reset the copied status after 2 seconds
      setTimeout(() => {
        setCopiedWallet(null);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy wallet address:', err);
      toast.error('Failed to copy wallet address');
    });
  };

  // Add a function to render the expanded user profile details
  function renderUserProfileDetails(user: User) {
    return (
      <div className="space-y-3 mb-4">
        <div className="flex items-start gap-4">
          {/* Profile Image */}
          <div className="flex-shrink-0">
            <ProfileImage
              src={user.profile_image}
              alt={user.display_name || 'User'}
              displayName={user.display_name || user.email}
              size="lg"
            />
          </div>
          
          {/* User Details */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">
                {user.display_name || 'No display name'}
              </h4>
              <span className="text-xs text-gray-500">({user.email})</span>
            </div>
            
            {/* Merchant tier and successful sales */}
            {(user.role === 'merchant' || user.role === 'admin') && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {user.merchant_tier && (
                  <VerificationBadge 
                    tier={user.merchant_tier} 
                    className="text-sm" 
                  />
                )}
                <div className="flex items-center gap-1 text-yellow-400">
                  <Star className="h-3 w-3 fill-current" />
                  <span>{user.successful_sales_count || 0}</span>
                </div>
                <span className="text-gray-500">successful sales</span>
              </div>
            )}
            
            {user.description && (
              <p className="text-xs text-gray-400">{user.description}</p>
            )}
            
            <div className="flex flex-wrap gap-2 mt-1">
              {user.website_url && (
                <a 
                  href={user.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-800 rounded text-xs text-blue-400 hover:text-blue-300"
                >
                  <Globe className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">
                    {user.website_url.replace(/^https?:\/\//, '')}
                  </span>
                </a>
              )}
              
              {user.payout_wallet && (
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-400 hover:bg-gray-700 cursor-pointer group">
                  <span className="font-mono whitespace-nowrap overflow-x-auto max-w-[240px] scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent py-0.5">
                    Wallet: {user.payout_wallet}
                  </span>
                  <button
                    onClick={(e) => user.payout_wallet && copyWalletToClipboard(user.payout_wallet, e)}
                    className="p-0.5 hover:bg-gray-600 rounded"
                    title="Copy wallet address"
                  >
                    {copiedWallet === user.payout_wallet ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-gray-400 group-hover:text-white" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Merchant Feedback Section for Admins */}
        {(user.role === 'merchant' || user.role === 'admin') && (
          <div className="mt-4 pt-3 border-t border-gray-800">
            <h5 className="text-xs font-medium text-gray-300 mb-2">Community Feedback</h5>
            <MerchantFeedback 
              merchantId={user.id} 
              readOnly={true}
              showTitle={false}
              showReportButton={false}
              className="" 
            />
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-800 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold">User Management</h2>
            <RefreshButton onRefresh={fetchUsers} className="scale-90" />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-xs sm:text-sm">
            <p>{error}</p>
          </div>
        )}

        {/* Filter and Search Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by name, email or collection..."
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-gray-800 rounded-lg pl-8 sm:pl-10 pr-2 sm:pr-4 py-1.5 sm:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          {/* Role Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-2 sm:left-3 flex items-center pointer-events-none sm:hidden">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'merchant' | 'user')}
              className="h-full bg-gray-800 rounded-lg pl-8 sm:pl-10 pr-2 sm:pr-8 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none min-w-[44px] sm:min-w-[120px]"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="merchant">Merchant</option>
              <option value="user">User</option>
            </select>
            <div className="hidden sm:flex absolute inset-y-0 left-3 items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <div className="absolute inset-y-0 right-2 sm:right-3 flex items-center pointer-events-none">
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </div>
          
          {/* Sort Toggle */}
          <button
            onClick={toggleSortDirection}
            className="h-full bg-gray-800 text-gray-400 hover:text-white p-1.5 sm:p-2 rounded-lg flex items-center justify-center transition-colors min-w-[36px] sm:min-w-[40px]"
            title={`Sort by date (${sortOption.direction === 'asc' ? 'oldest first' : 'newest first'})`}
          >
            {sortOption.direction === 'asc' ? 
              <SortAsc className="h-4 w-4" /> : 
              <SortDesc className="h-4 w-4" />
            }
            <span className="hidden sm:inline ml-2">Sort</span>
          </button>
        </div>

        {/* User count */}
        <div className="text-xs sm:text-sm text-gray-400">
          Showing {users.length} {users.length === 1 ? 'user' : 'users'}
          {roleFilter !== 'all' && ` with role "${roleFilter}"`}
          {searchQuery && ` matching "${searchQuery}"`}
        </div>

        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="border-b border-gray-800 last:border-0">
              <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <ProfileImage
            src={user.profile_image}
            alt={user.display_name || user.email}
            displayName={user.display_name || user.email}
            size="md"
          />
          <div className="p-1.5 bg-gray-800 rounded-lg">
            {user.role === 'admin' ? (
              <Shield className="h-4 w-4 text-red-400" />
            ) : user.role === 'merchant' ? (
              <Store className="h-4 w-4 text-primary" />
            ) : (
              <Users className="h-4 w-4 text-blue-400" />
            )}
          </div>
        </div>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm font-medium truncate">
                        {user.display_name || user.email}
                      </p>
                      {user.merchant_tier && (
                        <VerificationBadge 
                          tier={user.merchant_tier} 
                          className="text-base sm:text-lg" 
                          showTooltip={true}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400">
                      <span>{user.email}</span>
                      <span className="text-[8px] mx-1">•</span>
                      <span className={`
                        font-medium px-1.5 py-0.5 rounded-full
                        ${user.role === 'admin' ? 'bg-red-500/20 text-red-400' : 
                          user.role === 'merchant' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-blue-500/20 text-blue-400'}
                      `}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                      {user.collections && user.collections.length > 0 && (
                        <>
                          <span className="text-[8px] mx-1">•</span>
                          <span className="text-primary">
                            {user.collections.length} {user.collections.length === 1 ? 'collection' : 'collections'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setShowEditModal(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    title="Edit user"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => {
                      setDeletingUser(user);
                      setShowDeleteModal(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Delete user"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {expandedUser === user.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {expandedUser === user.id && (
                <div className="px-3 pb-3 border-t border-gray-800 mt-2 pt-3">
                  {/* Render user profile details */}
                  {renderUserProfileDetails(user)}
                  
                  {/* Collection access information */}
                  <CollectionAccess userId={user.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit User</h3>
              <div className="text-sm text-gray-400">{editingUser.email}</div>
            </div>
            
            <form onSubmit={updateUser} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Role</label>
                <select
                  name="role"
                  defaultValue={editingUser.role}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="user">User</option>
                  <option value="merchant">Merchant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Verification Tier</label>
                <select
                  name="merchant_tier"
                  defaultValue={editingUser.merchant_tier}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="starter_merchant">Starter</option>
                  <option value="verified_merchant">Verified</option>
                  <option value="trusted_merchant">Trusted</option>
                  <option value="elite_merchant">Elite</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">This determines which verification badge appears next to the user's name.</p>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
                >
                  Update Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deletingUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Delete User</h3>
              <p className="text-sm text-gray-400 mt-1">
                Are you sure you want to delete {deletingUser.email}? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingUser(null);
                }}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteUser}
                className="bg-red-600 hover:bg-red-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 