/*
  StayLoop Email CMS — triggers, templates, delivery log, sequences.
*/

CREATE TABLE IF NOT EXISTS email_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  recipient_role text NOT NULL DEFAULT 'guest',
  variables_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id uuid NOT NULL REFERENCES email_triggers(id) ON DELETE CASCADE,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL DEFAULT '',
  preview_text text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trigger_id)
);

CREATE TABLE IF NOT EXISTS email_template_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES email_triggers(id) ON DELETE CASCADE,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL DEFAULT '',
  version integer NOT NULL,
  edited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  anchor_trigger_id uuid REFERENCES email_triggers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES email_triggers(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 0,
  delay_interval interval NOT NULL DEFAULT '0 seconds',
  delay_anchor text NOT NULL DEFAULT 'trigger' CHECK (delay_anchor IN ('trigger', 'check_in', 'check_out')),
  condition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, step_order)
);

CREATE TABLE IF NOT EXISTS email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id uuid REFERENCES email_triggers(id) ON DELETE SET NULL,
  trigger_slug text NOT NULL,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'preview')),
  provider_message_id text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_triggers_category ON email_triggers(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_sent_at ON email_delivery_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_trigger ON email_delivery_log(trigger_slug, sent_at DESC);

ALTER TABLE email_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage email triggers" ON email_triggers;
CREATE POLICY "Admins manage email triggers"
  ON email_triggers FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins manage email templates" ON email_templates;
CREATE POLICY "Admins manage email templates"
  ON email_templates FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins read email template revisions" ON email_template_revisions;
CREATE POLICY "Admins read email template revisions"
  ON email_template_revisions FOR SELECT TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Admins insert email template revisions" ON email_template_revisions;
CREATE POLICY "Admins insert email template revisions"
  ON email_template_revisions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins manage email sequences" ON email_sequences;
CREATE POLICY "Admins manage email sequences"
  ON email_sequences FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins manage email sequence steps" ON email_sequence_steps;
CREATE POLICY "Admins manage email sequence steps"
  ON email_sequence_steps FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins read email delivery log" ON email_delivery_log;
CREATE POLICY "Admins read email delivery log"
  ON email_delivery_log FOR SELECT TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Service role manages email delivery log" ON email_delivery_log;
CREATE POLICY "Service role manages email delivery log"
  ON email_delivery_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.snapshot_email_template_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO email_template_revisions (
    template_id,
    trigger_id,
    subject,
    html_body,
    text_body,
    version,
    edited_by
  )
  VALUES (
    NEW.id,
    NEW.trigger_id,
    NEW.subject,
    NEW.html_body,
    NEW.text_body,
    NEW.version,
    NEW.updated_by
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_email_template_revision ON email_templates;
CREATE TRIGGER on_email_template_revision
  AFTER INSERT OR UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_email_template_revision();

CREATE OR REPLACE FUNCTION public.touch_email_trigger_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE email_triggers
  SET updated_at = now()
  WHERE id = NEW.trigger_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_email_template_touch_trigger ON email_templates;
CREATE TRIGGER on_email_template_touch_trigger
  AFTER UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_email_trigger_updated_at();
