-- Simple merchant feedback system with browser-based rate limiting
-- No vote tracking needed - just aggregate counters

-- Update merchant feedback policies to allow wallet users to vote
DROP POLICY IF EXISTS "feedback_read_all" ON merchant_feedback;
DROP POLICY IF EXISTS "feedback_vote_authenticated" ON merchant_feedback;

CREATE POLICY "feedback_read_all_users"
  ON merchant_feedback
  FOR SELECT
  USING (true); -- Anyone can read feedback counts

CREATE POLICY "feedback_update_by_wallet"
  ON merchant_feedback
  FOR ALL
  USING (auth.get_header_values()->>'wallet_address' IS NOT NULL);

-- Simple vote function - no abuse prevention at database level
CREATE OR REPLACE FUNCTION vote_merchant_feedback(
  p_merchant_id uuid,
  p_emoji_type text
)
RETURNS json AS $$
DECLARE
  v_wallet_address text;
  v_result json;
  auth_info jsonb;
BEGIN
  -- Get wallet from headers
  auth_info := auth.get_header_values();
  v_wallet_address := auth_info->>'wallet_address';
  
  -- Must have wallet connected to vote
  IF v_wallet_address IS NULL THEN
    RAISE EXCEPTION 'Must connect wallet to rate merchants';
  END IF;

  -- Validate emoji type
  IF p_emoji_type NOT IN ('rocket', 'fire', 'poop', 'flag') THEN
    RAISE EXCEPTION 'Invalid emoji type: %', p_emoji_type;
  END IF;

  -- Ensure merchant feedback record exists
  INSERT INTO merchant_feedback (merchant_id)
  VALUES (p_merchant_id)
  ON CONFLICT (merchant_id) DO NOTHING;

  -- Simply increment the counter (no toggle behavior)
  CASE p_emoji_type
    WHEN 'rocket' THEN
      UPDATE merchant_feedback
      SET rocket_count = rocket_count + 1,
          updated_at = now()
      WHERE merchant_id = p_merchant_id;
    WHEN 'fire' THEN
      UPDATE merchant_feedback
      SET fire_count = fire_count + 1,
          updated_at = now()
      WHERE merchant_id = p_merchant_id;
    WHEN 'poop' THEN
      UPDATE merchant_feedback
      SET poop_count = poop_count + 1,
          updated_at = now()
      WHERE merchant_id = p_merchant_id;
    WHEN 'flag' THEN
      UPDATE merchant_feedback
      SET flag_count = flag_count + 1,
          updated_at = now()
      WHERE merchant_id = p_merchant_id;
  END CASE;

  v_result := json_build_object('action', 'added', 'emoji', p_emoji_type);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simple function to get merchant feedback counts
CREATE OR REPLACE FUNCTION get_merchant_feedback(p_merchant_id uuid)
RETURNS json AS $$
DECLARE
  v_feedback merchant_feedback%ROWTYPE;
  v_result json;
BEGIN
  -- Get feedback counts
  SELECT * INTO v_feedback
  FROM merchant_feedback
  WHERE merchant_id = p_merchant_id;

  -- If no feedback record exists, return zeros
  IF v_feedback IS NULL THEN
    v_feedback.rocket_count := 0;
    v_feedback.fire_count := 0;
    v_feedback.poop_count := 0;
    v_feedback.flag_count := 0;
  END IF;

  -- Return just the aggregate counts
  v_result := json_build_object(
    'rocket_count', v_feedback.rocket_count,
    'fire_count', v_feedback.fire_count,
    'poop_count', v_feedback.poop_count,
    'flag_count', v_feedback.flag_count
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to anonymous users
GRANT EXECUTE ON FUNCTION vote_merchant_feedback(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_feedback(uuid) TO anon, authenticated; 