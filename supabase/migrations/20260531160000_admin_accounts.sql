/*
  Admin access for StayLoop CMS and operational tooling.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
  ON profiles(is_admin)
  WHERE is_admin = true;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (key, value)
VALUES (
  'email',
  jsonb_build_object(
    'reply_to', 'paul.hiu@gmail.com',
    'admin_recipients', jsonb_build_array(
      'alpha.media.solutions@outlook.com',
      'paul.hiu@gmail.com'
    ),
    'from_name', 'StayLoop',
    'from_email', 'noreply@stay-loop.co'
  )
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  updated_at = now();

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read platform settings" ON platform_settings;
CREATE POLICY "Admins can read platform settings"
  ON platform_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Admins can update platform settings" ON platform_settings;
CREATE POLICY "Admins can update platform settings"
  ON platform_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user() OR auth.uid() = id);
