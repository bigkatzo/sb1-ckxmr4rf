-- Create merchant tier type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'merchant_tier') THEN
    CREATE TYPE merchant_tier AS ENUM (
      'starter_merchant',
      'verified_merchant',
      'trusted_merchant',
      'elite_merchant'
    );
  END IF;
END $$;

-- Add merchant_tier and successful_sales_count columns to user_profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'merchant_tier'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN merchant_tier merchant_tier NOT NULL DEFAULT 'starter_merchant';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'successful_sales_count'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN successful_sales_count INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Create function to increment successful sales count
CREATE OR REPLACE FUNCTION increment_merchant_sales_count()
RETURNS trigger AS $$
BEGIN
  -- Only increment when status changes to shipped or delivered for the first time
  IF (NEW.status IN ('shipped', 'delivered') AND OLD.status NOT IN ('shipped', 'delivered')) THEN
    -- Get the collection owner's ID and increment their successful sales count
    -- This will work for both merchants and admins who own collections
    UPDATE user_profiles
    SET successful_sales_count = successful_sales_count + 1
    WHERE id = (
      SELECT c.user_id 
      FROM collections c
      JOIN products p ON p.collection_id = c.id
      WHERE p.id = NEW.product_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS increment_sales_count_trigger ON orders;

-- Create trigger to increment sales count
CREATE TRIGGER increment_sales_count_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION increment_merchant_sales_count();

-- Create function to update merchant tier based on sales count
CREATE OR REPLACE FUNCTION update_merchant_tier()
RETURNS trigger AS $$
BEGIN
  -- Only update tier if current tier is starter_merchant and user has enough sales
  -- This won't affect users who are already verified_merchant or elite_merchant
  IF NEW.successful_sales_count >= 10 AND 
     OLD.merchant_tier = 'starter_merchant' AND
     NEW.role IN ('merchant', 'admin') THEN
    NEW.merchant_tier = 'trusted_merchant';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_merchant_tier_trigger ON user_profiles;

-- Create trigger for automatic tier updates
CREATE TRIGGER update_merchant_tier_trigger
  BEFORE UPDATE OF successful_sales_count ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_tier();

-- Create function for admins to manually set merchant tier
CREATE OR REPLACE FUNCTION admin_set_merchant_tier(
  p_user_id uuid,
  p_tier merchant_tier
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can set merchant tiers';
  END IF;

  -- Update merchant tier
  UPDATE user_profiles
  SET merchant_tier = p_tier
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_set_merchant_tier(uuid, merchant_tier) TO authenticated;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    _role user_role;
    _is_merchant_local boolean;
BEGIN
    -- Check if email is merchant.local
    _is_merchant_local := NEW.email LIKE '%@merchant.local';
    
    -- Set proper metadata
    IF _is_merchant_local THEN
        -- For merchant.local emails, set verified in app_metadata
        NEW.raw_app_meta_data := jsonb_build_object(
            'role', 'merchant',
            'provider', 'email',
            'providers', ARRAY['email'],
            'email_verified', true
        );
        NEW.raw_user_meta_data := jsonb_build_object(
            'role', 'merchant',
            'email', NEW.email,
            'email_verified', false,
            'phone_verified', false
        );
    ELSE
        -- For regular emails, update metadata properly
        NEW.raw_app_meta_data := jsonb_build_object(
            'provider', 'email',
            'providers', ARRAY['email']
        );
        NEW.raw_user_meta_data := jsonb_build_object(
            'role', 'merchant',
            'email', NEW.email,
            'email_verified', false,
            'phone_verified', false,
            'email_confirmed', false
        );
    END IF;

    -- Get role for user_profiles
    _role := COALESCE(
        (NEW.raw_app_meta_data->>'role')::user_role,
        (NEW.raw_user_meta_data->>'role')::user_role,
        'merchant'::user_role
    );

    -- Insert with error handling
    BEGIN
        INSERT INTO public.user_profiles (id, role, email, merchant_tier)
        VALUES (
            NEW.id,
            _role,
            NEW.email,
            'starter_merchant'  -- Set default merchant tier for all new users
        );
        RAISE LOG 'Created user profile for % with role % and starter merchant tier', NEW.email, _role;
    EXCEPTION WHEN others THEN
        RAISE WARNING 'Error creating user profile: %, SQLSTATE: %', SQLERRM, SQLSTATE;
        RETURN NEW;
    END;

    RETURN NEW;
END;
$$;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Drop existing view if it exists
DROP VIEW IF EXISTS public_user_profiles;

-- Create public view of user profiles with merchant tier info
CREATE VIEW public_user_profiles AS
SELECT 
  id,
  display_name,
  description,
  profile_image,
  website_url,
  merchant_tier,
  successful_sales_count,
  role
FROM user_profiles;

-- Grant select permission to authenticated users
GRANT SELECT ON public_user_profiles TO authenticated;

-- Update existing users without a merchant tier
UPDATE user_profiles
SET merchant_tier = 'starter_merchant'
WHERE merchant_tier IS NULL; 