-- 🔧 NOTIFICATION DEBUG HELPER FUNCTIONS
-- These functions support the debugging process

-- Function to check if all required tables exist
CREATE OR REPLACE FUNCTION debug_check_tables()
RETURNS TABLE(table_name TEXT, table_exists BOOLEAN, row_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'notifications'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications'),
    COALESCE((SELECT count(*) FROM notifications), 0)
  UNION ALL
  SELECT 
    'notification_preferences'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_preferences'),
    COALESCE((SELECT count(*) FROM notification_preferences), 0)
  UNION ALL
  SELECT 
    'email_queue'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'email_queue'),
    COALESCE((SELECT count(*) FROM email_queue), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if all required triggers exist
CREATE OR REPLACE FUNCTION debug_check_triggers()
RETURNS TABLE(trigger_name TEXT, table_name TEXT, function_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.trigger_name::TEXT,
    t.event_object_table::TEXT,
    t.action_statement::TEXT
  FROM information_schema.triggers t
  WHERE t.trigger_schema = 'public'
  AND t.trigger_name LIKE '%_trigger'
  ORDER BY t.event_object_table, t.trigger_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent notification activity with details
CREATE OR REPLACE FUNCTION debug_get_recent_activity()
RETURNS TABLE(
  notification_id UUID,
  user_email TEXT,
  notification_type TEXT,
  email_sent BOOLEAN,
  notification_created_at TIMESTAMPTZ,
  email_queue_id UUID,
  email_status TEXT,
  email_attempts INTEGER,
  email_error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    u.email,
    n.type,
    n.email_sent,
    n.created_at,
    eq.id,
    eq.status,
    eq.attempts,
    eq.error_message
  FROM notifications n
  LEFT JOIN auth.users u ON u.id = n.user_id
  LEFT JOIN email_queue eq ON eq.notification_type = n.type 
    AND eq.recipient_email = u.email
    AND eq.created_at >= n.created_at - INTERVAL '1 minute'
    AND eq.created_at <= n.created_at + INTERVAL '5 minutes'
  WHERE n.created_at > NOW() - INTERVAL '24 hours'
  ORDER BY n.created_at DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to test notification preferences for a user
CREATE OR REPLACE FUNCTION debug_check_user_preferences(p_user_email TEXT)
RETURNS TABLE(
  user_id UUID,
  user_email TEXT,
  has_preferences BOOLEAN,
  all_app_notifications BOOLEAN,
  all_email_notifications BOOLEAN,
  category_created_email BOOLEAN,
  product_created_email BOOLEAN,
  order_created_email BOOLEAN,
  effective_email_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    (np.user_id IS NOT NULL),
    COALESCE(np.all_app_notifications, TRUE),
    COALESCE(np.all_email_notifications, TRUE),
    COALESCE(np.category_created_email, TRUE),
    COALESCE(np.product_created_email, TRUE),
    COALESCE(np.order_created_email, TRUE),
    COALESCE(np.all_email_notifications, TRUE)
  FROM auth.users u
  LEFT JOIN notification_preferences np ON np.user_id = u.id
  WHERE u.email = p_user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a test notification and track its progress
CREATE OR REPLACE FUNCTION debug_create_test_notification(
  p_user_email TEXT,
  p_notification_type TEXT DEFAULT 'debug_test'
)
RETURNS TABLE(
  step_name TEXT,
  success BOOLEAN,
  details TEXT,
  notification_id UUID,
  email_queue_id UUID
) AS $$
DECLARE
  v_user_id UUID;
  v_notification_id UUID;
  v_collection_id UUID;
  v_email_queue_count_before INTEGER;
  v_email_queue_count_after INTEGER;
  v_new_email_id UUID;
BEGIN
  -- Step 1: Find user
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = p_user_email;
  
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 'find_user'::TEXT, FALSE, 'User not found'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 'find_user'::TEXT, TRUE, format('Found user: %s', v_user_id)::TEXT, NULL::UUID, NULL::UUID;

  -- Step 2: Find a collection for testing
  SELECT id INTO v_collection_id 
  FROM collections 
  LIMIT 1;
  
  IF v_collection_id IS NULL THEN
    RETURN QUERY SELECT 'find_collection'::TEXT, FALSE, 'No collections found'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 'find_collection'::TEXT, TRUE, format('Found collection: %s', v_collection_id)::TEXT, NULL::UUID, NULL::UUID;

  -- Step 3: Count emails before
  SELECT COUNT(*) INTO v_email_queue_count_before FROM email_queue;
  RETURN QUERY SELECT 'count_emails_before'::TEXT, TRUE, format('Email queue count before: %s', v_email_queue_count_before)::TEXT, NULL::UUID, NULL::UUID;

  -- Step 4: Create notification
  BEGIN
    SELECT create_notification_with_preferences(
      v_user_id,
      p_notification_type,
      'Debug Test Notification',
      format('Debug test notification created at %s', NOW()),
      jsonb_build_object('debug', true, 'timestamp', extract(epoch from NOW())),
      v_collection_id
    ) INTO v_notification_id;
    
    IF v_notification_id IS NOT NULL THEN
      RETURN QUERY SELECT 'create_notification'::TEXT, TRUE, format('Notification created: %s', v_notification_id)::TEXT, v_notification_id, NULL::UUID;
    ELSE
      RETURN QUERY SELECT 'create_notification'::TEXT, FALSE, 'Notification creation returned NULL'::TEXT, NULL::UUID, NULL::UUID;
      RETURN;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'create_notification'::TEXT, FALSE, format('Error: %s', SQLERRM)::TEXT, NULL::UUID, NULL::UUID;
      RETURN;
  END;

  -- Step 5: Wait and check email queue
  PERFORM pg_sleep(2);
  
  SELECT COUNT(*) INTO v_email_queue_count_after FROM email_queue;
  RETURN QUERY SELECT 'count_emails_after'::TEXT, TRUE, format('Email queue count after: %s (diff: %s)', v_email_queue_count_after, v_email_queue_count_after - v_email_queue_count_before)::TEXT, v_notification_id, NULL::UUID;

  -- Step 6: Find the new email if it exists
  SELECT id INTO v_new_email_id
  FROM email_queue
  WHERE notification_type = p_notification_type
  AND recipient_email = p_user_email
  AND created_at > NOW() - INTERVAL '1 minute'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_new_email_id IS NOT NULL THEN
    RETURN QUERY SELECT 'find_new_email'::TEXT, TRUE, format('Found new email: %s', v_new_email_id)::TEXT, v_notification_id, v_new_email_id;
  ELSE
    RETURN QUERY SELECT 'find_new_email'::TEXT, FALSE, 'No new email found in queue'::TEXT, v_notification_id, NULL::UUID;
  END IF;

  -- Step 7: Final summary
  RETURN QUERY SELECT 'summary'::TEXT, 
    (v_notification_id IS NOT NULL AND v_new_email_id IS NOT NULL), 
    CASE 
      WHEN v_notification_id IS NULL THEN 'Notification creation failed'
      WHEN v_new_email_id IS NULL THEN 'Notification created but email not queued'
      ELSE 'Success: Both notification and email created'
    END::TEXT,
    v_notification_id, 
    v_new_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to simulate a trigger firing
CREATE OR REPLACE FUNCTION debug_simulate_category_trigger(
  p_collection_id UUID,
  p_category_name TEXT DEFAULT NULL
)
RETURNS TABLE(
  step_name TEXT,
  success BOOLEAN,
  details TEXT,
  category_id UUID,
  notifications_created INTEGER,
  emails_queued INTEGER
) AS $$
DECLARE
  v_category_id UUID;
  v_category_name TEXT;
  v_notifications_before INTEGER;
  v_notifications_after INTEGER;
  v_emails_before INTEGER;
  v_emails_after INTEGER;
BEGIN
  v_category_name := COALESCE(p_category_name, format('Debug-Category-%s', extract(epoch from NOW())));

  -- Count before
  SELECT COUNT(*) INTO v_notifications_before FROM notifications;
  SELECT COUNT(*) INTO v_emails_before FROM email_queue;
  
  RETURN QUERY SELECT 'count_before'::TEXT, TRUE, format('Before: %s notifications, %s emails', v_notifications_before, v_emails_before)::TEXT, NULL::UUID, 0, 0;

  -- Create category (this should trigger notifications)
  BEGIN
    INSERT INTO categories (name, type, collection_id, description)
    VALUES (v_category_name, 'design', p_collection_id, 'Debug test category')
    RETURNING id INTO v_category_id;
    
    RETURN QUERY SELECT 'create_category'::TEXT, TRUE, format('Category created: %s', v_category_id)::TEXT, v_category_id, 0, 0;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'create_category'::TEXT, FALSE, format('Error: %s', SQLERRM)::TEXT, NULL::UUID, 0, 0;
      RETURN;
  END;

  -- Wait for triggers
  PERFORM pg_sleep(2);

  -- Count after
  SELECT COUNT(*) INTO v_notifications_after FROM notifications;
  SELECT COUNT(*) INTO v_emails_after FROM email_queue;
  
  RETURN QUERY SELECT 'count_after'::TEXT, TRUE, 
    format('After: %s notifications (+%s), %s emails (+%s)', 
      v_notifications_after, v_notifications_after - v_notifications_before,
      v_emails_after, v_emails_after - v_emails_before)::TEXT, 
    v_category_id, 
    v_notifications_after - v_notifications_before, 
    v_emails_after - v_emails_before;

  -- Clean up the test category
  DELETE FROM categories WHERE id = v_category_id;
  RETURN QUERY SELECT 'cleanup'::TEXT, TRUE, 'Test category deleted'::TEXT, v_category_id, 0, 0;

  -- Final assessment
  RETURN QUERY SELECT 'assessment'::TEXT, 
    (v_notifications_after > v_notifications_before),
    CASE 
      WHEN v_notifications_after <= v_notifications_before THEN 'FAIL: No notifications created - triggers not firing'
      WHEN v_emails_after <= v_emails_before THEN 'PARTIAL: Notifications created but no emails queued'
      ELSE 'SUCCESS: Both notifications and emails created'
    END::TEXT,
    v_category_id,
    v_notifications_after - v_notifications_before,
    v_emails_after - v_emails_before;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_check_tables() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION debug_check_triggers() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION debug_get_recent_activity() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION debug_check_user_preferences(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION debug_create_test_notification(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION debug_simulate_category_trigger(UUID, TEXT) TO authenticated, anon; 