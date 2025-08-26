# Authentication Flow Test

## Current Flow

1. **User connects Privy wallet**
2. **WalletContext attempts Supabase authentication**
3. **If user doesn't exist**: Create user via `supabase.auth.signUp()`
4. **If email confirmation fails**: Use Netlify function as fallback
5. **If all else fails**: Continue with wallet headers only

## Test Cases

### Test Case 1: New Wallet User

**Steps:**
1. Disconnect wallet if connected
2. Clear browser storage/localStorage
3. Connect wallet
4. Check console logs

**Expected Logs:**
```
🔐 Authenticating to Supabase with wallet: [wallet_address]
User does not exist, creating new wallet user...
✅ Wallet user created successfully
✅ Got session from signup
```

**Expected Result:**
- Supabase Auth: Yes
- Session Token: Yes
- Design page loads without redirects

### Test Case 2: Existing Wallet User (Confirmed)

**Steps:**
1. Connect wallet (should work from Test Case 1)
2. Disconnect and reconnect
3. Check console logs

**Expected Logs:**
```
🔐 Authenticating to Supabase with wallet: [wallet_address]
✅ Wallet user signed in successfully
```

**Expected Result:**
- Supabase Auth: Yes
- Session Token: Yes
- Design page loads without redirects

### Test Case 3: Existing Wallet User (Unconfirmed)

**Steps:**
1. Create a wallet user manually in Supabase (unconfirmed)
2. Connect wallet
3. Check console logs

**Expected Logs:**
```
🔐 Authenticating to Supabase with wallet: [wallet_address]
⚠️ Email not confirmed for existing wallet user
🔄 Trying Netlify function to handle email confirmation...
✅ Wallet user authenticated successfully via Netlify function
```

**Expected Result:**
- Supabase Auth: Yes
- Session Token: Yes
- Design page loads without redirects

### Test Case 4: Fallback to Wallet Headers

**Steps:**
1. Disable Netlify function (rename file)
2. Connect wallet
3. Check console logs

**Expected Logs:**
```
🔐 Authenticating to Supabase with wallet: [wallet_address]
User does not exist, creating new wallet user...
✅ Wallet user created successfully
⚠️ User created but email confirmation required, trying to sign in...
⚠️ Sign in failed after user creation: Email not confirmed
🔄 Trying Netlify function fallback...
Error calling Netlify function: [error]
✓ Creating Supabase client
```

**Expected Result:**
- Supabase Auth: No
- Session Token: No
- Client Auth: Yes (wallet headers)
- Design page loads without redirects

## Debug Commands

### Check Current User in Supabase

```sql
-- Check if wallet user exists
SELECT id, email, email_confirmed_at, confirmed_at 
FROM auth.users 
WHERE email LIKE '%@wallet.local';

-- Check user metadata
SELECT id, email, raw_user_meta_data, raw_app_meta_data
FROM auth.users 
WHERE email LIKE '%@wallet.local';
```

### Check RLS Policies

```sql
-- Test the check_design_access function
SELECT check_design_access('product_id_here');

-- Check if wallet headers are being received
SELECT auth.get_header_values();
```

### Check Netlify Function

```bash
# Test the Netlify function locally
curl -X POST http://localhost:8888/.netlify/functions/create-wallet-user \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "CP9mCLHEk2j9L6RTndQnHoUkyH8qZeEfTgEDtvqcL3Yn"}'
```

## Common Issues

### Issue 1: "Invalid login credentials" after user creation

**Cause:** User created but email not confirmed
**Solution:** Netlify function should handle this

### Issue 2: Netlify function fails

**Cause:** Missing environment variables or service role key
**Solution:** Check `SUPABASE_SERVICE_ROLE_KEY` is set

### Issue 3: Design page still redirects

**Cause:** RLS policies not working with wallet headers
**Solution:** Check `check_design_access` function

### Issue 4: Multiple authentication attempts

**Cause:** Race conditions in authentication flow
**Solution:** Check for proper error handling and state management

## Success Criteria

✅ **Wallet connects successfully**
✅ **Supabase authentication works (with or without fallback)**
✅ **Design page loads without redirects**
✅ **RLS policies work correctly**
✅ **No console errors**
✅ **Auth Status shows correct state**

## Monitoring

Use the Auth Status debug component to monitor:
- Wallet connection status
- Privy authentication status
- Supabase authentication status
- Session token availability
- Client authentication status

The key is that **at least one authentication method should work**:
1. **Primary**: Supabase JWT authentication
2. **Fallback**: Netlify function with service role
3. **Last resort**: Wallet headers only
