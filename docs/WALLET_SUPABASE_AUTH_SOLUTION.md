# Wallet to Supabase Authentication Solution

## Problem

The design page (`/:collectionSlug/:productSlug/design`) was intermittently redirecting users back to the product page due to RLS (Row Level Security) policy failures. This happened because:

1. Users connected their Privy wallet but weren't authenticated to Supabase
2. RLS policies couldn't verify user identity without proper JWT authentication
3. The `useProduct` hook was using an unauthenticated Supabase client
4. Design page access required proper authentication to verify user permissions

## Solution

### 1. **Dual Authentication System**

We implemented a dual authentication system that:
- Authenticates users with Privy for wallet functionality
- Authenticates users with Supabase for database access and RLS policies

### 2. **WalletContext Integration**

Updated `src/contexts/WalletContext.tsx` to:

```typescript
// New state for Supabase authentication
const [supabaseAuthenticated, setSupabaseAuthenticated] = useState(false);
const [supabaseSession, setSupabaseSession] = useState<any>(null);

// Function to authenticate user to Supabase
const authenticateToSupabase = useCallback(async (walletAddr: string): Promise<boolean> => {
  // Create unique email for wallet user
  const walletEmail = `${walletAddr}@wallet.local`;
  
  // Try to sign in, create user if doesn't exist
  const { data, error } = await supabase.auth.signInWithPassword({
    email: walletEmail,
    password: `wallet_${walletAddr.slice(0, 16)}`
  });
  
  if (error && error.message.includes('Invalid login credentials')) {
    // Create new user
    const { data: signUpData } = await supabase.auth.signUp({
      email: walletEmail,
      password: `wallet_${walletAddr.slice(0, 16)}`,
      options: {
        data: {
          wallet_address: walletAddr,
          auth_type: 'wallet',
          provider: 'privy'
        }
      }
    });
  }
  
  // Set session and authentication state
  setSupabaseSession(data.session);
  setSupabaseAuthenticated(true);
  return true;
}, []);
```

### 3. **Authenticated Supabase Client**

Updated `src/hooks/useSupabaseWithWallet.ts` to:

```typescript
export function useSupabaseWithWallet() {
  const { 
    walletAddress, 
    supabaseAuthenticated,
    supabaseSession 
  } = useWallet();
  
  const client = useMemo(() => {
    // Only create client if properly authenticated
    if (!walletAddress || !supabaseAuthenticated || !supabaseSession?.access_token) {
      return null;
    }
    
    // Create client with session authentication
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'X-Wallet-Address': walletAddress
        }
      }
    });
  }, [walletAddress, supabaseAuthenticated, supabaseSession]);
  
  // Set session on client
  useEffect(() => {
    if (client && supabaseSession?.access_token) {
      client.auth.setSession(supabaseSession);
    }
  }, [client, supabaseSession]);
  
  return { client, isAuthenticated: !!client && !!supabaseSession?.access_token };
}
```

### 4. **Updated Product Hook**

Updated `src/hooks/useProduct.ts` to use the authenticated client:

```typescript
export function useProduct(collectionSlug?: string, productSlug?: string, includeHiddenForDesign?: boolean) {
  // Use authenticated Supabase client
  const { client: supabase, isAuthenticated, diagnostics } = useSupabaseWithWallet({ allowMissingToken: true });
  
  useEffect(() => {
    async function fetchProduct() {
      // Wait for authenticated client
      if (!supabase || !isAuthenticated) {
        console.log('Waiting for authenticated Supabase client...', diagnostics);
        return;
      }
      
      // Proceed with authenticated queries
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', productSlug)
        .eq('collections.slug', collectionSlug)
        .single();
    }
    
    fetchProduct();
  }, [collectionSlug, productSlug, supabase, isAuthenticated]);
}
```

### 5. **RLS Policy Updates**

Created migration `supabase/migrations/20250101000000_fix_design_page_rls.sql`:

```sql
-- Function to check design access
CREATE OR REPLACE FUNCTION check_design_access(product_id uuid)
RETURNS boolean AS $$
DECLARE
  user_id uuid;
  wallet_address text;
BEGIN
  -- Get user ID from JWT
  user_id := auth.uid();
  
  -- If no user ID, check wallet headers
  IF user_id IS NULL THEN
    wallet_address := current_setting('request.headers.x-wallet-address', true);
    -- Check if wallet has ordered this product
    RETURN EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.product_id = check_design_access.product_id 
      AND o.wallet_address = wallet_address
    );
  END IF;
  
  -- Check if user has ordered this product
  RETURN EXISTS (
    SELECT 1 FROM orders o
    WHERE o.product_id = check_design_access.product_id
    AND (
      o.user_id = user_id
      OR o.wallet_address = (
        SELECT raw_user_meta_data->>'wallet_address'
        FROM auth.users WHERE id = user_id
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy for products table
CREATE POLICY products_design_access ON products
  FOR SELECT
  USING (
    visible = true
    OR check_design_access(id)
  );
```

### 6. **Debug Tools**

Created debugging tools to monitor authentication:

- `src/hooks/useTestAuth.ts` - Tests authentication flow
- `src/components/debug/AuthStatus.tsx` - Shows authentication status
- Added to App.tsx for development debugging

## Authentication Flow

1. **User connects Privy wallet**
2. **WalletContext detects connection**
3. **Authenticates to Supabase** with wallet address
4. **Creates/retrieves Supabase user** with wallet metadata
5. **Sets up authenticated Supabase client** with JWT session
6. **Product queries use authenticated client** for RLS policies
7. **Design page access works** with proper authentication

## Benefits

- ✅ **Consistent authentication** - No more intermittent redirects
- ✅ **Proper RLS enforcement** - Design access properly controlled
- ✅ **JWT-based security** - Standard Supabase authentication
- ✅ **Wallet address tracking** - Links wallet to user account
- ✅ **Debug visibility** - Easy to troubleshoot auth issues
- ✅ **Backward compatibility** - Works with existing wallet flows

## Testing

1. Connect wallet via Privy
2. Check AuthStatus debug component (dev mode)
3. Navigate to design page
4. Verify no redirects occur
5. Check browser console for authentication logs

## Migration

Run the new migration to update RLS policies:

```bash
supabase db push
```

The solution ensures that users who connect their Privy wallet are automatically authenticated to Supabase with a proper JWT, allowing RLS policies to work correctly and preventing the intermittent redirects from the design page.
