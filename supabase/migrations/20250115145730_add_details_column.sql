-- Add details column to transaction_logs table
ALTER TABLE transaction_logs ADD COLUMN details JSONB DEFAULT NULL;

-- Drop existing update_transaction_status function
DROP FUNCTION IF EXISTS update_transaction_status(text, text, text);

-- Create new update_transaction_status function with details parameter
CREATE OR REPLACE FUNCTION update_transaction_status(
  p_signature text,
  p_status text,
  p_details JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE transaction_logs
  SET 
    status = p_status,
    details = p_details,
    retry_count = CASE 
      WHEN p_status = 'failed' THEN retry_count + 1 
      ELSE retry_count 
    END,
    updated_at = now()
  WHERE signature = p_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 