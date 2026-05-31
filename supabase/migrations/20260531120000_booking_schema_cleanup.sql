/*
  # Booking schema cleanup

  - Backfill duplicate Stripe-era columns from canonical booking fields
  - Keep legacy and Stripe columns in sync on insert/update
*/

UPDATE bookings
SET
  check_in_date = COALESCE(check_in_date, check_in),
  check_out_date = COALESCE(check_out_date, check_out),
  guest_user_id = COALESCE(guest_user_id, guest_id),
  host_user_id = COALESCE(host_user_id, host_id),
  stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, payment_intent_id),
  total_amount_cents = COALESCE(
    total_amount_cents,
    ROUND(total_amount * 100)::integer
  )
WHERE check_in_date IS NULL
   OR check_out_date IS NULL
   OR guest_user_id IS NULL
   OR host_user_id IS NULL
   OR stripe_payment_intent_id IS NULL
   OR total_amount_cents IS NULL;

CREATE OR REPLACE FUNCTION sync_booking_mirror_columns()
RETURNS TRIGGER AS $$
BEGIN
  NEW.check_in := COALESCE(NEW.check_in, NEW.check_in_date);
  NEW.check_out := COALESCE(NEW.check_out, NEW.check_out_date);
  NEW.check_in_date := COALESCE(NEW.check_in_date, NEW.check_in);
  NEW.check_out_date := COALESCE(NEW.check_out_date, NEW.check_out);
  NEW.guest_id := COALESCE(NEW.guest_id, NEW.guest_user_id);
  NEW.host_id := COALESCE(NEW.host_id, NEW.host_user_id);
  NEW.guest_user_id := COALESCE(NEW.guest_user_id, NEW.guest_id);
  NEW.host_user_id := COALESCE(NEW.host_user_id, NEW.host_id);
  NEW.payment_intent_id := COALESCE(NEW.payment_intent_id, NEW.stripe_payment_intent_id);
  NEW.stripe_payment_intent_id := COALESCE(NEW.stripe_payment_intent_id, NEW.payment_intent_id);

  IF NEW.total_amount_cents IS NULL AND NEW.total_amount IS NOT NULL THEN
    NEW.total_amount_cents := ROUND(NEW.total_amount * 100)::integer;
  ELSIF NEW.total_amount IS NULL AND NEW.total_amount_cents IS NOT NULL THEN
    NEW.total_amount := NEW.total_amount_cents / 100.0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_booking_mirror_columns ON bookings;
CREATE TRIGGER sync_booking_mirror_columns
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION sync_booking_mirror_columns();
