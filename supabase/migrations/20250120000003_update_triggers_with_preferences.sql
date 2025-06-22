-- Update triggers to use preference-aware notification function
-- CRITICAL: All trigger functions must have comprehensive error handling
BEGIN;

-- Update order notification trigger
-- CRITICAL: This function MUST NEVER fail or block order creation
CREATE OR REPLACE FUNCTION notify_order_created()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  -- CRITICAL: Wrap all notification logic in exception handler
  BEGIN
    -- Get product and collection info
    SELECT p.name, c.name
    INTO v_product_name, v_collection_name
    FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = NEW.product_id;
    
    -- Create notifications for all relevant users
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'order_created',
          'New Order Received',
          format('New order for "%s" in collection "%s"', v_product_name, v_collection_name),
          jsonb_build_object(
            'order_number', NEW.order_number,
            'product_name', v_product_name,
            'collection_name', v_collection_name,
            'amount_sol', NEW.amount_sol
          ),
          NEW.collection_id,
          NULL,
          NEW.product_id,
          NEW.id,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          -- Log error but continue processing other recipients
          RAISE NOTICE 'Failed to create order notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- CRITICAL: Never let notification failures block order creation
      RAISE NOTICE 'Order notification failed for order %: %', NEW.id, SQLERRM;
  END;
  
  -- ALWAYS return NEW to allow the trigger to complete successfully
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update category notification trigger
-- CRITICAL: This function MUST NEVER fail or block category creation
CREATE OR REPLACE FUNCTION notify_category_created()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  -- CRITICAL: Wrap all notification logic in exception handler
  BEGIN
    -- Get collection info
    SELECT name INTO v_collection_name
    FROM collections
    WHERE id = NEW.collection_id;
    
    -- Create notifications for all relevant users
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'category_created',
          'New Category Created',
          format('New category "%s" created in collection "%s"', NEW.name, v_collection_name),
          jsonb_build_object(
            'category_name', NEW.name,
            'collection_name', v_collection_name,
            'category_type', NEW.type
          ),
          NEW.collection_id,
          NEW.id,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create category notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Category notification failed for category %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update product notification trigger
-- CRITICAL: This function MUST NEVER fail or block product creation
CREATE OR REPLACE FUNCTION notify_product_created()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_category_name TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, cat.name
    INTO v_collection_name, v_category_name
    FROM collections c
    LEFT JOIN categories cat ON cat.id = NEW.category_id
    WHERE c.id = NEW.collection_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'product_created',
          'New Product Created',
          format('New product "%s" created in collection "%s"', NEW.name, v_collection_name),
          jsonb_build_object(
            'product_name', NEW.name,
            'collection_name', v_collection_name,
            'category_name', v_category_name,
            'price', NEW.price
          ),
          NEW.collection_id,
          NEW.category_id,
          NEW.id,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create product notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Product notification failed for product %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update collection access notification trigger
-- CRITICAL: This function MUST NEVER fail or block access management
CREATE OR REPLACE FUNCTION notify_user_access_granted()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_granted_user_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, u.email
    INTO v_collection_name, v_granted_user_email
    FROM collections c, auth.users u
    WHERE c.id = NEW.collection_id AND u.id = NEW.user_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
      WHERE user_id != NEW.user_id
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'user_access_granted',
          'User Access Granted',
          format('User "%s" was granted "%s" access to collection "%s"', v_granted_user_email, NEW.access_type, v_collection_name),
          jsonb_build_object(
            'granted_user_email', v_granted_user_email,
            'collection_name', v_collection_name,
            'access_type', NEW.access_type
          ),
          NEW.collection_id,
          NULL,
          NULL,
          NULL,
          NEW.user_id
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create access notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Access notification failed for collection % user %: %', NEW.collection_id, NEW.user_id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user creation notification trigger
-- CRITICAL: This function MUST NEVER fail or block user registration
CREATE OR REPLACE FUNCTION notify_user_created()
RETURNS TRIGGER AS $$
DECLARE
  v_admin RECORD;
BEGIN
  BEGIN
    FOR v_admin IN
      SELECT u.id as user_id, u.email
      FROM auth.users u
      JOIN user_profiles up ON up.id = u.id
      WHERE up.role = 'admin'
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_admin.user_id,
          'user_created',
          'New User Registered',
          format('New user "%s" has registered', NEW.email),
          jsonb_build_object(
            'new_user_email', NEW.email,
            'created_at', NEW.created_at
          ),
          NULL,
          NULL,
          NULL,
          NULL,
          NEW.id
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create user registration notification for admin %: %', v_admin.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'User registration notification failed for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update collection creation notification trigger
-- CRITICAL: This function MUST NEVER fail or block collection creation
CREATE OR REPLACE FUNCTION notify_collection_created()
RETURNS TRIGGER AS $$
DECLARE
  v_admin RECORD;
  v_creator_email TEXT;
BEGIN
  BEGIN
    SELECT email INTO v_creator_email
    FROM auth.users
    WHERE id = NEW.user_id;
    
    FOR v_admin IN
      SELECT u.id as user_id, u.email
      FROM auth.users u
      JOIN user_profiles up ON up.id = u.id
      WHERE up.role = 'admin'
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_admin.user_id,
          'collection_created',
          'New Collection Created',
          format('New collection "%s" created by "%s"', NEW.name, v_creator_email),
          jsonb_build_object(
            'collection_name', NEW.name,
            'creator_email', v_creator_email,
            'collection_slug', NEW.slug
          ),
          NEW.id,
          NULL,
          NULL,
          NULL,
          NEW.user_id
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create collection notification for admin %: %', v_admin.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Collection notification failed for collection %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT; 