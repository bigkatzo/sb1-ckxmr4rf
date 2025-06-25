-- RESTORE CORRECT 2-LAYER NOTIFICATION ARCHITECTURE
-- This migration fixes the broken architecture where preferences were blocking basic notification creation
-- Layer 1: create_notification (ALWAYS works - for audit trail and system integrity)
-- Layer 2: create_notification_with_preferences (Handles preferences and emails)

BEGIN;

-- ======================================================
-- STEP 1: FIX create_notification_with_preferences
-- It should ALWAYS create the basic notification, only preferences affect email
-- ======================================================

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
  v_should_send_app BOOLEAN;
  v_should_send_email BOOLEAN;
BEGIN
  -- CRITICAL: Wrap all logic in exception handler
  BEGIN
    -- LAYER 1: ALWAYS CREATE THE BASIC NOTIFICATION (for audit trail and system integrity)
    -- This ensures notifications are NEVER lost due to preference issues
    BEGIN
      SELECT create_notification(
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
      ) INTO v_notification_id;
      
      RAISE NOTICE 'LAYER1_SUCCESS: Created basic notification % for user %', v_notification_id, p_user_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue - this is critical
        RAISE NOTICE 'LAYER1_FAILED: Failed to create basic notification for user %: %', p_user_id, SQLERRM;
        RETURN NULL;
    END;
    
    -- LAYER 2: CHECK PREFERENCES FOR EMAIL DELIVERY ONLY
    -- Note: App notifications are already created above, preferences only control emails
    BEGIN
      -- Check if user wants email notifications (defaults to TRUE on error)
      v_should_send_email := should_send_notification(p_user_id, p_type, 'email');
      
      -- Send email notification if user wants it
      IF v_should_send_email THEN
        BEGIN
          -- Get user email
          SELECT email INTO v_user_email
          FROM auth.users
          WHERE id = p_user_id;
          
          -- Send email notification if user has email
          IF v_user_email IS NOT NULL AND v_user_email != '' THEN
            -- Use the email sending function
            PERFORM send_notification_email(v_user_email, p_type, p_data);
            
            -- Mark email as sent if we created a notification
            IF v_notification_id IS NOT NULL THEN
              UPDATE notifications
              SET email_sent = TRUE
              WHERE id = v_notification_id;
            END IF;
            
            RAISE NOTICE 'LAYER2_EMAIL_SUCCESS: Sent email for notification % to %', v_notification_id, v_user_email;
          ELSE
            RAISE NOTICE 'LAYER2_EMAIL_SKIP: No email for user %', p_user_id;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            -- Log error but don't fail - email is optional
            RAISE NOTICE 'LAYER2_EMAIL_FAILED: Failed to send email for notification % user %: %', v_notification_id, p_user_id, SQLERRM;
        END;
      ELSE
        RAISE NOTICE 'LAYER2_EMAIL_DISABLED: User % disabled email notifications for type %', p_user_id, p_type;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue - basic notification already created
        RAISE NOTICE 'LAYER2_FAILED: Email layer failed for notification % user %: %', v_notification_id, p_user_id, SQLERRM;
    END;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- CRITICAL: Log error but never fail the operation
      RAISE NOTICE 'CRITICAL_ERROR: create_notification_with_preferences failed for user %: %', p_user_id, SQLERRM;
      RETURN NULL;
  END;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- STEP 2: UPDATE ALL TRIGGERS TO USE CORRECT ARCHITECTURE
-- Use create_notification_with_preferences which now has the correct 2-layer approach
-- ======================================================

-- CATEGORY TRIGGERS
CREATE OR REPLACE FUNCTION notify_category_created()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT name INTO v_collection_name
    FROM collections
    WHERE id = NEW.collection_id;
    
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        -- Use the corrected 2-layer function
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'category_created',
          'New Category Created',
          format('New category "%s" created in collection "%s" by %s', NEW.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'category_name', NEW.name,
            'collection_name', v_collection_name,
            'category_type', COALESCE(NEW.type, 'general'),
            'actor_email', v_actor_email,
            'merchant_name', v_actor_email,
            'category_id', NEW.id,
            'collection_id', NEW.collection_id
          ),
          NEW.collection_id,
          NEW.id,
          NULL,
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

