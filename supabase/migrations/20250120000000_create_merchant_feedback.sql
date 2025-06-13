-- Create merchant_feedback table for emoji voting system
CREATE TABLE IF NOT EXISTS merchant_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  rocket_count INTEGER DEFAULT 0 CHECK (rocket_count >= 0),
  fire_count INTEGER DEFAULT 0 CHECK (fire_count >= 0),
  poop_count INTEGER DEFAULT 0 CHECK (poop_count >= 0),
  flag_count INTEGER DEFAULT 0 CHECK (flag_count >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique constraint to ensure one feedback record per merchant
CREATE UNIQUE INDEX IF NOT EXISTS merchant_feedback_merchant_id_idx ON merchant_feedback(merchant_id);

-- Enable RLS on merchant_feedback
ALTER TABLE merchant_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_feedback
-- Anyone can read feedback counts
CREATE POLICY "feedback_read_all"
  ON merchant_feedback
  FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can vote (handled by function)
CREATE POLICY "feedback_vote_authenticated"
  ON merchant_feedback
  FOR ALL
  TO authenticated
  USING (true);

-- Create table to track user votes to prevent abuse
CREATE TABLE IF NOT EXISTS user_feedback_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  emoji_type text NOT NULL CHECK (emoji_type IN ('rocket', 'fire', 'poop', 'flag')),
  voted_at timestamptz DEFAULT now()
);

-- Unique constraint to prevent duplicate votes
CREATE UNIQUE INDEX IF NOT EXISTS user_feedback_votes_unique_idx 
ON user_feedback_votes(user_id, merchant_id, emoji_type);

-- Enable RLS on user_feedback_votes
ALTER TABLE user_feedback_votes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own votes
CREATE POLICY "votes_read_own"
  ON user_feedback_votes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "votes_insert_own"
  ON user_feedback_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Function to vote on merchant feedback
CREATE OR REPLACE FUNCTION vote_merchant_feedback(
  p_merchant_id uuid,
  p_emoji_type text
)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_existing_vote boolean;
  v_result json;
BEGIN
  -- Get authenticated user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to vote';
  END IF;

  -- Validate emoji type
  IF p_emoji_type NOT IN ('rocket', 'fire', 'poop', 'flag') THEN
    RAISE EXCEPTION 'Invalid emoji type: %', p_emoji_type;
  END IF;

  -- Check if user already voted for this emoji on this merchant
  SELECT EXISTS(
    SELECT 1 FROM user_feedback_votes
    WHERE user_id = v_user_id
    AND merchant_id = p_merchant_id
    AND emoji_type = p_emoji_type
  ) INTO v_existing_vote;

  IF v_existing_vote THEN
    -- User already voted, remove their vote (toggle behavior)
    DELETE FROM user_feedback_votes
    WHERE user_id = v_user_id
    AND merchant_id = p_merchant_id
    AND emoji_type = p_emoji_type;

    -- Decrease the counter
    CASE p_emoji_type
      WHEN 'rocket' THEN
        UPDATE merchant_feedback
        SET rocket_count = GREATEST(rocket_count - 1, 0),
            updated_at = now()
        WHERE merchant_id = p_merchant_id;
      WHEN 'fire' THEN
        UPDATE merchant_feedback
        SET fire_count = GREATEST(fire_count - 1, 0),
            updated_at = now()
        WHERE merchant_id = p_merchant_id;
      WHEN 'poop' THEN
        UPDATE merchant_feedback
        SET poop_count = GREATEST(poop_count - 1, 0),
            updated_at = now()
        WHERE merchant_id = p_merchant_id;
      WHEN 'flag' THEN
        UPDATE merchant_feedback
        SET flag_count = GREATEST(flag_count - 1, 0),
            updated_at = now()
        WHERE merchant_id = p_merchant_id;
    END CASE;

    v_result := json_build_object('action', 'removed', 'emoji', p_emoji_type);
  ELSE
    -- User hasn't voted, add their vote
    INSERT INTO user_feedback_votes (user_id, merchant_id, emoji_type)
    VALUES (v_user_id, p_merchant_id, p_emoji_type);

    -- Ensure merchant feedback record exists
    INSERT INTO merchant_feedback (merchant_id)
    VALUES (p_merchant_id)
    ON CONFLICT (merchant_id) DO NOTHING;

    -- Increase the counter
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
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get merchant feedback with user's votes
CREATE OR REPLACE FUNCTION get_merchant_feedback(p_merchant_id uuid)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_feedback merchant_feedback%ROWTYPE;
  v_user_votes text[];
  v_result json;
BEGIN
  v_user_id := auth.uid();

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

  -- Get user's votes if authenticated
  IF v_user_id IS NOT NULL THEN
    SELECT array_agg(emoji_type) INTO v_user_votes
    FROM user_feedback_votes
    WHERE user_id = v_user_id
    AND merchant_id = p_merchant_id;
  END IF;

  v_result := json_build_object(
    'rocket_count', v_feedback.rocket_count,
    'fire_count', v_feedback.fire_count,
    'poop_count', v_feedback.poop_count,
    'flag_count', v_feedback.flag_count,
    'user_votes', COALESCE(v_user_votes, ARRAY[]::text[])
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON merchant_feedback TO authenticated;
GRANT ALL ON user_feedback_votes TO authenticated;
GRANT EXECUTE ON FUNCTION vote_merchant_feedback(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_feedback(uuid) TO authenticated; 