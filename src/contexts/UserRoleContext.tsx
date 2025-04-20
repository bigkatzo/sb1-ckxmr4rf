import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Define role types
export type UserRole = 'admin' | 'merchant' | 'user';

// Interface for the context
interface UserRoleContextType {
  role: UserRole | null;
  isAdmin: boolean;
  isMerchant: boolean;
  loading: boolean;
  refreshRole: () => Promise<void>;
}

// Creating the context with default values
const UserRoleContext = createContext<UserRoleContextType>({
  role: null,
  isAdmin: false,
  isMerchant: false,
  loading: true,
  refreshRole: async () => {}
});

// Provider component
export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch user role
  const fetchUserRole = async () => {
    if (!session?.user?.id) {
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      // Fetch user profile from the database
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } else {
        setRole((profile?.role as UserRole) || 'user');
      }
    } catch (err) {
      console.error('Unexpected error fetching role:', err);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  // Refresh role function for external use
  const refreshRole = async () => {
    setLoading(true);
    await fetchUserRole();
  };

  // Fetch the role when session changes
  useEffect(() => {
    if (!authLoading) {
      fetchUserRole();
    }
  }, [session, authLoading]);

  // Derived values for convenience
  const isAdmin = role === 'admin';
  const isMerchant = role === 'admin' || role === 'merchant';

  return (
    <UserRoleContext.Provider value={{ 
      role, 
      isAdmin, 
      isMerchant, 
      loading: loading || authLoading,
      refreshRole 
    }}>
      {children}
    </UserRoleContext.Provider>
  );
}

// Custom hook to use the role context
export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
} 