CREATE OR REPLACE FUNCTION notify_category_edited()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT name INTO v_collection_name
    FROM collections
    WHERE id = NEW.collection_id;
    
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'category_edited',
          'Category Updated',
          format('Category "%s" was updated in collection "%s" by %s', NEW.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'category_name', NEW.name,
            'collection_name', v_collection_name,
            'category_type', COALESCE(NEW.type, 'general'),
            'old_name', OLD.name,
            'old_type', COALESCE(OLD.type, 'general'),
            'actor_email', v_actor_email,
            'merchant_name', v_actor_email,
            'category_id', NEW.id,
            'collection_id', NEW.collection_id
          ),
          NEW.collection_id,
          NEW.id,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create category edit notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Category edit notification failed for category %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_category_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT name INTO v_collection_name
    FROM collections
    WHERE id = OLD.collection_id;
    
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(OLD.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'category_deleted',
          'Category Deleted',
          format('Category "%s" was deleted from collection "%s" by %s', OLD.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'category_name', OLD.name,
            'collection_name', v_collection_name,
            'category_type', COALESCE(OLD.type, 'general'),
            'actor_email', v_actor_email,
            'merchant_name', v_actor_email,
            'category_id', OLD.id,
            'collection_id', OLD.collection_id
          ),
          OLD.collection_id,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create category delete notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Category delete notification failed for category %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PRODUCT TRIGGERS
CREATE OR REPLACE FUNCTION notify_product_created()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_category_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, cat.name
    INTO v_collection_name, v_category_name
    FROM collections c
    LEFT JOIN categories cat ON cat.id = NEW.category_id
    WHERE c.id = NEW.collection_id;
    
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'product_created',
          'New Product Created',
          format('New product "%s" created in collection "%s" by %s', NEW.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'product_name', NEW.name,
            'collection_name', v_collection_name,
            'category_name', COALESCE(v_category_name, 'Uncategorized'),
            'price', COALESCE(NEW.price, 0),
            'actor_email', v_actor_email,
            'merchant_name', v_actor_email,
            'product_id', NEW.id,
            'category_id', NEW.category_id,
            'collection_id', NEW.collection_id
          ),
          NEW.collection_id,
          NEW.category_id,
          NEW.id,
          NULL,
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

CREATE OR REPLACE FUNCTION notify_product_edited()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_category_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, cat.name
    INTO v_collection_name, v_category_name
    FROM collections c
    LEFT JOIN categories cat ON cat.id = NEW.category_id
    WHERE c.id = NEW.collection_id;
    
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'product_edited',
          'Product Updated',
          format('Product "%s" was updated in collection "%s" by %s', NEW.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'product_name', NEW.name,
            'collection_name', v_collection_name,
            'category_name', COALESCE(v_category_name, 'Uncategorized'),
            'price', COALESCE(NEW.price, 0),
            'old_name', OLD.name,
            'old_price', COALESCE(OLD.price, 0),
            'actor_email', v_actor_email,
            'merchant_name', v_actor_email,
            'product_id', NEW.id,
            'category_id', NEW.category_id,
            'collection_id', NEW.collection_id
          ),
          NEW.collection_id,
          NEW.category_id,
          NEW.id,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create product edit notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Product edit notification failed for product %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_product_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_category_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, cat.name
    INTO v_collection_name, v_category_name
    FROM collections c
    LEFT JOIN categories cat ON cat.id = OLD.category_id
    WHERE c.id = OLD.collection_id;
    
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(OLD.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'product_deleted',
          'Product Deleted',
          format('Product "%s" was deleted from collection "%s" by %s', OLD.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'product_name', OLD.name,
            'collection_name', v_collection_name,
            'category_name', COALESCE(v_category_name, 'Uncategorized'),
            'price', COALESCE(OLD.price, 0),
            'actor_email', v_actor_email,
            'merchant_name', v_actor_email,
            'product_id', OLD.id,
            'category_id', OLD.category_id,
            'collection_id', OLD.collection_id
          ),
          OLD.collection_id,
          OLD.category_id,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create product delete notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Product delete notification failed for product %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- COLLECTION TRIGGERS
CREATE OR REPLACE FUNCTION notify_collection_created()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_email TEXT;
  v_admin RECORD;
BEGIN
  BEGIN
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
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
          format('New collection "%s" was created by %s', NEW.name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'collection_name', NEW.name,
            'collection_description', COALESCE(NEW.description, ''),
            'actor_email', v_actor_email,
            'merchant_name', v_actor_email,
            'collection_id', NEW.id,
            'collection_slug', NEW.slug
          ),
          NEW.id,
          NULL,
          NULL,
          NULL,
          auth.uid(),
          NULL
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

CREATE OR REPLACE FUNCTION notify_collection_edited()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_email TEXT;
  v_admin RECORD;
BEGIN
  BEGIN
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_admin IN
      SELECT u.id as user_id, u.email
      FROM auth.users u
      JOIN user_profiles up ON up.id = u.id
      WHERE up.role = 'admin'
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_admin.user_id,
          'collection_edited',
          'Collection Updated',
          format('Collection "%s" was updated by %s', NEW.name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'collection_name', NEW.name,
            'collection_description', COALESCE(NEW.description, ''),
            'old_name', OLD.name,
            'old_description', COALESCE(OLD.description, ''),
            'actor_email', v_actor_email,
            'merchant_name', v_actor_email,
            'collection_id', NEW.id,
            'collection_slug', NEW.slug
          ),
          NEW.id,
          NULL,
          NULL,
          NULL,
          auth.uid(),
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create collection edit notification for admin %: %', v_admin.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Collection edit notification failed for collection %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_collection_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_email TEXT;
  v_admin RECORD;
BEGIN
  BEGIN
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_admin IN
      SELECT u.id as user_id, u.email
      FROM auth.users u
      JOIN user_profiles up ON up.id = u.id
      WHERE up.role = 'admin'
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_admin.user_id,
          'collection_deleted',
          'Collection Deleted',
          format('Collection "%s" was deleted by %s', OLD.name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'collection_name', OLD.name,
            'collection_description', COALESCE(OLD.description, ''),
            'actor_email', v_actor_email,
            'merchant_name', v_actor_email,
            'collection_id', OLD.id,
            'collection_slug', OLD.slug
          ),
          NULL,
          NULL,
          NULL,
          NULL,
          auth.uid(),
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create collection delete notification for admin %: %', v_admin.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Collection delete notification failed for collection %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ORDER TRIGGERS
CREATE OR REPLACE FUNCTION notify_order_created()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT p.name, c.name
    INTO v_product_name, v_collection_name
    FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = NEW.product_id;
    
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
            'amount_sol', COALESCE(NEW.amount_sol, 0),
            'customer_email', COALESCE(NEW.customer_email, 'Anonymous'),
            'customer_name', COALESCE(NEW.customer_email, 'Anonymous Customer'),
            'is_anonymous', CASE WHEN NEW.user_id IS NULL THEN true ELSE false END,
            'order_id', NEW.id,
            'product_id', NEW.product_id,
            'collection_id', NEW.collection_id,
            'order_status', NEW.status
          ),
          NEW.collection_id,
          NULL,
          NEW.product_id,
          NEW.id,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create order notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Order notification failed for order %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_order_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  BEGIN
    SELECT p.name, c.name
    INTO v_product_name, v_collection_name
    FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = NEW.product_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_recipient.user_id,
          'order_status_changed',
          'Order Status Updated',
          format('Order status changed from "%s" to "%s" for "%s"', OLD.status, NEW.status, v_product_name),
          jsonb_build_object(
            'order_number', NEW.order_number,
            'product_name', v_product_name,
            'collection_name', v_collection_name,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'amount_sol', COALESCE(NEW.amount_sol, 0),
            'customer_email', COALESCE(NEW.customer_email, 'Anonymous'),
            'customer_name', COALESCE(NEW.customer_email, 'Anonymous Customer'),
            'order_id', NEW.id,
            'product_id', NEW.product_id,
            'collection_id', NEW.collection_id,
            'tracking_number', null -- Will be populated by tracking trigger
          ),
          NEW.collection_id,
          NULL,
          NEW.product_id,
          NEW.id,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create order status notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Order status notification failed for order %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRACKING TRIGGERS (conditional on table existence)
DO $tracking_triggers_block$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'order_tracking') THEN
    
    CREATE OR REPLACE FUNCTION notify_tracking_added()
    RETURNS TRIGGER AS $tracking_added_func$
    DECLARE
      v_product_name TEXT;
      v_collection_name TEXT;
      v_order_number TEXT;
      v_collection_id UUID;
      v_recipient RECORD;
    BEGIN
      BEGIN
        -- Get order details from the related order
        SELECT p.name, c.name, o.order_number, o.collection_id
        INTO v_product_name, v_collection_name, v_order_number, v_collection_id
        FROM orders o
        JOIN products p ON p.id = o.product_id
        JOIN collections c ON c.id = p.collection_id
        WHERE o.id = NEW.order_id;
        
        FOR v_recipient IN
          SELECT * FROM get_collection_notification_recipients(v_collection_id)
        LOOP
          BEGIN
            PERFORM create_notification_with_preferences(
              v_recipient.user_id,
              'tracking_added',
              'Tracking Number Added',
              format('Tracking number added for order "%s"', v_order_number),
              jsonb_build_object(
                'order_number', v_order_number,
                'product_name', v_product_name,
                'collection_name', v_collection_name,
                'tracking_number', NEW.tracking_number,
                'carrier', COALESCE(NEW.carrier, 'Unknown'),
                'tracking_info', NEW.tracking_number,
                'order_id', NEW.order_id,
                'product_id', (SELECT product_id FROM orders WHERE id = NEW.order_id),
                'collection_id', v_collection_id
              ),
              v_collection_id,
              NULL,
              (SELECT product_id FROM orders WHERE id = NEW.order_id),
              NEW.order_id,
              NULL,
              NULL
            );
          EXCEPTION
            WHEN OTHERS THEN
              RAISE NOTICE 'Failed to create tracking added notification for user %: %', v_recipient.user_id, SQLERRM;
          END;
        END LOOP;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Tracking added notification failed for order_tracking %: %', NEW.id, SQLERRM;
      END;
      
      RETURN NEW;
    END;
    $tracking_added_func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    CREATE OR REPLACE FUNCTION notify_tracking_removed()
    RETURNS TRIGGER AS $tracking_removed_func$
    DECLARE
      v_product_name TEXT;
      v_collection_name TEXT;
      v_order_number TEXT;
      v_collection_id UUID;
      v_recipient RECORD;
    BEGIN
      BEGIN
        -- Get order details from the related order
        SELECT p.name, c.name, o.order_number, o.collection_id
        INTO v_product_name, v_collection_name, v_order_number, v_collection_id
        FROM orders o
        JOIN products p ON p.id = o.product_id
        JOIN collections c ON c.id = p.collection_id
        WHERE o.id = OLD.order_id;
        
        FOR v_recipient IN
          SELECT * FROM get_collection_notification_recipients(v_collection_id)
        LOOP
          BEGIN
            PERFORM create_notification_with_preferences(
              v_recipient.user_id,
              'tracking_removed',
              'Tracking Number Removed',
              format('Tracking number removed for order "%s"', v_order_number),
              jsonb_build_object(
                'order_number', v_order_number,
                'product_name', v_product_name,
                'collection_name', v_collection_name,
                'old_tracking_number', OLD.tracking_number,
                'carrier', COALESCE(OLD.carrier, 'Unknown'),
                'tracking_info', OLD.tracking_number,
                'order_id', OLD.order_id,
                'product_id', (SELECT product_id FROM orders WHERE id = OLD.order_id),
                'collection_id', v_collection_id
              ),
              v_collection_id,
              NULL,
              (SELECT product_id FROM orders WHERE id = OLD.order_id),
              OLD.order_id,
              NULL,
              NULL
            );
          EXCEPTION
            WHEN OTHERS THEN
              RAISE NOTICE 'Failed to create tracking removed notification for user %: %', v_recipient.user_id, SQLERRM;
          END;
        END LOOP;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Tracking removed notification failed for order_tracking %: %', OLD.id, SQLERRM;
      END;
      
      RETURN OLD;
    END;
    $tracking_removed_func$ LANGUAGE plpgsql SECURITY DEFINER;
    
  END IF;
