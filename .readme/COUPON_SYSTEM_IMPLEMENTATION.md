# Coupon System Implementation Guide

## Overview
This document outlines the implementation of a coupon system that supports:
- Fixed SOL amount discounts
- Percentage-based discounts
- Limited supply coupons
- Per-wallet usage limits
- Eligibility rules (using existing system)
- Integration with current checkout flow

## Implementation Steps

### 1. Database Setup

Create a new migration file `supabase/migrations/[timestamp]_add_coupon_system.sql`:

```sql
-- Create enum for discount types
CREATE TYPE discount_type AS ENUM ('fixed_sol', 'percentage');

-- Main coupons table
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  discount_type discount_type NOT NULL,
  discount_value DECIMAL(18,9) NOT NULL, -- SOL amount or percentage
  max_discount DECIMAL(18,9), -- For percentage discounts
  collection_id UUID REFERENCES collections(id), -- NULL means applies to all collections
  eligibility_rules JSONB DEFAULT '{"groups": []}'::jsonb, -- Same structure as category rules
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  total_supply INTEGER NOT NULL, -- Total number of instances
  per_wallet_limit INTEGER NOT NULL, -- How many each wallet can claim
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual coupon instances
CREATE TABLE coupon_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID REFERENCES coupons(id),
  code VARCHAR(20) UNIQUE NOT NULL,
  claimed_by TEXT, -- Wallet address
  claimed_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  order_id UUID,
  status VARCHAR(20) DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_instances ENABLE ROW LEVEL SECURITY;

-- Policies for coupons
CREATE POLICY "coupons_public_view" ON coupons
  FOR SELECT TO public
  USING (status = 'active');

CREATE POLICY "coupons_admin_all" ON coupons
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policies for coupon instances
CREATE POLICY "coupon_instances_public_view" ON coupon_instances
  FOR SELECT TO public
  USING (status = 'available' OR claimed_by = auth.uid());

CREATE POLICY "coupon_instances_claim" ON coupon_instances
  FOR UPDATE TO public
  USING (status = 'available')
  WITH CHECK (
    claimed_by = auth.uid() AND
    status = 'claimed'
  );
```

### 2. Type Definitions

Create `src/types/coupons.ts`:

```typescript
export type DiscountType = 'fixed_sol' | 'percentage';

export interface Coupon {
  id: string;
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  collectionId?: string;
  eligibilityRules: {
    groups: RuleGroup[]; // Reuse existing RuleGroup type
  };
  startDate?: Date;
  endDate?: Date;
  totalSupply: number;
  perWalletLimit: number;
  status: 'active' | 'inactive' | 'expired';
}

export interface CouponInstance {
  id: string;
  couponId: string;
  code: string;
  claimedBy?: string;
  claimedAt?: Date;
  usedAt?: Date;
  orderId?: string;
  status: 'available' | 'claimed' | 'used' | 'expired';
}

export interface CouponCalculation {
  isValid: boolean;
  discountAmount: number;
  finalPrice: number;
  discountDisplay: string;
  error?: string;
}
```

### 3. Coupon Service

Create `src/services/coupons.ts`:

```typescript
import { supabase } from '../lib/supabase';
import type { Coupon, CouponInstance, CouponCalculation } from '../types/coupons';
import { verifyEligibility } from './eligibility';

export class CouponService {
  static async calculateDiscount(
    basePrice: number,
    couponCode: string,
    walletAddress: string
  ): Promise<CouponCalculation> {
    const { data: instance, error } = await supabase
      .from('coupon_instances')
      .select(`
        *,
        coupon:coupons (*)
      `)
      .eq('code', couponCode)
      .single();

    if (error || !instance) {
      return {
        isValid: false,
        discountAmount: 0,
        finalPrice: basePrice,
        discountDisplay: '',
        error: 'Invalid coupon code'
      };
    }

    const eligibilityResult = await verifyEligibility(
      instance.coupon.eligibilityRules.groups,
      walletAddress
    );

    if (!eligibilityResult.isValid) {
      return {
        isValid: false,
        discountAmount: 0,
        finalPrice: basePrice,
        discountDisplay: '',
        error: eligibilityResult.error
      };
    }

    let discountAmount: number;
    let discountDisplay: string;

    if (instance.coupon.discountType === 'fixed_sol') {
      discountAmount = Math.min(
        instance.coupon.discountValue,
        basePrice
      );
      discountDisplay = `${discountAmount} SOL off`;
    } else {
      discountAmount = (basePrice * instance.coupon.discountValue) / 100;
      if (instance.coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, instance.coupon.maxDiscount);
      }
      discountDisplay = `${instance.coupon.discountValue}% off`;
    }

    return {
      isValid: true,
      discountAmount,
      finalPrice: basePrice - discountAmount,
      discountDisplay
    };
  }

  static async claimCoupon(
    couponId: string,
    walletAddress: string
  ): Promise<{
    success: boolean;
    code?: string;
    error?: string;
  }> {
    // Start transaction
    const { data: coupon } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', couponId)
      .single();

    if (!coupon || coupon.status !== 'active') {
      return { success: false, error: 'Coupon not available' };
    }

    // Check wallet limits
    const { count: walletCoupons } = await supabase
      .from('coupon_instances')
      .select('id', { count: 'exact' })
      .eq('coupon_id', couponId)
      .eq('claimed_by', walletAddress);

    if (walletCoupons >= coupon.perWalletLimit) {
      return { 
        success: false, 
        error: `You can only claim ${coupon.perWalletLimit} coupons from this batch` 
      };
    }

    // Try to claim an available coupon
    const { data: instance, error } = await supabase
      .from('coupon_instances')
      .update({
        claimed_by: walletAddress,
        claimed_at: new Date().toISOString(),
        status: 'claimed'
      })
      .eq('coupon_id', couponId)
      .eq('status', 'available')
      .limit(1)
      .select()
      .single();

    if (error || !instance) {
      return { success: false, error: 'No coupons available' };
    }

    return { success: true, code: instance.code };
  }

  static async generateCoupons(coupon: Coupon): Promise<void> {
    const codes = Array.from(
      { length: coupon.totalSupply },
      () => generateUniqueCode() // Implement this helper
    );

    const instances = codes.map(code => ({
      coupon_id: coupon.id,
      code,
      status: 'available'
    }));

    await supabase
      .from('coupon_instances')
      .insert(instances);
  }
}

// Helper function to generate unique codes
function generateUniqueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 8;
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
```

