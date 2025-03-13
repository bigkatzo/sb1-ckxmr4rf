import React, { useState } from 'react';
import { UserManagement } from '../../components/admin/UserManagement';
import { WalletManagement } from '../../components/admin/WalletManagement';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Tabs } from '../../components/ui/Tabs';
import { toast } from 'react-toastify';
import { ArrowLeft } from 'lucide-react';
import { Loading, LoadingType } from '../../components/ui/LoadingStates';

const tabs = [
  { id: 'users', label: 'Users' },
  { id: 'wallets', label: 'Wallets' }
];

export function AdminDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function checkAdmin() {
      try {
        // First verify we have a session
        if (!session?.user?.id) {
          setError('Please sign in to access admin settings');
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Check if user has admin role
        const { data: profile, error: adminError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (adminError) {
          console.error('Error checking admin status:', adminError);
          setError('Error verifying admin access');
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        if (!profile || profile.role !== 'admin') {
          setError('You do not have admin access');
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);
        setError(null);
      } catch (err) {
        console.error('Unexpected error checking admin status:', err);
        setError('An unexpected error occurred');
        setIsAdmin(false);
        setLoading(false);
      }
    }

    checkAdmin();
  }, [session]);

  if (loading) {
    return <Loading type={LoadingType.PAGE} text="Loading admin dashboard..." />;
  }

  if (isAdmin === null) {
    return <Loading type={LoadingType.PAGE} text="Verifying admin access..." />;
  }

  if (!isAdmin) {
    if (error) {
      toast.error(error);
    }
    return <Navigate to="/merchant/dashboard" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/merchant/dashboard')}
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
            title="Back to Merchant Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
      </div>
      
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