END $tracking_triggers_block$;

-- USER ACCESS TRIGGERS
CREATE OR REPLACE FUNCTION notify_user_access_granted()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_granted_user_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT name INTO v_collection_name
    FROM collections
    WHERE id = NEW.collection_id;
    
    SELECT email INTO v_granted_user_email
    FROM auth.users
    WHERE id = NEW.user_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      -- Don't notify the user who was granted access
      IF v_recipient.user_id != NEW.user_id THEN
        BEGIN
          PERFORM create_notification_with_preferences(
            v_recipient.user_id,
            'user_access_granted',
            'User Access Granted',
            format('User "%s" was granted access to collection "%s"', COALESCE(v_granted_user_email, 'unknown'), v_collection_name),
            jsonb_build_object(
              'granted_user_email', v_granted_user_email,
              'collection_name', v_collection_name,
              'access_level', COALESCE(NEW.role, 'member'),
              'granted_user_id', NEW.user_id,
              'collection_id', NEW.collection_id
            ),
            NEW.collection_id,
            NULL,
            NULL,
            NULL,
            NEW.user_id,
            NULL
          );
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE 'Failed to create user access notification for user %: %', v_recipient.user_id, SQLERRM;
        END;
      END IF;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'User access notification failed for collection_access %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_user_access_removed()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_removed_user_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT name INTO v_collection_name
    FROM collections
    WHERE id = OLD.collection_id;
    
    SELECT email INTO v_removed_user_email
    FROM auth.users
    WHERE id = OLD.user_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(OLD.collection_id)
    LOOP
      -- Don't notify the user who was removed
      IF v_recipient.user_id != OLD.user_id THEN
        BEGIN
          PERFORM create_notification_with_preferences(
            v_recipient.user_id,
            'user_access_removed',
            'User Access Removed',
            format('User "%s" access was removed from collection "%s"', COALESCE(v_removed_user_email, 'unknown'), v_collection_name),
            jsonb_build_object(
              'removed_user_email', v_removed_user_email,
              'collection_name', v_collection_name,
              'previous_access_level', COALESCE(OLD.role, 'member'),
              'removed_user_id', OLD.user_id,
              'collection_id', OLD.collection_id
            ),
            OLD.collection_id,
            NULL,
            NULL,
            NULL,
            OLD.user_id,
            NULL
          );
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE 'Failed to create user access removal notification for user %: %', v_recipient.user_id, SQLERRM;
        END;
      END IF;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'User access removal notification failed for collection_access %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USER CREATION TRIGGER
