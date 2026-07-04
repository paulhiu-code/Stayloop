/*
  RaveShare partner split:
  - Nominal referral rates: 2% / 2% / 1% of taxable (shown on dashboards)
  - Net payout rates: 1% / 1% / 0.5% (actual Stripe transfers)
  - StayLoop keeps 50% of each nominal slice as platform partner share
*/

ALTER TABLE referral_earnings
  ADD COLUMN IF NOT EXISTS payout_amount decimal(10, 2);

UPDATE referral_earnings
SET payout_amount = commission_amount
WHERE payout_amount IS NULL;

ALTER TABLE referral_earnings
  ALTER COLUMN payout_amount SET NOT NULL;

CREATE OR REPLACE FUNCTION calculate_referral_commissions(p_booking_id uuid)
RETURNS void AS $$
DECLARE
  v_booking bookings;
  v_host_id uuid;
  v_taxable decimal;
  v_current_referrer uuid;
  v_level integer;
  v_display_pct decimal;
  v_display_amt decimal;
  v_payout_amt decimal;
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
    v_display_pct := CASE
      WHEN v_level = 1 THEN 2.0
      WHEN v_level = 2 THEN 2.0
      WHEN v_level = 3 THEN 1.0
    END;

    v_display_amt := (v_taxable * v_display_pct) / 100;
    v_payout_amt := v_display_amt * 0.5;

    INSERT INTO referral_earnings (
      booking_id,
      earner_id,
      referee_id,
      referral_level,
      commission_percentage,
      commission_amount,
      payout_amount,
      booking_date,
      status
    ) VALUES (
      p_booking_id,
      v_current_referrer,
      v_host_id,
      v_level,
      v_display_pct,
      v_display_amt,
      v_payout_amt,
      v_booking.created_at,
      'pending'
    );

    SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_current_referrer;
    v_level := v_level + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
