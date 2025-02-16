import React, { useState, useEffect } from 'react';
import { Users, Shield, Store, Plus, X, ChevronDown, ChevronUp, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase, adminQuery, withRetry, safeQuery } from '../../lib/supabase';
import { CollectionAccess } from './CollectionAccess';
import { toast } from 'react-toastify';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'merchant' | 'user';
  created_at: string;
}

interface CreateUserData {
  username: string;
  password: string;
  role: 'admin' | 'merchant' | 'user';
}

// Helper function to validate admin access
async function validateAdminAccess() {
  try {
    const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_admin');
    
    if (adminCheckError || !isAdmin) {
      const isProduction = import.meta.env.PROD;
      const errorMessage = isProduction
        ? 'Admin features are disabled in production. Please check Netlify environment variables.'
        : 'Admin features are disabled in development. Please check your database configuration.';
      throw new Error(errorMessage);
    }
  } catch (error) {
    throw new Error('Failed to verify admin access: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
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
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    username: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        await validateAdminAccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to verify admin access';
        setError(message);
        toast.error(message);
      }
    };
    
    checkAdmin();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      setError(null);

      await validateAdminAccess();

      const { data, error } = await withRetry(async () => {
        return adminQuery(async (client) => {
          const response = await client.rpc('list_users');
          if (response.error) throw response.error;
          return response;
        });
      });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreating(true);
      setError(null);

      await validateAdminAccess();

      if (!createUserData.username || !createUserData.password) {
        throw new Error('Username and password are required');
      }

      await withRetry(async () => {
        return adminQuery(async (client) => {
          const { data: userId, error: createError } = await client.rpc(
            'create_user_with_username',
            {
              p_username: createUserData.username,
              p_password: createUserData.password,
              p_role: createUserData.role
            }
          );

          if (createError) throw createError;
          if (!userId) throw new Error('Failed to create user - no user ID returned');

          return userId;
        });
      });

      setCreateUserData({ username: '', password: '', role: 'user' });
      setShowCreateModal(false);
      await fetchUsers();
      toast.success('User created successfully');
    } catch (err) {
      console.error('Error creating user:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await validateAdminAccess();

      const formData = new FormData(e.target as HTMLFormElement);
      const role = formData.get('role') as 'admin' | 'merchant' | 'user';
      const password = formData.get('password') as string;

      await withRetry(async () => {
        return adminQuery(async (client) => {
          // Update role
          const { error: roleError } = await client.rpc('manage_user_role', {
            p_user_id: editingUser.id,
            p_role: role
          });

          if (roleError) throw roleError;

          // Update password if provided
          if (password) {
            const { error: passwordError } = await client.rpc('change_user_password', {
              p_user_id: editingUser.id,
              p_new_password: password
            });

            if (passwordError) throw passwordError;
          }
        });
      });

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
      await validateAdminAccess();

      await withRetry(async () => {
        return adminQuery(async (client) => {
          const { error: deleteError } = await client.rpc('delete_user', {
            p_user_id: userId
          });

          if (deleteError) throw deleteError;
        });
      });

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

            {expandedUser === user.id && (
              <div className="px-3 pb-3 border-t border-gray-800 mt-2 pt-3">
                <CollectionAccess userId={user.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <h3 className="text-lg font-semibold mb-4">Create New User</h3>
            
            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  value={createUserData.username}
                  onChange={(e) => setCreateUserData(prev => ({ ...prev, username: e.target.value }))}
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

      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-4">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            
            <form onSubmit={updateUser} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Username</label>
                <input
                  type="text"
                  name="username"
                  required
                  defaultValue={editingUser.email.split('@')[0]}
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