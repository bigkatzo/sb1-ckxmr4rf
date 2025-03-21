import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Shield, Store, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CollectionAccess } from './CollectionAccess';
import { toast } from 'react-toastify';
import { RefreshButton } from '../ui/RefreshButton';
import { Pagination } from '../ui/Pagination';
import { debounce } from 'lodash';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'merchant' | 'user';
  created_at: string;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
const USERS_PER_PAGE = 10;

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Cache ref to store user data
  const cacheRef = useRef<{
    data: User[];
    timestamp: number;
    total: number;
  } | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      fetchUsers(1, term);
    }, 300),
    []
  );

  const fetchUsers = useCallback(async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      setError(null);

      // Check cache if no search term and cache is valid
      if (!search && cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_DURATION) {
        const start = (page - 1) * USERS_PER_PAGE;
        const end = start + USERS_PER_PAGE;
        setUsers(cacheRef.current.data.slice(start, end));
        setTotalUsers(cacheRef.current.total);
        setLoading(false);
        return;
      }

      // Fetch total count
      const countQuery = supabase
        .from('user_profiles')
        .select('id', { count: 'exact' });

      if (search) {
        countQuery.ilike('email', `%${search}%`);
      }

      const { count, error: countError } = await countQuery;

      if (countError) throw countError;
      setTotalUsers(count || 0);

      // Fetch users for current page
      const start = (page - 1) * USERS_PER_PAGE;
      let query = supabase
        .from('user_profiles')
        .select('*')
        .range(start, start + USERS_PER_PAGE - 1)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('email', `%${search}%`);
      }

      const { data: users, error: usersError } = await query;

      if (usersError) throw usersError;

      // Update cache if no search term
      if (!search) {
        cacheRef.current = {
          data: users,
          timestamp: Date.now(),
          total: count || 0
        };
      }

      setUsers(users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search input
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    debouncedSearch(e.target.value);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchUsers(page, searchTerm);
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-semibold">User Management</h2>
          <RefreshButton onRefresh={() => fetchUsers(currentPage, searchTerm)} className="scale-90" />
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={handleSearch}
            className="pl-3 pr-8 py-1.5 rounded-lg bg-gray-800 text-white placeholder-gray-400 border border-gray-700 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
          {error}
        </div>
      )}

      <div className="relative overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs uppercase bg-gray-800">
            <tr>
              <th scope="col" className="px-6 py-3">Email</th>
              <th scope="col" className="px-6 py-3">Role</th>
              <th scope="col" className="px-6 py-3">Created At</th>
              <th scope="col" className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading users...</span>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center">
                  No users found
                  {searchTerm && ' matching your search'}
                </td>
              </tr>
            ) : (
              users.map(user => (
                <React.Fragment key={user.id}>
                  <tr className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-6 py-4 font-medium text-white">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-900/50 text-purple-300'
                          : user.role === 'merchant'
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-gray-800 text-gray-300'
                      }`}>
                        {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                        {user.role === 'merchant' && <Store className="w-3 h-3 mr-1" />}
                        {user.role === 'user' && <Users className="w-3 h-3 mr-1" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setShowEditModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingUser(user);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          {expandedUser === user.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUser === user.id && (
                    <tr className="border-b border-gray-800">
                      <td colSpan={4} className="px-6 py-4 bg-gray-900/50">
                        <CollectionAccess userId={user.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && users.length > 0 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalUsers / USERS_PER_PAGE)}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const { error } = await supabase
                  .from('user_profiles')
                  .update({ role: editingUser.role })
                  .eq('id', editingUser.id);
                
                if (error) throw error;
                
                toast.success('User updated successfully');
                fetchUsers(currentPage, searchTerm);
              } catch (err) {
                console.error('Error updating user:', err);
                toast.error('Failed to update user');
              } finally {
                setShowEditModal(false);
                setEditingUser(null);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingUser.email}
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as User['role'] })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="user">User</option>
                    <option value="merchant">Merchant</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && deletingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Delete User</h3>
            <p className="text-gray-400">
              Are you sure you want to delete the user <span className="text-white">{deletingUser.email}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingUser(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('user_profiles')
                      .delete()
                      .eq('id', deletingUser.id);
                    
                    if (error) throw error;
                    
                    toast.success('User deleted successfully');
                    fetchUsers(currentPage, searchTerm);
                  } catch (err) {
                    console.error('Error deleting user:', err);
                    toast.error('Failed to delete user');
                  } finally {
                    setShowDeleteModal(false);
                    setDeletingUser(null);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
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