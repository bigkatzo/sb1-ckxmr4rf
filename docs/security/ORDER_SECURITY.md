# Order Security Model

This document describes the security architecture for order data in our system, addressing and fixing a previously identified high-risk vulnerability.

## Previous Vulnerability

**Unrestricted Access to Customer Order Data**
- **Risk Level**: High
- **Description**: The `user_orders` view contained highly sensitive user data including personal shipping addresses. Due to misconfigured Row Level Security (RLS), this data was accessible to all authenticated users.
- **Impact**: The vulnerability allowed access to PII including names, addresses, and contact details, representing a severe privacy breach.

## Solution Implemented

We've implemented a comprehensive security model that enforces wallet-based authentication while maintaining the existing API surface:

### 1. Row Level Security (RLS) Policy

The primary security mechanism is a properly configured RLS policy on the underlying `orders` table:

```sql
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Users can only view their own orders by matching wallet address from JWT
    wallet_address = auth.jwt()->>'wallet_address'
);
```

This policy ensures that users can only access orders associated with their authenticated wallet address, enforced at the database level.

### 2. View Design

We've redesigned the `user_orders` view to ensure:
- The view doesn't include filtering logic, allowing the RLS policy to take effect
- All necessary data is included without overexposing information
- The view works seamlessly with the existing frontend code

### 3. JWT-Based Authentication

Our approach maintains the Solana-centered authentication methodology:
- Authentication is still based on wallet signatures
- JWT tokens contain the authenticated wallet address
- Database policies refer to this JWT claim for access control

### 4. Role-Based Access

In addition to user-specific policies, we maintain separate policies for:
- **Merchants**: Can only see orders for their own collections
- **Admins**: Can access all orders through the `merchant_orders` view
- **Public**: Can only access anonymous order count data for visible collections

## Testing and Verification

We've created a comprehensive test script (`scripts/security/test_rls_policies.sql`) that validates:
- Anonymous users get zero results from the orders view
- Authenticated users only see orders matching their wallet address
- Different wallet users see different subsets of orders
- Admins can access orders through the merchant views

## Security Principles

This implementation follows several key principles:

1. **Defense in Depth**: Security is enforced at multiple layers (database, API, application)
2. **Least Privilege**: Users can only access the minimum data needed for their functions
3. **Separation of Concerns**: Views handle data presentation, policies handle access control
4. **Maintainability**: The solution works with the existing application code without changes

## Next Steps

1. Run the test script in each environment to verify correct implementation
2. Consider implementing periodic security testing to identify similar issues
3. Document RLS policies and security architecture in the development guidelines 