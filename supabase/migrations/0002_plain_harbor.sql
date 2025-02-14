/*
  # Collections Table Migration

  1. Changes
    - Create collections table if it doesn't exist
    - Add necessary columns for collection management
    - Add foreign key constraint to auth.users
*/

-- Create collections table if it doesn't exist
CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  launch_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL
);