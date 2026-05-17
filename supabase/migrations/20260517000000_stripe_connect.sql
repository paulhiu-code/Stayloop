/*
  # Stripe Connect

  Adds Stripe Express connected-account fields to host profiles and augments
  bookings with Stripe PaymentIntent and payout release tracking.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_payout_status') THEN
    CREATE TYPE booking_payout_status AS ENUM ('pending', 'released', 'failed');
  END IF;
END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id varchar,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_account_id
  ON profiles(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  host_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  check_in date,
  check_out date,
  num_guests integer NOT NULL DEFAULT 1,
  total_nights integer NOT NULL DEFAULT 1,
  base_amount decimal(10, 2) NOT NULL DEFAULT 0,
  cleaning_fee decimal(10, 2) NOT NULL DEFAULT 0,
  guest_service_fee decimal(10, 2) NOT NULL DEFAULT 0,
  host_service_fee decimal(10, 2) NOT NULL DEFAULT 0,
  total_amount decimal(10, 2) NOT NULL DEFAULT 0,
  host_payout decimal(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  payment_intent_id text,
  payout_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guest_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS host_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS check_in_date date,
  ADD COLUMN IF NOT EXISTS check_out_date date,
  ADD COLUMN IF NOT EXISTS total_amount_cents integer,
  ADD COLUMN IF NOT EXISTS platform_fee_amount integer,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id varchar,
  ADD COLUMN IF NOT EXISTS payout_status booking_payout_status NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_id
  ON bookings(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_payout_status
  ON bookings(payout_status);

CREATE INDEX IF NOT EXISTS idx_bookings_guest_user_id
  ON bookings(guest_user_id);

CREATE INDEX IF NOT EXISTS idx_bookings_host_user_id
  ON bookings(host_user_id);
