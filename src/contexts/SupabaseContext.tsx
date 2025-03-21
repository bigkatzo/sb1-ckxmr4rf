import { createContext, useContext } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

interface SupabaseContextType {
  supabase: SupabaseClient<Database>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}

interface SupabaseProviderProps {
  supabase: SupabaseClient<Database>;
  children: React.ReactNode;
}

export function SupabaseProvider({ supabase, children }: SupabaseProviderProps) {
  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
} 