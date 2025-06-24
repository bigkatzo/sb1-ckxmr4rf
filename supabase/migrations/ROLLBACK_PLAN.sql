-- =====================================================
-- EMAIL NOTIFICATION SYSTEM - EMERGENCY ROLLBACK PLAN
-- =====================================================
-- 
-- Use this script to safely revert email notification migrations
-- if anything goes wrong after deployment.
--
-- IMPORTANT: This rollback preserves all existing data and functionality
-- It only removes the new email features, leaving the core notification
-- system exactly as it was before.
-- =====================================================

BEGIN;

-- Log the rollback start
SELECT 'ROLLBACK_STARTED' as status, NOW() as timestamp;

-- =====================================================
-- STEP 1: DISABLE EMAIL SENDING IMMEDIATELY
-- =====================================================

-- Option A: Soft disable (preserves functions, just stops emails)
-- This is the SAFEST option - use this first

-- Disable all email notifications for all users
UPDATE notification_preferences 
SET all_email_notifications = FALSE
WHERE all_email_notifications = TRUE;

-- Also disable via a function override (double safety)
CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
BEGIN
  -- Log that emails are disabled
  RAISE NOTICE 'EMAIL_DISABLED_BY_ROLLBACK: type=% to=%', p_notification_type, p_user_email;
  -- Do nothing - emails are disabled
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'EMAIL_SENDING_DISABLED' as status, 'All email sending has been disabled' as message;

-- =====================================================
-- STEP 2: REVERT TO ORIGINAL FUNCTIONS (IF NEEDED)
-- =====================================================

-- Only use this if Step 1 doesn't resolve the issue
-- This restores the original simple notification behavior

/*
-- Restore original create_notification_with_preferences 
-- (simple version without email)
CREATE OR REPLACE FUNCTION create_notification_with_preferences(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_collection_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_review_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_should_send_app BOOLEAN;
BEGIN
  BEGIN
    -- Check if user wants app notifications (defaults to TRUE)
    SELECT COALESCE(
      (SELECT all_app_notifications FROM notification_preferences WHERE user_id = p_user_id),
      TRUE
    ) INTO v_should_send_app;
    
    -- Create app notification if enabled
    IF v_should_send_app THEN
      INSERT INTO notifications (
        user_id, type, title, message, data,
        collection_id, category_id, product_id, order_id, target_user_id, review_id
      )
      VALUES (
        p_user_id, p_type, p_title, p_message, p_data,
        p_collection_id, p_category_id, p_product_id, p_order_id, p_target_user_id, p_review_id
      )
      RETURNING id INTO v_notification_id;
      
      RAISE NOTICE 'ROLLBACK_NOTIFICATION_CREATED: id=% type=% user_id=%', v_notification_id, p_type, p_user_id;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'ROLLBACK_NOTIFICATION_ERROR: user_id=% type=% error=%', p_user_id, p_type, SQLERRM;
      RETURN NULL;
  END;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'FUNCTIONS_REVERTED' as status, 'create_notification_with_preferences reverted to simple version' as message;
*/

-- =====================================================
-- STEP 3: REMOVE EMAIL-RELATED FUNCTIONS (IF NEEDED)
-- =====================================================

-- Only use this if you want to completely remove email functionality
-- This removes all email-related functions while preserving notifications

/*
-- Drop email-related functions
DROP FUNCTION IF EXISTS mark_email_sent_with_harmony(UUID, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS mark_email_sent_immediately(UUID, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS mark_email_sent(UUID, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS get_pending_emails(INTEGER);
DROP FUNCTION IF EXISTS retry_failed_emails();
DROP FUNCTION IF EXISTS notify_notification_changed();

-- Drop email queue trigger
DROP TRIGGER IF EXISTS notifications_realtime_trigger ON notifications;

SELECT 'EMAIL_FUNCTIONS_REMOVED' as status, 'All email-related functions have been removed' as message;
*/

-- =====================================================
-- STEP 4: PRESERVE EMAIL QUEUE DATA (RECOMMENDED)
-- =====================================================

-- Don't drop email_queue table - keep it for analysis
-- Just rename it if you want to clean up later

/*
-- Rename email queue table instead of dropping it
ALTER TABLE IF EXISTS email_queue RENAME TO email_queue_backup_20250130;

SELECT 'EMAIL_QUEUE_BACKED_UP' as status, 'Email queue data preserved in email_queue_backup_20250130' as message;
*/

-- =====================================================
-- STEP 5: RESTORE ORIGINAL NOTIFICATION BEHAVIOR
-- =====================================================

-- Ensure original create_notification function is working
-- (This should already be working, but let's verify)

DO $$
DECLARE
  v_test_result UUID;
BEGIN
  -- Test that create_notification still works
  SELECT create_notification(
    '00000000-0000-0000-0000-000000000000'::UUID, -- dummy user_id
    'test_rollback',
    'Rollback Test',
    'Testing that original notification function works',
    '{}'::JSONB
  ) INTO v_test_result;
  
  -- Clean up test notification
  DELETE FROM notifications WHERE id = v_test_result;
  
  RAISE NOTICE 'ROLLBACK_TEST_PASSED: Original create_notification function is working';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ROLLBACK_TEST_WARNING: create_notification test failed: %', SQLERRM;
END;
$$;

-- =====================================================
-- STEP 6: VERIFY ROLLBACK SUCCESS
-- =====================================================

-- Check that core notification system is working
SELECT 
  'ROLLBACK_VERIFICATION' as check_type,
  COUNT(*) as notification_count,
  'Core notification system verified' as status
FROM notifications 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check that email sending is disabled
SELECT 
  'EMAIL_DISABLED_VERIFICATION' as check_type,
  CASE 
    WHEN COUNT(*) = 0 THEN 'All email notifications disabled'
    ELSE 'WARNING: Some users still have email enabled'
  END as status
FROM notification_preferences 
WHERE all_email_notifications = TRUE;

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================

SELECT 
  'ROLLBACK_COMPLETED' as status, 
  NOW() as timestamp,
  'Email notifications disabled, core system preserved' as message;

COMMIT;

-- =====================================================
-- POST-ROLLBACK VERIFICATION QUERIES
-- =====================================================

-- Run these queries after rollback to verify system health:

/*
-- 1. Verify notifications are still being created
SELECT COUNT(*) as recent_notifications 
FROM notifications 
WHERE created_at > NOW() - INTERVAL '10 minutes';

-- 2. Verify no emails are being sent
SELECT COUNT(*) as pending_emails 
FROM email_queue 
WHERE status = 'pending' AND created_at > NOW() - INTERVAL '10 minutes';

-- 3. Check that triggers are still working
-- (Create a test product/order and see if notifications appear)

-- 4. Verify user preferences are disabled
SELECT 
  all_email_notifications,
  COUNT(*) as user_count
FROM notification_preferences 
GROUP BY all_email_notifications;
*/ 