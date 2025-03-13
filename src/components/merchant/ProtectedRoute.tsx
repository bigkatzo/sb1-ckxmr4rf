import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loading, LoadingType } from '../ui/LoadingStates';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return <Loading type={LoadingType.PAGE} text="Checking authentication..." />;
  }

  if (!session) {
    return <Navigate to="/merchant/signin" replace />;
  }

  return <>{children}</>;
}