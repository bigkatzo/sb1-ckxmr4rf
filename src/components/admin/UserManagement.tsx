import React, { useState, useEffect } from 'react';
import { Users, Shield, Store, Plus, X, ChevronDown, ChevronUp, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CollectionAccess } from './CollectionAccess';
import { toast } from 'react-toastify';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'merchant' | 'user';
  created_at: string;
  collection_count: number;
  last_active: string;
  metadata: any;
}

interface AdminListUsersResponse {
  id: string;
  email: string;
  role: 'admin' | 'merchant' | 'user';
  created_at: string;
  collection_count: number;
  last_active: string;
  metadata: any;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'admin' | 'merchant' | 'user' | null>(null);
  const [page, setPage] = useState(0);
  const [createUserData, setCreateUserData] = useState<{
    email: string;
    password: string;
    role: 'admin' | 'merchant' | 'user';
    metadata?: Record<string, any>;
  }>({
    email: '',
    password: '',
    role: 'merchant',
    metadata: {}
  });

  useEffect(() => {
    fetchUsers();
  }, [searchQuery, roleFilter, page]);

  async function fetchUsers() {
    try {
      setLoading(true);
      setError(null);

      // First verify we have a session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No active session found');
      }

      // Check if user is admin
      const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
      if (adminError) {
        console.error('Error checking admin status:', adminError);
        throw new Error('Failed to verify admin access');
      }

      if (!isAdmin) {
        throw new Error('Only admin users can access this page');
      }

      // Fetch users with proper error handling
      const { data, error } = await supabase.rpc('admin_list_users', {
        p_search: searchQuery || null,
        p_role: roleFilter || null,
        p_limit: 10,
        p_offset: page * 10
      });

      if (error) {
        console.error('Error from admin_list_users:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from admin_list_users');
      }

      console.log('Fetched users:', data); // Debug log

      setUsers(data.map((user: AdminListUsersResponse) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        collection_count: user.collection_count,
        last_active: user.last_active,
        metadata: user.metadata
      })));
    } catch (err) {
      console.error('Error in fetchUsers:', err);
      const message = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreating(true);
      setError(null);

      const { data: userId, error: createError } = await supabase.rpc(
        'admin_create_user',
        {
          p_email: createUserData.email,
          p_password: createUserData.password,
          p_role: createUserData.role,
          p_metadata: createUserData.metadata || {}
        }
      );

      if (createError) throw createError;

      setCreateUserData({ 
        email: '', 
        password: '', 
        role: 'merchant',
        metadata: {}
      });
      setShowCreateModal(false);
      await fetchUsers();
      toast.success('User created successfully');
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const email = formData.get('email') as string;
      const role = formData.get('role') as 'admin' | 'merchant' | 'user';
      const password = formData.get('password') as string;

      // Update user email if changed
      if (email !== editingUser.email) {
        const { error: emailError } = await supabase.auth.admin.updateUserById(
          editingUser.id,
          { email }
        );
        if (emailError) throw emailError;
      }

      // Update password if provided
      if (password) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          editingUser.id,
          { password }
        );
        if (passwordError) throw passwordError;
      }

      // Update role in profile
      const { error: roleError } = await supabase
        .from('user_profiles')
        .upsert({ id: editingUser.id, role });

      if (roleError) throw roleError;

      setShowEditModal(false);
      setEditingUser(null);
      await fetchUsers();
      toast.success('User updated successfully');
    } catch (err) {
      console.error('Error updating user:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
    }
  }

  async function deleteUser(userId: string) {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      setShowDeleteModal(false);
      setDeletingUser(null);
      await fetchUsers();
      toast.success('User deleted successfully');
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    }
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
      <div className="flex justify-between items-center">
        <h2 className="text-base sm:text-lg font-semibold">User Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Add User</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-xs sm:text-sm">
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {users.map((user) => (
          <div key={user.id} className="bg-gray-900 rounded-lg">
            {/* User Info */}
            <div className="p-2.5 sm:p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 sm:p-2 bg-gray-800 rounded-lg">
                    {user.role === 'admin' ? (
                      <Shield className="h-4 w-4 text-red-400" />
                    ) : user.role === 'merchant' ? (
                      <Store className="h-4 w-4 text-purple-400" />
                    ) : (
                      <Users className="h-4 w-4 text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{user.email}</p>
                    <p className="text-[10px] sm:text-xs text-gray-400">
                      {user.role || 'No role assigned'}
                    </p>
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
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
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
            </div>

            {/* Collection Access */}
            {expandedUser === user.id && (
              <div className="px-3 pb-3 border-t border-gray-800 mt-2 pt-3">
                <CollectionAccess userId={user.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <h3 className="text-lg font-semibold mb-4">Create New User</h3>
            
            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={createUserData.email}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={createUserData.password}
                    onChange={(e) => setCreateUserData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Role</label>
                <select
                  value={createUserData.role}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, role: e.target.value as 'admin' | 'merchant' | 'user' }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="user">User</option>
                  <option value="merchant">Merchant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 sm:gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            
            <form onSubmit={updateUser} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue={editingUser.email}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    minLength={8}
                    placeholder="Leave blank to keep current password"
                    className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Role</label>
                <select
                  name="role"
                  defaultValue={editingUser.role}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="user">User</option>
                  <option value="merchant">Merchant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 sm:gap-3 mt-6">
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
                  className="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <h3 className="text-lg font-semibold mb-4">Delete User</h3>
            
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingUser(null);
                }}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(deletingUser.id)}
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