### 4. Admin Interface

Create `src/components/merchant/forms/CouponForm.tsx`:

```typescript
import React, { useState } from 'react';
import { CouponService } from '../../../services/coupons';
import type { Coupon } from '../../../types/coupons';

interface CouponFormProps {
  onClose: () => void;
  onSubmit: (coupon: Coupon) => void;
  initialData?: Partial<Coupon>;
}

export function CouponForm({ onClose, onSubmit, initialData }: CouponFormProps) {
  const [formData, setFormData] = useState<Partial<Coupon>>({
    discountType: 'fixed_sol',
    ...initialData
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form fields implementation */}
    </form>
  );
}
```

### 5. Checkout Integration

Modify `src/components/products/TokenVerificationModal.tsx`:

```typescript
// Add to imports
import { CouponService } from '../../services/coupons';
import type { CouponCalculation } from '../../types/coupons';

// Add to component state
const [couponCode, setCouponCode] = useState<string>('');
const [couponResult, setCouponResult] = useState<CouponCalculation | null>(null);

// Add to form
<div className="space-y-4">
  {/* Existing form fields */}
  
  <div className="mt-4">
    <label className="block text-sm font-medium text-white">
      Coupon Code
    </label>
    <div className="mt-1 flex gap-2">
      <input
        type="text"
        value={couponCode}
        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
        className="block w-full rounded-md bg-gray-800"
        placeholder="Enter code"
      />
      <button
        type="button"
        onClick={async () => {
          const result = await CouponService.calculateDiscount(
            modifiedPrice,
            couponCode,
            walletAddress
          );
          setCouponResult(result);
          if (!result.isValid) {
            toast.error(result.error);
          }
        }}
        className="px-4 py-2 bg-purple-600 rounded-md"
      >
        Apply
      </button>
    </div>
  </div>

  {couponResult?.isValid && (
    <div className="p-4 bg-gray-800/50 rounded-lg">
      <div className="flex justify-between text-sm">
        <span>Discount:</span>
        <span className="text-purple-400">
          {couponResult.discountDisplay}
        </span>
      </div>
      <div className="flex justify-between text-sm mt-2">
        <span>Final Price:</span>
        <span className="text-white font-medium">
          {couponResult.finalPrice} SOL
        </span>
      </div>
    </div>
  )}
</div>
```

## Implementation Order

1. Create and run the database migration
2. Add type definitions
3. Implement the CouponService
4. Create the admin interface
5. Integrate with checkout
6. Test thoroughly

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Admin can create coupons
- [ ] Fixed SOL discounts work correctly
- [ ] Percentage discounts work correctly
- [ ] Per-wallet limits are enforced
- [ ] Supply limits are enforced
- [ ] Eligibility rules work
- [ ] Checkout integration works
- [ ] Error handling works properly

## Notes

- All amounts are in SOL
- Reuses existing eligibility system
- Maintains consistent patterns with current codebase
- Uses existing RLS policies pattern
- Integrates with current checkout flow
- Maintains type safety throughout

## Security Considerations

- All coupon calculations must happen server-side
- Validate wallet ownership
- Prevent double-usage of coupons
- Enforce RLS policies
- Validate all inputs
- Handle race conditions in claiming process

## Future Enhancements

- Coupon analytics
- Bulk coupon generation
- Export/import functionality
- Advanced targeting rules
- Combination rules
- Usage reports 