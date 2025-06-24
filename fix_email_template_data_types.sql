-- Fix Email Template Data Type Issues
-- This script fixes the "{type blank}" issues in email templates
-- by ensuring all template variables have proper fallback values

BEGIN;

-- ======================================================
-- 1. ENHANCED EMAIL TEMPLATE DATA PREPARATION
-- ======================================================

-- Update the send_notification_email function to handle data better
CREATE OR REPLACE FUNCTION send_notification_email_enhanced(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_queue_id UUID;
  v_notification_id UUID;
  v_enhanced_data JSONB;
BEGIN
  BEGIN
    -- Extract notification_id if provided in data
    v_notification_id := (p_notification_data->>'notification_id')::UUID;
    
    -- Enhance the data with proper fallbacks for email templates
    v_enhanced_data := p_notification_data || jsonb_build_object(
      'notification_type', p_notification_type,
      'recipient_email', p_user_email,
      'timestamp', extract(epoch from NOW()),
      'date_formatted', to_char(NOW(), 'Mon DD, YYYY'),
      'time_formatted', to_char(NOW(), 'HH24:MI'),
      -- Ensure all common fields have fallbacks
      'product_name', COALESCE(p_notification_data->>'product_name', 'Product'),
      'collection_name', COALESCE(p_notification_data->>'collection_name', 'Collection'),
      'category_name', COALESCE(p_notification_data->>'category_name', 'Category'),
      'order_number', COALESCE(p_notification_data->>'order_number', 'N/A'),
      'customer_name', COALESCE(p_notification_data->>'customer_name', COALESCE(p_notification_data->>'customer_email', 'Customer')),
      'merchant_name', COALESCE(p_notification_data->>'merchant_name', COALESCE(p_notification_data->>'actor_email', 'Merchant')),
      'amount_sol', COALESCE((p_notification_data->>'amount_sol')::numeric, 0),
      'tracking_number', COALESCE(p_notification_data->>'tracking_number', NULL),
      'carrier', COALESCE(p_notification_data->>'carrier', 'Unknown'),
      'old_status', COALESCE(p_notification_data->>'old_status', 'unknown'),
      'new_status', COALESCE(p_notification_data->>'new_status', 'updated'),
      'rating', COALESCE((p_notification_data->>'rating')::integer, COALESCE((p_notification_data->>'new_rating')::integer, 0)),
      'review_text', COALESCE(p_notification_data->>'review_text', ''),
      'access_level', COALESCE(p_notification_data->>'access_level', 'member'),
      'role', COALESCE(p_notification_data->>'role', 'user')
    );
    
    RAISE NOTICE 'ENHANCED_EMAIL_SENDING: type=% to=% notification_id=%', 
      p_notification_type, p_user_email, v_notification_id;
    
    -- Insert into email queue with enhanced data
    INSERT INTO email_queue (
      recipient_email,
      notification_type,
      notification_data,
      notification_id,
      status
    )
    VALUES (
      p_user_email,
      p_notification_type,
      v_enhanced_data,
      v_notification_id,
      'pending'
    )
    RETURNING id INTO v_queue_id;
    
    -- Send pg_notify for immediate webhook processing
    PERFORM pg_notify('send_email', jsonb_build_object(
      'queue_id', v_queue_id,
      'notification_id', v_notification_id,
      'to', p_user_email,
      'type', p_notification_type,
      'data', v_enhanced_data,
      'priority', 'immediate'
    )::text);
    
    RAISE NOTICE 'ENHANCED_EMAIL_QUEUED: queue_id=% notification_id=% type=% to=%', 
      v_queue_id, v_notification_id, p_notification_type, p_user_email;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'ENHANCED_EMAIL_FAILED: notification_id=% type=% to=% error=%', 
        v_notification_id, p_notification_type, p_user_email, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the main send_notification_email function to use enhanced version
CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
BEGIN
  -- Use the enhanced version with better data handling
  PERFORM send_notification_email_enhanced(p_user_email, p_notification_type, p_notification_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 2. EMAIL TEMPLATE VALIDATION FUNCTION
-- ======================================================

-- Function to validate that template data has all required fields
CREATE OR REPLACE FUNCTION validate_email_template_data(
  p_type TEXT,
  p_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_required_fields TEXT[];
  v_missing_fields TEXT[] := '{}';
  v_field TEXT;
  v_validated_data JSONB;
BEGIN
  -- Define required fields by notification type
  CASE p_type
    WHEN 'order_created' THEN
      v_required_fields := ARRAY['product_name', 'collection_name', 'order_number', 'customer_name', 'amount_sol'];
    WHEN 'order_status_changed' THEN
      v_required_fields := ARRAY['product_name', 'collection_name', 'order_number', 'old_status', 'new_status'];
    WHEN 'category_created', 'category_edited', 'category_deleted' THEN
      v_required_fields := ARRAY['category_name', 'collection_name', 'merchant_name'];
    WHEN 'product_created', 'product_edited', 'product_deleted' THEN
      v_required_fields := ARRAY['product_name', 'collection_name', 'category_name', 'merchant_name'];
    WHEN 'collection_created', 'collection_edited', 'collection_deleted' THEN
      v_required_fields := ARRAY['collection_name', 'merchant_name'];
    WHEN 'tracking_added', 'tracking_removed' THEN
      v_required_fields := ARRAY['order_number', 'product_name', 'tracking_number'];
    WHEN 'user_access_granted', 'user_access_removed' THEN
      v_required_fields := ARRAY['collection_name', 'access_level'];
    WHEN 'review_added', 'review_updated' THEN
      v_required_fields := ARRAY['product_name', 'collection_name', 'rating'];
    WHEN 'user_created' THEN
      v_required_fields := ARRAY['customer_name', 'role'];
    ELSE
      v_required_fields := ARRAY[]::TEXT[];
  END CASE;
  
  -- Start with provided data
  v_validated_data := p_data;
  
  -- Check each required field and add to missing list if not present or empty
  FOREACH v_field IN ARRAY v_required_fields
  LOOP
    IF NOT (p_data ? v_field) OR (p_data ->> v_field) IS NULL OR (p_data ->> v_field) = '' THEN
      v_missing_fields := array_append(v_missing_fields, v_field);
      
      -- Add default values for missing fields
      CASE v_field
        WHEN 'product_name' THEN
          v_validated_data := v_validated_data || jsonb_build_object('product_name', 'Product');
        WHEN 'collection_name' THEN
          v_validated_data := v_validated_data || jsonb_build_object('collection_name', 'Collection');
        WHEN 'category_name' THEN
          v_validated_data := v_validated_data || jsonb_build_object('category_name', 'Category');
        WHEN 'order_number' THEN
          v_validated_data := v_validated_data || jsonb_build_object('order_number', 'N/A');
        WHEN 'customer_name' THEN
          v_validated_data := v_validated_data || jsonb_build_object('customer_name', 'Customer');
        WHEN 'merchant_name' THEN
          v_validated_data := v_validated_data || jsonb_build_object('merchant_name', 'Merchant');
        WHEN 'amount_sol' THEN
          v_validated_data := v_validated_data || jsonb_build_object('amount_sol', 0);
        WHEN 'old_status' THEN
          v_validated_data := v_validated_data || jsonb_build_object('old_status', 'unknown');
        WHEN 'new_status' THEN
          v_validated_data := v_validated_data || jsonb_build_object('new_status', 'updated');
        WHEN 'tracking_number' THEN
          v_validated_data := v_validated_data || jsonb_build_object('tracking_number', 'N/A');
        WHEN 'access_level' THEN
          v_validated_data := v_validated_data || jsonb_build_object('access_level', 'member');
        WHEN 'rating' THEN
          v_validated_data := v_validated_data || jsonb_build_object('rating', 0);
        WHEN 'role' THEN
          v_validated_data := v_validated_data || jsonb_build_object('role', 'user');
      END CASE;
    END IF;
  END LOOP;
  
  -- Add validation metadata
  v_validated_data := v_validated_data || jsonb_build_object(
    '_validation', jsonb_build_object(
      'type', p_type,
      'required_fields', to_jsonb(v_required_fields),
      'missing_fields', to_jsonb(v_missing_fields),
      'validated_at', extract(epoch from NOW())
    )
  );
  
  -- Log if there were missing fields
  IF array_length(v_missing_fields, 1) > 0 THEN
    RAISE NOTICE 'EMAIL_TEMPLATE_VALIDATION: type=% missing_fields=% defaults_added=true', 
      p_type, array_to_string(v_missing_fields, ',');
  END IF;
  
  RETURN v_validated_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 3. UPDATE CREATE_NOTIFICATION_WITH_PREFERENCES
-- ======================================================

-- Update the main notification function to use validation
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
  v_user_email TEXT;
  v_all_app_notifications BOOLEAN;
  v_all_email_notifications BOOLEAN;
  v_app_type_enabled BOOLEAN;
  v_email_type_enabled BOOLEAN;
  v_app_enabled BOOLEAN := FALSE;
  v_email_enabled BOOLEAN := FALSE;
  v_queue_id UUID;
  v_validated_data JSONB;
BEGIN
  BEGIN
    -- Get user preferences and email
    SELECT 
      u.email,
      COALESCE(np.all_app_notifications, TRUE),
      COALESCE(np.all_email_notifications, TRUE)
    INTO v_user_email, v_all_app_notifications, v_all_email_notifications
    FROM auth.users u
    LEFT JOIN notification_preferences np ON np.user_id = u.id
    WHERE u.id = p_user_id;
    
    -- Get type-specific preferences
    SELECT 
      get_notification_preference_app(p_user_id, p_type),
      get_notification_preference_email(p_user_id, p_type)
    INTO v_app_type_enabled, v_email_type_enabled;
    
    -- Determine if notifications should be sent
    v_app_enabled := COALESCE(v_all_app_notifications, TRUE) AND COALESCE(v_app_type_enabled, TRUE);
    v_email_enabled := COALESCE(v_all_email_notifications, TRUE) AND COALESCE(v_email_type_enabled, TRUE);
    
    -- Create in-app notification if enabled
    IF v_app_enabled THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        collection_id,
        category_id,
        product_id,
        order_id,
        target_user_id,
        review_id
      )
      VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_data,
        p_collection_id,
        p_category_id,
        p_product_id,
        p_order_id,
        p_target_user_id,
        p_review_id
      )
      RETURNING id INTO v_notification_id;
    END IF;
    
    -- Send email notification if enabled and user has email
    IF v_email_enabled AND v_user_email IS NOT NULL AND v_user_email != '' THEN
      BEGIN
        -- Validate and enhance email data
        v_validated_data := validate_email_template_data(p_type, p_data || jsonb_build_object(
          'title', p_title,
          'message', p_message,
          'notification_id', v_notification_id,
          'user_id', p_user_id
        ));
        
        -- Insert into email queue with validated data
        INSERT INTO email_queue (
          recipient_email,
          notification_type,
          notification_data,
          notification_id,
          status
        )
        VALUES (
          v_user_email,
          p_type,
          v_validated_data,
          v_notification_id,
          'pending'
        )
        RETURNING id INTO v_queue_id;
        
        -- Send pg_notify for immediate processing
        PERFORM pg_notify('send_email', jsonb_build_object(
          'queue_id', v_queue_id,
          'notification_id', v_notification_id,
          'to', v_user_email,
          'type', p_type,
          'data', v_validated_data,
          'priority', 'immediate'
        )::text);
        
        -- Update notification with email queue tracking
        IF v_notification_id IS NOT NULL THEN
          UPDATE notifications
          SET 
            email_sent = TRUE,
            updated_at = NOW()
          WHERE id = v_notification_id;
        END IF;
        
        RAISE NOTICE 'VALIDATED_EMAIL_QUEUED: queue_id=% notification_id=% type=% to=%', 
          v_queue_id, v_notification_id, p_type, v_user_email;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'VALIDATED_EMAIL_FAILED: type=% to=% error=% notification_id=%', 
            p_type, v_user_email, SQLERRM, v_notification_id;
      END;
    ELSE
      RAISE NOTICE 'EMAIL_SKIPPED: type=% user_id=% email_enabled=% has_email=% email=%', 
        p_type, p_user_id, v_email_enabled, (v_user_email IS NOT NULL AND v_user_email != ''), COALESCE(v_user_email, 'NULL');
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'NOTIFICATION_ERROR: user_id=% type=% error=%', p_user_id, p_type, SQLERRM;
      RETURN NULL;
  END;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 4. HELPER FUNCTIONS FOR PREFERENCE CHECKING
-- ======================================================

-- Function to get app notification preference for a type
CREATE OR REPLACE FUNCTION get_notification_preference_app(
  p_user_id UUID,
  p_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_preference BOOLEAN;
  v_sql TEXT;
BEGIN
  -- Build dynamic SQL to get the specific preference
  v_sql := format('SELECT %I FROM notification_preferences WHERE user_id = $1', p_type || '_app');
  
  BEGIN
    EXECUTE v_sql INTO v_preference USING p_user_id;
    RETURN COALESCE(v_preference, TRUE); -- Default to enabled
  EXCEPTION
    WHEN OTHERS THEN
      -- If column doesn't exist or error, default to enabled
      RETURN TRUE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get email notification preference for a type
CREATE OR REPLACE FUNCTION get_notification_preference_email(
  p_user_id UUID,
  p_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_preference BOOLEAN;
  v_sql TEXT;
BEGIN
  -- Build dynamic SQL to get the specific preference
  v_sql := format('SELECT %I FROM notification_preferences WHERE user_id = $1', p_type || '_email');
  
  BEGIN
    EXECUTE v_sql INTO v_preference USING p_user_id;
    RETURN COALESCE(v_preference, TRUE); -- Default to enabled
  EXCEPTION
    WHEN OTHERS THEN
      -- If column doesn't exist or error, default to enabled
      RETURN TRUE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 5. DEBUGGING FUNCTIONS
-- ======================================================

-- Function to test email template data validation
CREATE OR REPLACE FUNCTION test_email_template_validation()
RETURNS TABLE(
  test_name TEXT,
  notification_type TEXT,
  input_data JSONB,
  validated_data JSONB,
  missing_fields TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Order Created - Complete Data'::TEXT,
    'order_created'::TEXT,
    '{"product_name": "Test Product", "collection_name": "Test Collection", "order_number": "12345", "customer_name": "John Doe", "amount_sol": 10}'::JSONB,
    validate_email_template_data('order_created', '{"product_name": "Test Product", "collection_name": "Test Collection", "order_number": "12345", "customer_name": "John Doe", "amount_sol": 10}'::JSONB),
    ARRAY(SELECT jsonb_array_elements_text((validate_email_template_data('order_created', '{"product_name": "Test Product", "collection_name": "Test Collection", "order_number": "12345", "customer_name": "John Doe", "amount_sol": 10}'::JSONB))->'_validation'->'missing_fields'))
  UNION ALL
  SELECT 
    'Order Created - Missing Data'::TEXT,
    'order_created'::TEXT,
    '{}'::JSONB,
    validate_email_template_data('order_created', '{}'::JSONB),
    ARRAY(SELECT jsonb_array_elements_text((validate_email_template_data('order_created', '{}'::JSONB))->'_validation'->'missing_fields'))
  UNION ALL
  SELECT 
    'Category Created - Partial Data'::TEXT,
    'category_created'::TEXT,
    '{"category_name": "Test Category"}'::JSONB,
    validate_email_template_data('category_created', '{"category_name": "Test Category"}'::JSONB),
    ARRAY(SELECT jsonb_array_elements_text((validate_email_template_data('category_created', '{"category_name": "Test Category"}'::JSONB))->'_validation'->'missing_fields'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION send_notification_email_enhanced(TEXT, TEXT, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION validate_email_template_data(TEXT, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_notification_preference_app(UUID, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_notification_preference_email(UUID, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION test_email_template_validation() TO authenticated, anon, service_role;

COMMIT; 