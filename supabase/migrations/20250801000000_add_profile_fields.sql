-- Add new fields to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS payout_wallet TEXT;

-- Update trigger to sync display_name with auth metadata
CREATE OR REPLACE FUNCTION sync_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- When display_name is updated in user_profiles, update auth metadata
  IF TG_OP = 'UPDATE' AND OLD.display_name IS DISTINCT FROM NEW.display_name THEN
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('display_name', NEW.display_name)
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for syncing profile changes to auth metadata
DROP TRIGGER IF EXISTS sync_user_profile_trigger ON user_profiles;
CREATE TRIGGER sync_user_profile_trigger
AFTER UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION sync_user_profile();

-- Create function to sync auth display_name to user_profiles
CREATE OR REPLACE FUNCTION sync_auth_display_name()
RETURNS TRIGGER AS $$
BEGIN
  -- When display_name is updated in auth metadata, update user_profiles
  IF NEW.raw_user_meta_data->>'display_name' IS NOT NULL AND 
     (OLD.raw_user_meta_data->>'display_name' IS DISTINCT FROM NEW.raw_user_meta_data->>'display_name') THEN
    
    UPDATE user_profiles
    SET display_name = NEW.raw_user_meta_data->>'display_name'
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for syncing auth metadata changes to profile
DROP TRIGGER IF EXISTS sync_auth_display_name_trigger ON auth.users;
CREATE TRIGGER sync_auth_display_name_trigger
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION sync_auth_display_name();

-- Initially populate display_name from auth metadata if available
UPDATE user_profiles up
SET display_name = u.raw_user_meta_data->>'display_name'
FROM auth.users u
WHERE up.id = u.id
AND u.raw_user_meta_data->>'display_name' IS NOT NULL
AND up.display_name IS NULL; 