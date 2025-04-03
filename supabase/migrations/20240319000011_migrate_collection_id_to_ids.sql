-- Start transaction
BEGIN;

-- Grant necessary permissions for the apply_coupon_to_order function
GRANT EXECUTE ON FUNCTION apply_coupon_to_order TO public;

COMMIT; 