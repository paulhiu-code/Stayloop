/*
  Rev-share fixes:
  - Commission base = taxable (base_amount + cleaning_fee), not % of host_service_fee dollars
  - Support host_user_id in commission walk
  - Prevent duplicate commission rows per booking
  - Fire on INSERT when status is already confirmed
  - Track Stripe transfer id on referral_earnings
*/

ALTER TABLE referral_earnings
  ADD COLUMN IF NOT EXISTS stripe_transfer_id varchar;

CREATE INDEX IF NOT EXISTS idx_referral_earnings_booking
  ON referral_earnings(booking_id);

CREATE OR REPLACE FUNCTION calculate_referral_commissions(p_booking_id uuid)
RETURNS void AS $$
DECLARE
  v_booking bookings;
  v_host_id uuid;
  v_taxable decimal;
  v_current_referrer uuid;
  v_level integer;
  v_commission_pct decimal;
  v_commission_amt decimal;
BEGIN
  IF EXISTS (SELECT 1 FROM referral_earnings WHERE booking_id = p_booking_id) THEN
    RETURN;
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_host_id := COALESCE(v_booking.host_user_id, v_booking.host_id);
  IF v_host_id IS NULL THEN
    RETURN;
  END IF;

  v_taxable := COALESCE(v_booking.base_amount, 0) + COALESCE(v_booking.cleaning_fee, 0);
  IF v_taxable <= 0 THEN
    v_taxable := GREATEST(COALESCE(v_booking.total_amount, 0) - COALESCE(v_booking.guest_service_fee, 0), 0);
  END IF;

  SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_host_id;

  v_level := 1;
  WHILE v_current_referrer IS NOT NULL AND v_level <= 3 LOOP
    v_commission_pct := CASE
      WHEN v_level = 1 THEN 3.0
      WHEN v_level = 2 THEN 2.0
      WHEN v_level = 3 THEN 1.0
    END;

    v_commission_amt := (v_taxable * v_commission_pct) / 100;

    INSERT INTO referral_earnings (
      booking_id,
      earner_id,
      referee_id,
      referral_level,
      commission_percentage,
      commission_amount,
      booking_date,
      status
    ) VALUES (
      p_booking_id,
      v_current_referrer,
      v_host_id,
      v_level,
      v_commission_pct,
      v_commission_amt,
      v_booking.created_at,
      'pending'
    );

    SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_current_referrer;
    v_level := v_level + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_referral_commissions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    PERFORM calculate_referral_commissions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_booking_confirmed ON bookings;
CREATE TRIGGER on_booking_confirmed
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_referral_commissions();
