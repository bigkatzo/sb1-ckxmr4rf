-- Migration to add 'preparing' to the order_status_enum type
BEGIN;

-- Add the new value to the enum type
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'preparing';

COMMIT; 