import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAccess() {
      if (!session?.user) {
        setHasAccess(false);
        return;
      }

      try {
        // Check for collections or collection access first
        const [{ data: collections }, { data: access }] = await Promise.all([
          supabase
            .from('collections')
            .select('id')
            .eq('user_id', session.user.id)
            .limit(1),
          supabase
            .from('collection_access')
            .select('id')
            .eq('user_id', session.user.id)
            .limit(1)
        ]);

        // If user has collections or access, they can enter
        if ((collections?.length ?? 0) > 0 || (access?.length ?? 0) > 0) {
          setHasAccess(true);
          return;
        }

        // Otherwise check user profile role
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        // Allow access for any role - permissions will be handled by individual components
        setHasAccess(!!profile);
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
      }
    }

    checkAccess();
  }, [session]);

  if (authLoading || hasAccess === null) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!session || !hasAccess) {
    return <Navigate to="/merchant/signin" replace />;
  }

  return <>{children}</>;
}