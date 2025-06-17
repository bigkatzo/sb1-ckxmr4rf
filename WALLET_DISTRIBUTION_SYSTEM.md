# Wallet Distribution System for Smart Contract Integration

## Overview

The wallet distribution system is designed to support both team-based revenue sharing and future smart contract automation. It maintains clean separation between platform users and external wallets while ensuring all distributions have valid wallet addresses.

## Share Types

### 1. **User-Based Shares** (`is_standalone_wallet = false`)
- **Purpose**: Team members with platform access (collaborators, editors, viewers, owners)
- **Wallet Source**: Automatically inherited from `user_profiles.payout_wallet`
- **Auto-Sync**: When users update their profile wallet, all their shares update automatically
- **Context**: Full platform user context (roles, verification, access levels)

### 2. **Standalone Wallet Shares** (`is_standalone_wallet = true`)
- **Purpose**: External parties, funds, or entities not on the platform
- **Wallet Source**: Direct wallet address input with validation
- **Custom Names**: "Marketing Fund", "Development Team", "Investor Pool", etc.
- **No User Context**: Pure wallet address and percentage allocation

## Smart Contract Integration

### Data Query Examples

```sql
-- Get all wallet distributions for a collection (what smart contracts will call)
SELECT * FROM get_collection_wallet_distributions('collection-uuid');

-- Returns:
-- wallet_address               | recipient_name    | share_percentage | share_type      | user_id | is_platform_user
-- ----------------------------|-------------------|------------------|-----------------|---------|------------------
-- 5fK8...2mN9 (owner wallet)  | John Doe         | 50.00           | platform_user   | uuid    | true
-- 7gL9...3nP1 (editor wallet) | Jane Smith       | 20.00           | platform_user   | uuid    | true
-- 2aB3...8xQ7 (external)      | Marketing Fund   | 20.00           | external_wallet | null    | false
-- 9cD4...1yR5 (external)      | Dev Team         | 10.00           | external_wallet | null    | false
```

### Smart Contract Ready JSON Format

```sql
-- Get distribution data in smart contract format
SELECT get_smart_contract_distributions('collection-uuid');

-- Returns:
{
  "collection_id": "collection-uuid",
  "total_percentage": 100,
  "is_valid": true,
  "timestamp": "2025-01-03T10:30:00Z",
  "distributions": [
    {
      "wallet": "5fK8...2mN9",
      "percentage": 50.00,
      "recipient": "John Doe",
      "type": "platform_user"
    },
    {
      "wallet": "7gL9...3nP1", 
      "percentage": 20.00,
      "recipient": "Jane Smith",
      "type": "platform_user"
    },
    {
      "wallet": "2aB3...8xQ7",
      "percentage": 20.00,
      "recipient": "Marketing Fund",
      "type": "external_wallet"
    },
    {
      "wallet": "9cD4...1yR5",
      "percentage": 10.00,
      "recipient": "Dev Team", 
      "type": "external_wallet"
    }
  ]
}
```

### Smart Contract Validation

```sql
-- Validate collection is ready for smart contract deployment
SELECT validate_collection_for_smart_contract('collection-uuid');

-- Returns:
{
  "collection_id": "collection-uuid",
  "is_ready": true,
  "total_shares": 4,
  "total_percentage": 100,
  "valid_wallets": 4,
  "missing_wallets": 0,
  "issues": [],
  "validated_at": "2025-01-03T10:30:00Z"
}
```

## User Workflow

### Adding Platform User Share
1. Click "Finance Management" → "Add Share"  
2. Select "Platform User" → Choose team member
3. Set percentage → User's wallet auto-populated from profile
4. Save → Ready for smart contract

### Adding External Wallet Share  
1. Click "Finance Management" → "Add Share"
2. Select "External Wallet" → Enter wallet address
3. Enter custom name (e.g., "Marketing Fund")
4. Set percentage → Save → Ready for smart contract

## Database Schema

```sql
-- Enhanced collection_individual_shares table
collection_individual_shares:
  - user_id (UUID, optional)           -- NULL for standalone wallets
  - wallet_address (TEXT)              -- Always populated
  - share_name (TEXT)                  -- Custom name for standalone wallets  
  - share_percentage (DECIMAL)         -- 0-100%
  - is_standalone_wallet (BOOLEAN)     -- true/false
  - is_active (BOOLEAN)                -- For soft deletion
  - effective_from/until (TIMESTAMP)   -- Time-based activation
```

## Smart Contract Benefits

✅ **Clean Data Structure**: Simple wallet + percentage pairs  
✅ **Validation Built-In**: Ensures 100% total, valid wallet addresses  
✅ **Auto-Sync**: User profile changes propagate automatically  
✅ **Type Safety**: Clear distinction between user and external wallets  
✅ **Time-Based**: Support for future/expiring distributions  
✅ **Query Optimized**: Fast lookups for smart contract calls  

## Future Smart Contract Implementation

When smart contracts are deployed, they will:

1. **Query Collection Distributions**: `get_smart_contract_distributions(collection_id)`
2. **Validate Readiness**: `validate_collection_for_smart_contract(collection_id)`  
3. **Execute Payments**: Distribute funds to wallet addresses based on percentages
4. **Handle Updates**: Re-query when distributions change
5. **Support Collaborator Items**: Factor in item-specific attribution

## Example Use Cases

### **Collection: "Digital Art Marketplace"**
- **Owner**: 50% → `5fK8...2mN9` (auto from profile)
- **Lead Artist**: 30% → `7gL9...3nP1` (auto from profile)  
- **Marketing Fund**: 15% → `2aB3...8xQ7` (external wallet)
- **Platform Fee**: 5% → `9cD4...1yR5` (external wallet)

### **Collection: "Music Production Studio"**
- **Producer**: 40% → `1aB2...4cD5` (auto from profile)
- **Artist**: 35% → `6eF7...9gH0` (auto from profile)
- **Studio Rental**: 15% → `2bC3...5dE6` (external wallet)
- **Equipment Fund**: 10% → `7fG8...0hI1` (external wallet)

This system ensures perfect organization for smart contract integration while maintaining user-friendly management for platform teams. 