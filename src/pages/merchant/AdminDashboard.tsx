import React, { useState } from 'react';
import { UserManagement } from '../../components/admin/UserManagement';
import { WalletManagement } from '../../components/admin/WalletManagement';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Tabs } from '../../components/ui/Tabs';

const tabs = [
  { id: 'users', label: 'Users' },
  { id: 'wallets', label: 'Wallets' }
];

export function AdminDashboard() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    async function checkAdmin() {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session?.user?.id)
        .single();

      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data?.role === 'admin');
    }

    if (session?.user) {
      checkAdmin();
    }
  }, [session]);

  if (isAdmin === null) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/merchant/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-800 pb-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Admin Settings</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">Manage users, wallets, and system settings</p>
      </div>

      <div className="border-b border-gray-800 -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="px-4 sm:px-6 lg:px-8">
          <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'wallets' && <WalletManagement />}
      </div>
    </div>
  );
}