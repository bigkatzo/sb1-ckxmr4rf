import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ShoppingBag, AlertCircle } from 'lucide-react';

export function SignInPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      // Validate input
      if (!username || !password) {
        throw new Error('Please enter both username and password');
      }

      // Sign in with email/password
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: `${username.trim()}@merchant.local`,
        password: password.trim()
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          throw new Error('Invalid username or password');
        }
        throw signInError;
      }

      if (!data.user) {
        throw new Error('No user data returned');
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('Profile fetch warning:', profileError);
        // Don't throw - user might not have profile yet
      }

      // Check for collection access
      const [{ data: collections }, { data: access }] = await Promise.all([
        supabase
          .from('collections')
          .select('id')
          .eq('user_id', data.user.id)
          .limit(1),
        supabase
          .from('collection_access')
          .select('id')
          .eq('user_id', data.user.id)
          .limit(1)
      ]);

      // Allow access if user has:
      // 1. A role in user_profiles
      // 2. Owned collections
      // 3. Collection access grants
      const hasAccess = 
        profile?.role || 
        (collections && collections.length > 0) ||
        (access && access.length > 0);

      if (!hasAccess) {
        throw new Error('You do not have access to the merchant dashboard. Please contact support.');
      }

      // Redirect to dashboard
      navigate('/merchant/dashboard');
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600 mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">Merchant Dashboard</h1>
          <p className="text-gray-400 mt-2">Sign in to manage your collections</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-2">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}