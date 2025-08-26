# Authentication Testing Guide

## Current Issue

The authentication flow was failing with "Email not confirmed" error. This happens because:

1. When a new wallet user is created via `supabase.auth.signUp()`, Supabase requires email confirmation by default
2. The wallet email (`wallet_address@wallet.local`) is not a real email, so confirmation fails
3. This prevents the user from accessing design pages due to RLS policy restrictions

## Current Solution

The current implementation handles this gracefully by:

1. **Attempting Supabase authentication** when wallet connects
2. **Creating wallet user** if it doesn't exist
3. **Continuing without Supabase auth** if email confirmation fails
4. **Using wallet headers** for RLS policies instead of JWT authentication

## Testing Steps

### 1. Check Authentication Status

In development mode, look for the **Auth Status** debug component in the bottom-right corner:

```
🔐 Auth Status
Wallet: CP9mCLHEk2j9L6RTndQnHoUkyH8qZeEfTgEDtvqcL3Yn
Connected: Yes
Privy Auth: Yes
Supabase Auth: No (expected if email confirmation fails)
Session Token: No (expected if email confirmation fails)
Client Auth: Yes (should work with wallet headers)
```

### 2. Test Design Page Access

1. Connect wallet via Privy
2. Navigate to a product page: `/:collectionSlug/:productSlug`
3. Click "View Design Files" or navigate to `/:collectionSlug/:productSlug/design`
4. **Expected behavior**: Page should load without redirecting back to product page

### 3. Check Console Logs

Look for these log messages:

```
✅ Wallet connected successfully, creating auth token...
🔐 Authenticating to Supabase with wallet: CP9mCLHEk2j9L6RTndQnHoUkyH8qZeEfTgEDtvqcL3Yn
User does not exist, creating new wallet user...
✅ Wallet user created successfully
⚠️ User created but email confirmation required
✓ Creating Supabase client
```

### 4. Run Auth Test

Click the "Run Auth Test" button in the Auth Status component. You should see:

```
✅ Authentication test passed! All systems working.
```

## Expected Behavior

### ✅ Working Scenario
- Wallet connects successfully
- Supabase authentication fails gracefully (email confirmation issue)
- App continues to work with wallet headers
- Design page loads without redirects
- RLS policies work via wallet address headers

### ❌ Broken Scenario
- Design page redirects back to product page
- Console shows authentication errors
- RLS policies blocking access

## Debugging

### If Design Page Still Redirects

1. **Check RLS Policies**: Ensure the `check_design_access` function works with wallet headers
2. **Check Wallet Headers**: Verify `X-Wallet-Address` header is being sent
3. **Check Database**: Ensure wallet address is properly stored in orders table

### If Authentication Fails Completely

1. **Check Supabase Settings**: Email confirmation might be disabled
2. **Check Environment Variables**: Ensure Supabase URL and keys are correct
3. **Check Network**: Ensure Supabase requests are not blocked

## Alternative Solutions

If the current approach doesn't work, consider:

1. **Disable Email Confirmation**: Configure Supabase to not require email confirmation
2. **Use Service Role**: Create users with service role key (more complex)
3. **Custom Authentication**: Implement custom JWT tokens (advanced)

## Current Status

The solution should work with the following flow:

1. User connects Privy wallet ✅
2. WalletContext attempts Supabase auth ✅
3. If email confirmation fails, continue gracefully ✅
4. Use wallet headers for RLS policies ✅
5. Design page loads without redirects ✅

The key insight is that **Supabase authentication is not required** for the app to work. The wallet headers provide sufficient authentication for RLS policies.
