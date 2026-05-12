/*
  # Initial Schema for Short-Term Rental Platform

  ## Overview
  This migration creates the foundational database structure for a modern short-term rental platform
  with multi-level referral compensation system (similar to EXP Realty model).

  ## New Tables

  ### 1. `profiles`
  User profile information extending Supabase auth.users
  - `id` (uuid, FK to auth.users) - Primary key
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `avatar_url` (text) - Profile picture URL
  - `user_type` (text) - 'host', 'guest', or 'both'
  - `phone` (text) - Contact phone number
  - `bio` (text) - User biography
  - `is_verified` (boolean) - Verification status
  - `referred_by` (uuid, FK to profiles) - Referrer ID for multi-level tracking
  - `referral_code` (text) - Unique referral code for this user
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `properties`
  Property listings on the platform
  - `id` (uuid) - Primary key
  - `host_id` (uuid, FK to profiles) - Property owner
  - `title` (text) - Property title
  - `description` (text) - Detailed description
  - `property_type` (text) - 'house', 'apartment', 'condo', 'villa', etc.
  - `address` (text) - Street address
  - `city` (text) - City
  - `state` (text) - State/Province
  - `country` (text) - Country
  - `postal_code` (text) - ZIP/Postal code
  - `latitude` (decimal) - Geographic coordinate
  - `longitude` (decimal) - Geographic coordinate
  - `bedrooms` (integer) - Number of bedrooms
  - `bathrooms` (decimal) - Number of bathrooms
  - `max_guests` (integer) - Maximum occupancy
  - `base_price` (decimal) - Nightly base price
  - `cleaning_fee` (decimal) - One-time cleaning fee
  - `amenities` (jsonb) - Array of amenities
  - `house_rules` (text) - Property rules
  - `images` (jsonb) - Array of image URLs
  - `instant_book` (boolean) - Allow instant booking without approval
  - `min_nights` (integer) - Minimum stay requirement
  - `max_nights` (integer) - Maximum stay limit
  - `is_active` (boolean) - Listing visibility
  - `pms_integration` (jsonb) - PMS system integration details
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `bookings`
  Guest reservations
  - `id` (uuid) - Primary key
  - `property_id` (uuid, FK to properties)
  - `guest_id` (uuid, FK to profiles)
  - `host_id` (uuid, FK to profiles) - Denormalized for quick queries
  - `check_in` (date) - Check-in date
  - `check_out` (date) - Check-out date
  - `num_guests` (integer) - Number of guests
  - `total_nights` (integer) - Total nights
  - `base_amount` (decimal) - Base price total
  - `cleaning_fee` (decimal) - Cleaning fee
  - `guest_service_fee` (decimal) - 5% guest fee
  - `host_service_fee` (decimal) - 10% host fee
  - `total_amount` (decimal) - Total amount charged to guest
  - `host_payout` (decimal) - Amount host receives
  - `status` (text) - 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'
  - `payment_intent_id` (text) - Stripe payment intent ID
  - `payout_date` (timestamptz) - When host was paid
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `availability_calendar`
  Property availability tracking
  - `id` (uuid) - Primary key
  - `property_id` (uuid, FK to properties)
  - `date` (date) - Specific date
  - `is_available` (boolean) - Available for booking
  - `price_override` (decimal) - Custom price for this date (optional)
  - `min_nights_override` (integer) - Custom min nights for this date
  - `created_at` (timestamptz)

  ### 5. `referral_earnings`
  Tracks multi-level referral commission earnings
  - `id` (uuid) - Primary key
  - `booking_id` (uuid, FK to bookings) - Source booking
  - `earner_id` (uuid, FK to profiles) - Person earning the commission
  - `referee_id` (uuid, FK to profiles) - The host who was referred
  - `referral_level` (integer) - 1, 2, or 3 (depth in referral tree)
  - `commission_percentage` (decimal) - 3%, 2%, or 1%
  - `commission_amount` (decimal) - Actual dollar amount earned
  - `booking_date` (timestamptz) - When the booking occurred
  - `payout_date` (timestamptz) - When commission was paid
  - `status` (text) - 'pending', 'paid'
  - `created_at` (timestamptz)

  ### 6. `messages`
  Communication between hosts and guests
  - `id` (uuid) - Primary key
  - `booking_id` (uuid, FK to bookings)
  - `sender_id` (uuid, FK to profiles)
  - `recipient_id` (uuid, FK to profiles)
  - `content` (text) - Message content
  - `is_read` (boolean) - Read status
  - `created_at` (timestamptz)

  ### 7. `reviews`
  Post-stay reviews
  - `id` (uuid) - Primary key
  - `booking_id` (uuid, FK to bookings)
  - `property_id` (uuid, FK to properties)
  - `reviewer_id` (uuid, FK to profiles) - Can be host or guest
  - `reviewee_id` (uuid, FK to profiles) - Can be host or guest
  - `rating` (integer) - 1-5 stars
  - `cleanliness_rating` (integer)
  - `communication_rating` (integer)
  - `accuracy_rating` (integer)
  - `location_rating` (integer)
  - `value_rating` (integer)
  - `comment` (text)
  - `created_at` (timestamptz)

  ## Security
  All tables have Row Level Security (RLS) enabled with appropriate policies for:
  - Users can only read/write their own data
  - Public read access for property listings and reviews
  - Authenticated access for bookings and messages
  - Referral earnings visible only to the earner

  ## Important Notes
  - Multi-level referral tracking via `referred_by` in profiles table
  - Commission split: Level 1 (3%), Level 2 (2%), Level 3 (1%)
  - Host fee: 10% of booking, Guest fee: 5% of booking
  - Payouts occur 24 hours after check-in (as per Airbnb model)
  - PMS integration support via JSONB field for flexibility
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  user_type text NOT NULL DEFAULT 'guest' CHECK (user_type IN ('host', 'guest', 'both')),
  phone text,
  bio text,
  is_verified boolean DEFAULT false,
  referred_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  referral_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  property_type text NOT NULL CHECK (property_type IN ('house', 'apartment', 'condo', 'villa', 'cabin', 'cottage', 'townhouse', 'loft', 'other')),
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  country text NOT NULL,
  postal_code text,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  bedrooms integer NOT NULL DEFAULT 1,
  bathrooms decimal(3, 1) NOT NULL DEFAULT 1,
  max_guests integer NOT NULL DEFAULT 2,
  base_price decimal(10, 2) NOT NULL,
  cleaning_fee decimal(10, 2) DEFAULT 0,
  amenities jsonb DEFAULT '[]'::jsonb,
  house_rules text,
  images jsonb DEFAULT '[]'::jsonb,
  instant_book boolean DEFAULT false,
  min_nights integer DEFAULT 1,
  max_nights integer DEFAULT 365,
  is_active boolean DEFAULT true,
  pms_integration jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  check_in date NOT NULL,
  check_out date NOT NULL,
  num_guests integer NOT NULL,
  total_nights integer NOT NULL,
  base_amount decimal(10, 2) NOT NULL,
  cleaning_fee decimal(10, 2) DEFAULT 0,
  guest_service_fee decimal(10, 2) NOT NULL,
  host_service_fee decimal(10, 2) NOT NULL,
  total_amount decimal(10, 2) NOT NULL,
  host_payout decimal(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  payment_intent_id text,
  payout_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_dates CHECK (check_out > check_in)
);

-- Create availability_calendar table
CREATE TABLE IF NOT EXISTS availability_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_available boolean DEFAULT true,
  price_override decimal(10, 2),
  min_nights_override integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(property_id, date)
);

-- Create referral_earnings table
CREATE TABLE IF NOT EXISTS referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  earner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_level integer NOT NULL CHECK (referral_level IN (1, 2, 3)),
  commission_percentage decimal(5, 2) NOT NULL,
  commission_amount decimal(10, 2) NOT NULL,
  booking_date timestamptz NOT NULL,
  payout_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  cleanliness_rating integer CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  communication_rating integer CHECK (communication_rating >= 1 AND communication_rating <= 5),
  accuracy_rating integer CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
  location_rating integer CHECK (location_rating >= 1 AND location_rating <= 5),
  value_rating integer CHECK (value_rating >= 1 AND value_rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(booking_id, reviewer_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_host_id ON properties(host_id);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(city, state, country);
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_id ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_host_id ON bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_availability_property_date ON availability_calendar(property_id, date);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_earner ON referral_earnings(earner_id);
CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_reviews_property ON reviews(property_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Properties policies
CREATE POLICY "Properties are viewable by everyone"
  ON properties FOR SELECT
  TO authenticated
  USING (is_active = true OR host_id = auth.uid());

CREATE POLICY "Hosts can insert own properties"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update own properties"
  ON properties FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can delete own properties"
  ON properties FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- Bookings policies
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = guest_id OR auth.uid() = host_id);

CREATE POLICY "Guests can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guest_id);

CREATE POLICY "Hosts and guests can update their bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = guest_id OR auth.uid() = host_id)
  WITH CHECK (auth.uid() = guest_id OR auth.uid() = host_id);

-- Availability calendar policies
CREATE POLICY "Everyone can view availability"
  ON availability_calendar FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Hosts can manage property availability"
  ON availability_calendar FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_id
      AND properties.host_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can update property availability"
  ON availability_calendar FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_id
      AND properties.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_id
      AND properties.host_id = auth.uid()
    )
  );

-- Referral earnings policies
CREATE POLICY "Users can view own referral earnings"
  ON referral_earnings FOR SELECT
  TO authenticated
  USING (auth.uid() = earner_id);

-- Messages policies
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update message read status"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Reviews policies
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create reviews for their bookings"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_id
      AND (bookings.guest_id = auth.uid() OR bookings.host_id = auth.uid())
      AND bookings.status = 'checked_out'
    )
  );

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, referral_code)
  VALUES (NEW.id, NEW.email, generate_referral_code());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to calculate and distribute referral commissions
CREATE OR REPLACE FUNCTION calculate_referral_commissions(p_booking_id uuid)
RETURNS void AS $$
DECLARE
  v_booking bookings;
  v_host_id uuid;
  v_host_service_fee decimal;
  v_current_referrer uuid;
  v_level integer;
  v_commission_pct decimal;
  v_commission_amt decimal;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  v_host_id := v_booking.host_id;
  v_host_service_fee := v_booking.host_service_fee;
  
  -- Get the host's referrer
  SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_host_id;
  
  -- Loop through up to 3 levels
  v_level := 1;
  WHILE v_current_referrer IS NOT NULL AND v_level <= 3 LOOP
    -- Determine commission percentage based on level
    v_commission_pct := CASE
      WHEN v_level = 1 THEN 3.0
      WHEN v_level = 2 THEN 2.0
      WHEN v_level = 3 THEN 1.0
    END;
    
    -- Calculate commission amount (percentage of host service fee)
    v_commission_amt := (v_host_service_fee * v_commission_pct) / 100;
    
    -- Insert referral earning record
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
    
    -- Move up the referral chain
    SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_current_referrer;
    v_level := v_level + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to calculate referral commissions when booking is confirmed
CREATE OR REPLACE FUNCTION trigger_referral_commissions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    PERFORM calculate_referral_commissions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_booking_confirmed ON bookings;
CREATE TRIGGER on_booking_confirmed
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_referral_commissions();