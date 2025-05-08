-- Add profile_image to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS profile_image TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Create storage bucket for profile images if it doesn't exist
DO $$
DECLARE
  bucket_exists boolean;
BEGIN
  -- Check if bucket exists
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'profile-images'
  ) INTO bucket_exists;
  
  -- Create bucket if it doesn't exist
  IF NOT bucket_exists THEN
    -- Create the bucket
    INSERT INTO storage.buckets (id, name, public, avif_autodetection)
    VALUES ('profile-images', 'profile-images', true, false);
    
    -- Create policies to control access
    -- Policy allowing any authenticated user to upload a file to their own folder
    CREATE POLICY "Users can upload their profile image"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'profile-images' AND 
        (auth.uid()::text = owner)
      );
      
    -- Policy allowing users to update their own files
    CREATE POLICY "Users can update their profile image"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'profile-images' AND 
        (auth.uid()::text = owner)
      );
      
    -- Policy allowing users to delete their own files
    CREATE POLICY "Users can delete their profile image"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'profile-images' AND 
        (auth.uid()::text = owner)
      );
      
    -- Policy allowing public to read all files in the bucket
    CREATE POLICY "Public can read profile images"
      ON storage.objects
      FOR SELECT
      TO public
      USING (
        bucket_id = 'profile-images'
      );
  END IF;
END $$;

-- Create function to generate random merchant names
CREATE OR REPLACE FUNCTION generate_random_merchant_name()
RETURNS TEXT AS $$
DECLARE
  adjectives TEXT[] := ARRAY[
    'Noble', 'Golden', 'Silver', 'Emerald', 'Royal', 'Cosmic', 'Crystal', 'Divine',
    'Mystic', 'Eternal', 'Stellar', 'Radiant', 'Quantum', 'Vibrant', 'Serene', 'Epic',
    'Digital', 'Sonic', 'Cyber', 'Neon', 'Lunar', 'Solar', 'Astral', 'Velvet',
    'Midnight', 'Phoenix', 'Thunder', 'Ocean', 'Forest', 'Mountain', 'Desert', 'Arctic'
  ];
  
  nouns TEXT[] := ARRAY[
    'Merchant', 'Trader', 'Vendor', 'Market', 'Bazaar', 'Emporium', 'Exchange', 'Store',
    'Shop', 'Boutique', 'Gallery', 'Artisan', 'Craftsman', 'Collector', 'Dealer', 'Pioneer',
    'Outpost', 'Haven', 'Nexus', 'Junction', 'Harbor', 'Forge', 'Workshop', 'Studio',
    'Vault', 'Treasury', 'Archive', 'Collection', 'Domain', 'Empire', 'Republic', 'Kingdom'
  ];
  
  random_adjective TEXT;
  random_noun TEXT;
  random_number TEXT;
BEGIN
  -- Select random words
  random_adjective := adjectives[1 + floor(random() * array_length(adjectives, 1))];
  random_noun := nouns[1 + floor(random() * array_length(nouns, 1))];
  
  -- Generate random number between 10 and 999
  random_number := (10 + floor(random() * 990))::TEXT;
  
  -- Combine words and number
  RETURN random_adjective || random_noun || random_number;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to add display_name when creating a new user profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user profile already has a display_name
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = NEW.id AND display_name IS NOT NULL AND display_name != ''
  ) THEN
    -- Set generated display_name
    UPDATE user_profiles 
    SET display_name = generate_random_merchant_name()
    WHERE id = NEW.id AND (display_name IS NULL OR display_name = '');
    
    -- Also update auth metadata
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('display_name', generate_random_merchant_name())
    WHERE id = NEW.id 
    AND (raw_user_meta_data->>'display_name' IS NULL OR raw_user_meta_data->>'display_name' = '');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for generating display name when user profile is created
DROP TRIGGER IF EXISTS generate_display_name_trigger ON user_profiles;
CREATE TRIGGER generate_display_name_trigger
AFTER INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- Generate display names for existing users that don't have one
UPDATE user_profiles
SET display_name = generate_random_merchant_name()
WHERE display_name IS NULL OR display_name = '';

-- Update auth metadata for existing users without display_name
UPDATE auth.users u
SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('display_name', p.display_name)
FROM user_profiles p
WHERE u.id = p.id
AND p.display_name IS NOT NULL
AND (u.raw_user_meta_data->>'display_name' IS NULL OR u.raw_user_meta_data->>'display_name' = ''); 