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
FROM user_profiles
WHERE role != 'admin';  -- Exclude admin profiles from public view

-- Grant select permission to authenticated users
GRANT SELECT ON public_user_profiles TO authenticated; 