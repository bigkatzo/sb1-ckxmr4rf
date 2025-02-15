import React, { useState } from 'react';
import { UserManagement } from '../../components/admin/UserManagement';
import { WalletManagement } from '../../components/admin/WalletManagement';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Tabs } from '../../components/ui/Tabs';
import { toast } from 'react-toastify';

const tabs = [
  { id: 'users', label: 'Users' },
  { id: 'wallets', label: 'Wallets' }
];

export function AdminDashboard() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function checkAdmin() {
      try {
        // First verify we have a session
        if (!session?.user?.id) {
          setError('Please sign in to access admin settings');
          setIsAdmin(false);
          return;
        }

        // Check admin status using the debug function first
        const { data: debugData, error: debugError } = await supabase.rpc('debug_admin_access');
        
        if (debugError) {
          console.error('Error checking admin access:', debugError);
          setError('Error verifying admin access. Please try again.');
          setIsAdmin(false);
          return;
        }

        // Log debug info for troubleshooting
        console.log('Admin access debug info:', debugData);

        // Check for error in debug data
        if (debugData.error) {
          setError(`Admin access error: ${debugData.error}`);
          setIsAdmin(false);
          return;
        }

        // Check if user has admin access
        if (!debugData.is_admin) {
          // Get detailed error message from debug data
          const errorDetails = [
            !debugData.profile_exists && 'No user profile found',
            debugData.profile_exists && debugData.profile_role !== 'admin' && 'User profile does not have admin role',
            debugData.metadata_role !== 'admin' && 'User metadata does not reflect admin role'
          ].filter(Boolean).join(', ');

          setError(`You do not have admin access. ${errorDetails}`);
          setIsAdmin(false);
          return;
        }

        // Double check with is_admin function
        const { data: isAdminCheck, error: adminError } = await supabase.rpc('is_admin');
        
        if (adminError) {
          console.error('Error in secondary admin check:', adminError);
          setError('Error verifying admin access. Please try again.');
          setIsAdmin(false);
          return;
        }

        if (!isAdminCheck) {
          setError('Admin access verification failed. Please contact support if you believe this is an error.');
          setIsAdmin(false);
          return;
        }

        setIsAdmin(true);
        setError(null);
      } catch (err) {
        console.error('Unexpected error checking admin status:', err);
        setError('An unexpected error occurred while verifying admin access. Please try again.');
        setIsAdmin(false);
      }
    }

    checkAdmin();
  }, [session]);

  if (isAdmin === null) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!isAdmin) {
    if (error) {
      toast.error(error);
    }
    return <Navigate to="/merchant/dashboard" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="mb-6">
        <Tabs
          tabs={tabs}
          activeId={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'wallets' && <WalletManagement />}
    </div>
  );
}