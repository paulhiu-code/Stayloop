/*
  # Signup profile metadata

  Updates the auth signup trigger so profiles are created with the user's
  selected role and name even when email confirmation is enabled and no
  authenticated client session exists immediately after signup.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_code text;
  v_referrer_id uuid;
  v_user_type text;
BEGIN
  v_referral_code := upper(nullif(NEW.raw_user_meta_data->>'referral_code', ''));
  v_user_type := COALESCE(NULLIF(NEW.raw_user_meta_data->>'user_type', ''), 'guest');

  IF v_user_type NOT IN ('guest', 'host', 'both') THEN
    v_user_type := 'guest';
  END IF;

  IF v_referral_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM profiles
    WHERE referral_code = v_referral_code
    LIMIT 1;
  END IF;

  INSERT INTO profiles (
    id,
    email,
    full_name,
    user_type,
    referred_by,
    referral_code
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    v_user_type,
    v_referrer_id,
    generate_referral_code()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    user_type = EXCLUDED.user_type,
    referred_by = COALESCE(EXCLUDED.referred_by, profiles.referred_by),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
