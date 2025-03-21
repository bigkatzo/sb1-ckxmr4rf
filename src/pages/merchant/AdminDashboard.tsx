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
import { CollectionAccess } from '../../components/admin/CollectionAccess';

export default function AdminDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  if (!session || !session.user) {
    return <Navigate to="/merchant/login" />;
  }

  React.useEffect(() => {
    async function checkAdmin() {
      try {
        console.log('Checking admin status...');
        console.log('Session:', session);
        
        // First verify we have a session
        if (!session?.user?.id) {
          console.log('No session or user ID found');
          setError('Please sign in to access admin settings');
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        console.log('Fetching user profile for ID:', session.user.id);
        // Check if user has admin role
        const { data: profile, error: adminError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        console.log('Profile data:', profile);
        console.log('Admin check error:', adminError);

        if (adminError) {
          console.error('Error checking admin status:', adminError);
          setError('Error verifying admin access');
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        if (!profile || profile.role !== 'admin') {
          console.log('User is not an admin. Role:', profile?.role);
          setError('You do not have admin access');
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        console.log('User verified as admin');
        setIsAdmin(true);
        setError(null);
      } catch (err) {
        console.error('Unexpected error checking admin status:', err);
        setError('An unexpected error occurred');
        setIsAdmin(false);
      } finally {
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

  const tabs = [
    { id: 'users', label: 'Users' },
    { id: 'collections', label: 'Collections' },
    { id: 'wallets', label: 'Wallets' },
  ];

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
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className="mt-8">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'collections' && <CollectionAccess userId={session.user.id} />}
        {activeTab === 'wallets' && <WalletManagement />}
      </div>
    </div>
  );
}