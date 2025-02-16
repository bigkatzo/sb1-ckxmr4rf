import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseServiceKey) throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');

// Initialize Supabase Admin client with service role key
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
); 