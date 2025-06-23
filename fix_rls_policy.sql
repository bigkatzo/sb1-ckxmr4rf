-- FIX: Add missing INSERT policy for notifications table
-- This is why create_notification was returning NULL!

CREATE POLICY "Allow notification creation"
ON notifications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Alternative: More restrictive policy that only allows users to create notifications for themselves
-- CREATE POLICY "Users can create notifications for themselves"
-- ON notifications
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (user_id = auth.uid());

-- Grant INSERT permission to both anon and authenticated users (needed for anonymous orders/reviews)
GRANT INSERT ON notifications TO anon, authenticated; 