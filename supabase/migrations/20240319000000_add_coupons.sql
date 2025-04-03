-- Create coupons table
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('fixed_sol', 'percentage')),
  discount_value DECIMAL(18,9) NOT NULL CHECK (discount_value > 0),
  max_discount DECIMAL(18,9), -- Optional cap for percentage discounts
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add indexes
CREATE INDEX idx_coupons_code ON coupons(code) WHERE status = 'active';

-- RLS policies
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Anyone can read active coupons
CREATE POLICY "coupons_public_view" ON coupons
  FOR SELECT TO public
  USING (status = 'active');

-- Only admins can manage coupons
CREATE POLICY "coupons_admin_all" ON coupons
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  ); 