import React, { useState, useEffect } from 'react';
import { Users, Shield, Store, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CollectionAccess } from './CollectionAccess';
import { toast } from 'react-toastify';
import { RefreshButton } from '../ui/RefreshButton';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'merchant' | 'user';
  created_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('list_users');

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

  async function updateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const role = formData.get('role') as 'admin' | 'merchant' | 'user';

      // Validate role
      if (!['admin', 'merchant', 'user'].includes(role)) {
        throw new Error('Invalid role selected');
      }

      const { error: roleError } = await supabase.rpc('change_user_role', {
        p_user_id: editingUser.id,
        p_new_role: role
      });

      if (roleError) throw roleError;

      setShowEditModal(false);
      setEditingUser(null);
      await fetchUsers();
      toast.success('User role updated successfully');
    } catch (err) {
      console.error('Error updating user:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user role';
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
            </div>

            {expandedUser === user.id && (
              <div className="px-3 pb-3 border-t border-gray-800 mt-2 pt-3">
                <CollectionAccess userId={user.id} />
              </div>
            )}
          </div>
        ))}
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
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="user">User</option>
                  <option value="merchant">Merchant</option>
                  <option value="admin">Admin</option>
                </select>
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
                  className="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
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