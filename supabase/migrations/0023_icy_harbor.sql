-- Drop existing collection policies
DROP POLICY IF EXISTS "Public can view collections" ON collections;
DROP POLICY IF EXISTS "Users can view all collections" ON collections;

-- Create new public access policy
CREATE POLICY "Anyone can view visible collections"
ON collections FOR SELECT
USING (visible = true OR auth.role() = 'authenticated');

-- Create policy for authenticated users to manage their collections
CREATE POLICY "Authenticated users can manage their collections"
ON collections FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);