CREATE OR REPLACE FUNCTION notify_user_created()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
  v_admin RECORD;
BEGIN
  BEGIN
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = NEW.id;
    
    FOR v_admin IN
      SELECT u.id as user_id, u.email
      FROM auth.users u
      JOIN user_profiles up ON up.id = u.id
      WHERE up.role = 'admin'
      AND u.id != NEW.id
    LOOP
      BEGIN
        PERFORM create_notification_with_preferences(
          v_admin.user_id,
          'user_created',
          'New User Registered',
          format('New user "%s" has registered with role "%s"', COALESCE(v_user_email, 'unknown'), NEW.role),
          jsonb_build_object(
            'new_user_email', v_user_email,
            'user_id', NEW.id,
            'role', NEW.role,
            'created_at', NEW.created_at,
            'customer_name', v_user_email
          ),
          NULL,
          NULL,
          NULL,
          NULL,
          NEW.id,
          NULL
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

-- REVIEW TRIGGERS (conditional on table existence)
DO $review_triggers_block$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_reviews') THEN
    
    CREATE OR REPLACE FUNCTION notify_review_added()
    RETURNS TRIGGER AS $review_added_func$
    DECLARE
      v_product_name TEXT;
      v_collection_name TEXT;
      v_recipient RECORD;
    BEGIN
      BEGIN
        SELECT p.name, c.name
        INTO v_product_name, v_collection_name
        FROM products p
        JOIN collections c ON c.id = p.collection_id
        WHERE p.id = NEW.product_id;
        
        FOR v_recipient IN
          SELECT * FROM get_collection_notification_recipients(
            (SELECT collection_id FROM products WHERE id = NEW.product_id)
          )
        LOOP
          BEGIN
            PERFORM create_notification_with_preferences(
              v_recipient.user_id,
              'review_added',
              'New Review Added',
              format('New review added for "%s" by wallet %s', v_product_name, COALESCE(LEFT(NEW.wallet_address, 8) || '...', 'anonymous')),
              jsonb_build_object(
                'product_name', v_product_name,
                'collection_name', v_collection_name,
                'wallet_address', NEW.wallet_address,
                'rating', NEW.product_rating,
                'review_text', LEFT(NEW.review_text, 100),
                'is_verified_purchase', NEW.is_verified_purchase,
                'review_id', NEW.id,
                'product_id', NEW.product_id,
                'collection_id', (SELECT collection_id FROM products WHERE id = NEW.product_id)
              ),
              (SELECT collection_id FROM products WHERE id = NEW.product_id),
              NULL,
              NEW.product_id,
              NEW.order_id,
              NULL,
              NEW.id
            );
          EXCEPTION
            WHEN OTHERS THEN
              RAISE NOTICE 'Failed to create review added notification for user %: %', v_recipient.user_id, SQLERRM;
          END;
        END LOOP;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Review added notification failed for review %: %', NEW.id, SQLERRM;
      END;
      
      RETURN NEW;
    END;
    $review_added_func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    CREATE OR REPLACE FUNCTION notify_review_updated()
    RETURNS TRIGGER AS $review_updated_func$
    DECLARE
      v_product_name TEXT;
      v_collection_name TEXT;
      v_recipient RECORD;
    BEGIN
      BEGIN
        SELECT p.name, c.name
        INTO v_product_name, v_collection_name
        FROM products p
        JOIN collections c ON c.id = p.collection_id
        WHERE p.id = NEW.product_id;
        
        FOR v_recipient IN
          SELECT * FROM get_collection_notification_recipients(
            (SELECT collection_id FROM products WHERE id = NEW.product_id)
          )
        LOOP
          BEGIN
            PERFORM create_notification_with_preferences(
              v_recipient.user_id,
              'review_updated',
              'Review Updated',
              format('Review updated for "%s" by wallet %s', v_product_name, COALESCE(LEFT(NEW.wallet_address, 8) || '...', 'anonymous')),
              jsonb_build_object(
                'product_name', v_product_name,
                'collection_name', v_collection_name,
                'wallet_address', NEW.wallet_address,
                'old_rating', OLD.product_rating,
                'new_rating', NEW.product_rating,
                'review_text', LEFT(NEW.review_text, 100),
                'is_verified_purchase', NEW.is_verified_purchase,
                'review_id', NEW.id,
                'product_id', NEW.product_id,
                'collection_id', (SELECT collection_id FROM products WHERE id = NEW.product_id)
              ),
              (SELECT collection_id FROM products WHERE id = NEW.product_id),
              NULL,
              NEW.product_id,
              NEW.order_id,
              NULL,
              NEW.id
            );
          EXCEPTION
            WHEN OTHERS THEN
              RAISE NOTICE 'Failed to create review updated notification for user %: %', v_recipient.user_id, SQLERRM;
          END;
        END LOOP;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Review updated notification failed for review %: %', NEW.id, SQLERRM;
      END;
      
      RETURN NEW;
    END;
    $review_updated_func$ LANGUAGE plpgsql SECURITY DEFINER;
    
  END IF;
END $review_triggers_block$;

-- ======================================================
-- STEP 3: GRANT PERMISSIONS
-- ======================================================

GRANT EXECUTE ON FUNCTION create_notification_with_preferences(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID, UUID) TO authenticated, anon;

COMMIT; 