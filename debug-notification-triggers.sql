-- 🔍 COMPREHENSIVE NOTIFICATION TRIGGER DEBUG SCRIPT
-- This script tests every aspect of the notification system to identify why emails aren't firing

-- ========================================
-- 1. BASIC SYSTEM HEALTH CHECK
-- ========================================

-- Check if core tables exist
SELECT 
  'System Health Check' as section,
  'Table Existence' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN '✅ notifications table exists'
    ELSE '❌ notifications table missing'
  END as result
UNION ALL
SELECT 
  'System Health Check',
  'Table Existence',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_preferences') THEN '✅ notification_preferences table exists'
    ELSE '❌ notification_preferences table missing'
  END
UNION ALL
SELECT 
  'System Health Check',
  'Table Existence',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_queue') THEN '✅ email_queue table exists'
    ELSE '❌ email_queue table missing'
  END;

-- Check if notification functions exist
SELECT 
  'System Health Check' as section,
  'Function Existence' as test_name,
  string_agg(routine_name || ' (' || routine_type || ')', ', ') as result
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'create_notification',
  'create_notification_with_preferences',
  'send_notification_email',
  'get_pending_emails',
  'mark_email_sent'
);

-- Check if triggers exist
SELECT 
  'System Health Check' as section,
  'Trigger Existence' as test_name,
  string_agg(trigger_name || ' ON ' || event_object_table, ', ') as result
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE '%_trigger';

-- ========================================
-- 2. NOTIFICATION PREFERENCES ANALYSIS
-- ========================================

-- Check user preferences that might block emails
SELECT 
  'Notification Preferences' as section,
  'User Email Settings' as test_name,
  format('Users with email notifications enabled: %s/%s', 
    COUNT(*) FILTER (WHERE np.all_email_notifications = true),
    COUNT(*)
  ) as result
FROM auth.users u
LEFT JOIN notification_preferences np ON np.user_id = u.id;

-- Sample user preferences
SELECT 
  'Notification Preferences' as section,
  'Sample User Settings' as test_name,
  format('User: %s | App: %s | Email: %s | Order Email: %s | Category Email: %s', 
    LEFT(u.email, 20),
    COALESCE(np.all_app_notifications, true),
    COALESCE(np.all_email_notifications, true),
    COALESCE(np.order_created_email, true),
    COALESCE(np.category_created_email, true)
  ) as result
FROM auth.users u
LEFT JOIN notification_preferences np ON np.user_id = u.id
ORDER BY u.created_at DESC
LIMIT 5;

-- ========================================
-- 3. RECENT ACTIVITY ANALYSIS
-- ========================================

-- Check recent notifications created
SELECT 
  'Recent Activity' as section,
  'Notifications Last 24h' as test_name,
  format('Total: %s | With emails: %s | Types: %s', 
    COUNT(*),
    COUNT(*) FILTER (WHERE email_sent = true),
    string_agg(DISTINCT type, ', ')
  ) as result
FROM notifications
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Check recent email queue activity
SELECT 
  'Recent Activity' as section,
  'Email Queue Last 24h' as test_name,
  format('Total: %s | Pending: %s | Sent: %s | Failed: %s', 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'sent'),
    COUNT(*) FILTER (WHERE status = 'failed')
  ) as result
FROM email_queue
WHERE created_at > NOW() - INTERVAL '24 hours';

-- ========================================
-- 4. TRIGGER TEST - CREATE A CATEGORY
-- ========================================

-- First, let's see what collections exist for testing
SELECT 
  'Trigger Test Setup' as section,
  'Available Collections' as test_name,
  format('ID: %s | Name: %s | Created: %s', id, name, created_at::date) as result
FROM collections
ORDER BY created_at DESC
LIMIT 3;

-- ========================================
-- 5. DETAILED EMAIL QUEUE ANALYSIS
-- ========================================

-- Recent email queue entries with details
SELECT 
  'Email Queue Analysis' as section,
  'Recent Queue Entries' as test_name,
  format('ID: %s | To: %s | Type: %s | Status: %s | Attempts: %s | Error: %s', 
    id::text,
    LEFT(recipient_email, 20),
    notification_type,
    status,
    attempts,
    COALESCE(LEFT(error_message, 50), 'none')
  ) as result
FROM email_queue
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- 6. USER CONTEXT FOR TESTING
-- ========================================

-- Get a sample user for testing
SELECT 
  'Test User Info' as section,
  'Sample Active User' as test_name,
  format('ID: %s | Email: %s | Has Preferences: %s', 
    u.id::text,
    u.email,
    CASE WHEN np.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END
  ) as result
FROM auth.users u
LEFT JOIN notification_preferences np ON np.user_id = u.id
WHERE u.email IS NOT NULL 
  AND u.email != ''
  AND u.created_at > NOW() - INTERVAL '30 days'
ORDER BY u.created_at DESC
LIMIT 3;

-- ========================================
-- 7. FUNCTION EXECUTION TEST
-- ========================================

-- Test notification creation function directly
-- (This will create a test notification - replace USER_ID with actual user ID)
DO $$
DECLARE
  test_user_id UUID;
  test_notification_id UUID;
  test_collection_id UUID;
BEGIN
  -- Get a test user
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email IS NOT NULL 
  LIMIT 1;
  
  -- Get a test collection
  SELECT id INTO test_collection_id 
  FROM collections 
  LIMIT 1;
  
  IF test_user_id IS NOT NULL AND test_collection_id IS NOT NULL THEN
    -- Create a test notification
    RAISE NOTICE '🧪 TESTING NOTIFICATION CREATION for user: %', test_user_id;
    
    SELECT create_notification_with_preferences(
      test_user_id,
      'debug_test',
      'Debug Test Notification',
      'This is a debug test to check if notifications and emails work',
      jsonb_build_object('debug', true, 'timestamp', extract(epoch from now())),
      test_collection_id
    ) INTO test_notification_id;
    
    IF test_notification_id IS NOT NULL THEN
      RAISE NOTICE '✅ TEST NOTIFICATION CREATED: %', test_notification_id;
    ELSE
      RAISE NOTICE '❌ TEST NOTIFICATION FAILED';
    END IF;
  ELSE
    RAISE NOTICE '❌ NO TEST USER OR COLLECTION FOUND';
  END IF;
END $$;

-- ========================================
-- 8. EMAIL QUEUE PROCESSING TEST
-- ========================================

-- Check if we have a way to process pending emails
SELECT 
  'Email Processing' as section,
  'Pending Email Count' as test_name,
  COUNT(*)::text || ' emails pending processing' as result
FROM email_queue
WHERE status = 'pending';

-- ========================================
-- 9. COMPREHENSIVE SUMMARY
-- ========================================

SELECT 
  '🔍 DIAGNOSIS SUMMARY' as section,
  'System Status' as test_name,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_queue') 
      THEN '❌ Email queue table missing'
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'create_notification_with_preferences')
      THEN '❌ Notification function missing'
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name LIKE '%_trigger')
      THEN '❌ No triggers found'
    WHEN (SELECT COUNT(*) FROM email_queue WHERE created_at > NOW() - INTERVAL '24 hours') = 0
      THEN '⚠️ No emails queued recently - triggers may not be firing'
    WHEN (SELECT COUNT(*) FROM email_queue WHERE status = 'pending') > 0
      THEN '⚠️ Emails queued but not processed - check email handler'
    ELSE '✅ System appears functional - check logs'
  END as result; 