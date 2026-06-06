/*
  Host-scoped Email CMS — hosts customize guest/host correspondence while
  StayLoop branding stays platform-controlled.
*/

-- ── Scope columns on triggers ───────────────────────────────────────────────

ALTER TABLE email_triggers
  ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS platform_trigger_slug text,
  ADD COLUMN IF NOT EXISTS is_host_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS host_editable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS send_timing jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE email_delivery_log
  ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Replace global slug uniqueness with platform vs per-host uniqueness
ALTER TABLE email_triggers DROP CONSTRAINT IF EXISTS email_triggers_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_triggers_platform_slug
  ON email_triggers(slug)
  WHERE host_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_triggers_host_slug
  ON email_triggers(host_id, slug)
  WHERE host_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_triggers_host_id
  ON email_triggers(host_id)
  WHERE host_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_triggers_platform_override
  ON email_triggers(host_id, platform_trigger_slug)
  WHERE platform_trigger_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_delivery_log_host
  ON email_delivery_log(host_id, sent_at DESC)
  WHERE host_id IS NOT NULL;

-- Hosts may override lifecycle timing (e.g. check-in reminder cadence)
CREATE TABLE IF NOT EXISTS email_host_lifecycle_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_step_slug text NOT NULL,
  delay_interval interval NOT NULL DEFAULT '0 seconds',
  delay_anchor text NOT NULL DEFAULT 'check_in'
    CHECK (delay_anchor IN ('trigger', 'check_in', 'check_out')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, platform_step_slug)
);

-- ── Helpers ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_host_account()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT user_type IN ('host', 'both')
      FROM profiles
      WHERE id = auth.uid()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_host_emails(target_host_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_admin_user()
    OR (auth.uid() = target_host_id AND public.is_host_account());
$$;

-- ── Mark platform emails hosts may customize ────────────────────────────────

UPDATE email_triggers
SET host_editable = true
WHERE host_id IS NULL
  AND slug IN (
    'booking.confirmed.guest',
    'booking.confirmed.host',
    'booking.reminder.checkin.guest',
    'review.request.guest',
    'message.new.guest',
    'message.new.host',
    'booking.cancelled.guest',
    'booking.cancelled.host',
    'payout.sent.host',
    'pms.sync.failed'
  );

-- ── RLS: hosts read platform catalog + manage own scoped rows ────────────────

DROP POLICY IF EXISTS "Hosts read platform email triggers" ON email_triggers;
CREATE POLICY "Hosts read platform email triggers"
  ON email_triggers FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR host_id IS NULL
    OR host_id = auth.uid()
  );

DROP POLICY IF EXISTS "Hosts manage own email triggers" ON email_triggers;
CREATE POLICY "Hosts manage own email triggers"
  ON email_triggers FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR (
      host_id = auth.uid()
      AND public.is_host_account()
      AND (
        is_host_custom = true
        OR platform_trigger_slug IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS "Hosts update own email triggers" ON email_triggers;
CREATE POLICY "Hosts update own email triggers"
  ON email_triggers FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR (host_id = auth.uid() AND public.is_host_account())
  )
  WITH CHECK (
    public.is_admin_user()
    OR (host_id = auth.uid() AND public.is_host_account())
  );

DROP POLICY IF EXISTS "Hosts delete own custom triggers" ON email_triggers;
CREATE POLICY "Hosts delete own custom triggers"
  ON email_triggers FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR (host_id = auth.uid() AND public.is_host_account() AND is_host_custom = true)
  );

DROP POLICY IF EXISTS "Hosts read email templates" ON email_templates;
CREATE POLICY "Hosts read email templates"
  ON email_templates FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1
      FROM email_triggers t
      WHERE t.id = email_templates.trigger_id
        AND (t.host_id IS NULL OR t.host_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Hosts manage own email templates" ON email_templates;
CREATE POLICY "Hosts manage own email templates"
  ON email_templates FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1
      FROM email_triggers t
      WHERE t.id = email_templates.trigger_id
        AND t.host_id = auth.uid()
        AND public.is_host_account()
    )
  );

DROP POLICY IF EXISTS "Hosts update own email templates" ON email_templates;
CREATE POLICY "Hosts update own email templates"
  ON email_templates FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1
      FROM email_triggers t
      WHERE t.id = email_templates.trigger_id
        AND t.host_id = auth.uid()
        AND public.is_host_account()
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1
      FROM email_triggers t
      WHERE t.id = email_templates.trigger_id
        AND t.host_id = auth.uid()
        AND public.is_host_account()
    )
  );

DROP POLICY IF EXISTS "Hosts read own delivery log" ON email_delivery_log;
CREATE POLICY "Hosts read own delivery log"
  ON email_delivery_log FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR host_id = auth.uid()
  );

ALTER TABLE email_host_lifecycle_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage lifecycle overrides" ON email_host_lifecycle_overrides;
CREATE POLICY "Hosts manage lifecycle overrides"
  ON email_host_lifecycle_overrides FOR ALL TO authenticated
  USING (public.is_admin_user() OR host_id = auth.uid())
  WITH CHECK (public.is_admin_user() OR (host_id = auth.uid() AND public.is_host_account()));
