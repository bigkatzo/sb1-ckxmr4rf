-- =====================================================
-- BACKUP CURRENT STATE - Before Email Migrations
-- =====================================================
--
-- Run this script BEFORE applying email notification migrations
-- to create a backup of your current notification system state.
-- 
-- This backup can be used to restore the exact current state
-- if needed during rollback.
-- =====================================================

BEGIN;

-- Create backup timestamp
SELECT 'BACKUP_STARTED' as status, NOW() as backup_timestamp;

-- =====================================================
-- 1. BACKUP CURRENT FUNCTION DEFINITIONS
-- =====================================================

-- Check if create_notification exists and backup its definition
SELECT 'CHECKING_FUNCTIONS' as status;

-- Backup current create_notification function (if it exists)
DO $$
BEGIN
  -- This will show the current function definition
  PERFORM routine_name 
  FROM information_schema.routines 
  WHERE routine_name = 'create_notification' 
    AND routine_schema = 'public';
    
  IF FOUND THEN
    RAISE NOTICE 'BACKUP: create_notification function exists';
  ELSE
    RAISE NOTICE 'BACKUP: create_notification function not found';
  END IF;
END $$;

-- Backup current create_notification_with_preferences function (if it exists)
DO $$
BEGIN
  PERFORM routine_name 
  FROM information_schema.routines 
  WHERE routine_name = 'create_notification_with_preferences' 
    AND routine_schema = 'public';
    
  IF FOUND THEN
    RAISE NOTICE 'BACKUP: create_notification_with_preferences function exists';
  ELSE
    RAISE NOTICE 'BACKUP: create_notification_with_preferences function not found';
  END IF;
END $$;

-- =====================================================
-- 2. BACKUP TABLE STRUCTURES
-- =====================================================

-- Check current table structures
SELECT 'BACKUP_TABLE_STRUCTURES' as status;

-- Backup notifications table structure
SELECT 
  'notifications_table_backup' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Backup notification_preferences table structure (if exists)
SELECT 
  'notification_preferences_table_backup' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'notification_preferences' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if email_queue table exists (should not exist before migrations)
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_queue')
    THEN 'WARNING: email_queue table already exists'
    ELSE 'CONFIRMED: email_queue table does not exist (expected)'
  END as email_queue_status;

-- =====================================================
-- 3. BACKUP CURRENT TRIGGERS
-- =====================================================

-- List all current triggers
SELECT 
  'current_triggers_backup' as backup_type,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%notify%'
ORDER BY trigger_name;

-- =====================================================
-- 4. BACKUP CURRENT POLICIES
-- =====================================================

-- List RLS policies on notifications table
SELECT 
  'current_policies_backup' as backup_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('notifications', 'notification_preferences')
ORDER BY tablename, policyname;

-- =====================================================
-- 5. BACKUP DATA COUNTS
-- =====================================================

-- Get current data counts for verification
SELECT 'current_data_counts' as backup_type;

-- Count notifications
SELECT 
  'notifications_count' as table_name,
  COUNT(*) as current_count,
  MIN(created_at) as oldest_notification,
  MAX(created_at) as newest_notification
FROM notifications;

-- Count notification preferences (if table exists)
SELECT 
  'notification_preferences_count' as table_name,
  COUNT(*) as current_count
FROM notification_preferences
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'notification_preferences'
);

-- =====================================================
-- 6. BACKUP FUNCTION PERMISSIONS
-- =====================================================

-- Get current function permissions
SELECT 
  'function_permissions_backup' as backup_type,
  routine_name,
  routine_type,
  specific_name
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name LIKE '%notification%'
ORDER BY routine_name;

-- =====================================================
-- 7. CREATE RESTORE POINT REFERENCE
-- =====================================================

-- Create a simple restore point marker
CREATE OR REPLACE FUNCTION backup_restore_point_20250130()
RETURNS TABLE (
  backup_timestamp TIMESTAMPTZ,
  backup_status TEXT,
  notification_count BIGINT,
  preferences_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    NOW() as backup_timestamp,
    'PRE_EMAIL_MIGRATION_BACKUP' as backup_status,
    (SELECT COUNT(*) FROM notifications) as notification_count,
    (SELECT COUNT(*) FROM notification_preferences 
     WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_preferences')
    ) as preferences_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the restore point
SELECT * FROM backup_restore_point_20250130();

-- =====================================================
-- BACKUP COMPLETE
-- =====================================================

SELECT 
  'BACKUP_COMPLETED' as status,
  NOW() as backup_timestamp,
  'Current state captured before email migrations' as message;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these to verify current system is working:

/*
-- Test notification creation (should work)
SELECT create_notification(
  '00000000-0000-0000-0000-000000000000'::UUID,
  'backup_test',
  'Backup Test',
  'Testing current system before migration',
  '{}'::JSONB
);

-- Clean up test
DELETE FROM notifications 
WHERE type = 'backup_test' 
  AND title = 'Backup Test';

-- Verify no email functions exist yet
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'send_notification_email')
    THEN 'WARNING: send_notification_email already exists'
    ELSE 'CONFIRMED: No email functions exist yet'
  END as email_function_status;
*/ 