/*
  # Demo seed data for guest discovery and booking flows

  Inserts a demo host, six showcase properties (matching frontend UUIDs),
  and 90 days of availability calendar rows.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  demo_host_id uuid := '11111111-1111-1111-1111-111111111101';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = demo_host_id) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      demo_host_id,
      'authenticated',
      'authenticated',
      'demo-host@stayloop.dev',
      crypt('StayLoopDemo2026!', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"StayLoop Demo Host","user_type":"host"}'::jsonb,
      false
    );
  END IF;

  UPDATE profiles
  SET
    full_name = COALESCE(full_name, 'StayLoop Demo Host'),
    user_type = 'both',
    is_verified = true,
    stripe_charges_enabled = true,
    stripe_payouts_enabled = true,
    stripe_onboarding_complete = true,
    updated_at = now()
  WHERE id = demo_host_id;
END $$;

INSERT INTO properties (
  id, host_id, title, description, property_type, address, city, state, country,
  bedrooms, bathrooms, max_guests, base_price, cleaning_fee, amenities, images,
  instant_book, min_nights, max_nights, is_active
) VALUES
(
  '22222222-2222-2222-2222-222222222201',
  '11111111-1111-1111-1111-111111111101',
  'Desert glass house with canyon views',
  'A private architectural retreat built for sunrise coffee, stargazing, and quiet weekends.',
  'other', 'Private Road', 'Sedona', 'AZ', 'United States',
  3, 2, 6, 342, 155,
  '["Hot tub","Mountain view","Workspace","Fire pit"]'::jsonb,
  '["https://images.pexels.com/photos/208736/pexels-photo-208736.jpeg?auto=compress&cs=tinysrgb&w=1400"]'::jsonb,
  true, 2, 28, true
),
(
  '22222222-2222-2222-2222-222222222202',
  '11111111-1111-1111-1111-111111111101',
  'Historic townhome near Forsyth Park',
  'A warm city escape with hotel-grade linens, walkable dining, and a shaded courtyard.',
  'house', 'Historic District', 'Savannah', 'GA', 'United States',
  2, 2, 4, 218, 95,
  '["Walkable","Courtyard","King bed","Kitchen"]'::jsonb,
  '["https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=1400"]'::jsonb,
  false, 2, 21, true
),
(
  '22222222-2222-2222-2222-222222222203',
  '11111111-1111-1111-1111-111111111101',
  'Boutique lodge room steps from the lifts',
  'A polished hotel-room stay with daily service, mountain access, and a fireplace lounge.',
  'other', 'Base Village', 'Aspen', 'CO', 'United States',
  1, 1, 2, 289, 55,
  '["Ski access","Concierge","Breakfast","Valet"]'::jsonb,
  '["https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=1400"]'::jsonb,
  true, 1, 14, true
),
(
  '22222222-2222-2222-2222-222222222204',
  '11111111-1111-1111-1111-111111111101',
  'Oceanfront family home with private deck',
  'Room for the whole crew, direct beach access, and everything set up for longer stays.',
  'house', 'Ocean Drive', 'Outer Banks', 'NC', 'United States',
  5, 4, 10, 476, 225,
  '["Beachfront","Pet friendly","Game room","Grill"]'::jsonb,
  '["https://images.pexels.com/photos/1438834/pexels-photo-1438834.jpeg?auto=compress&cs=tinysrgb&w=1400"]'::jsonb,
  true, 3, 30, true
),
(
  '22222222-2222-2222-2222-222222222205',
  '11111111-1111-1111-1111-111111111101',
  'Work-ready bungalow near South Congress',
  'Fast Wi-Fi, a quiet office, fenced yard, and easy access to Austin restaurants and music.',
  'house', 'South Congress', 'Austin', 'TX', 'United States',
  2, 1, 4, 184, 80,
  '["Fast Wi-Fi","Office","Pet friendly","Parking"]'::jsonb,
  '["https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1400"]'::jsonb,
  false, 2, 45, true
),
(
  '22222222-2222-2222-2222-222222222206',
  '11111111-1111-1111-1111-111111111101',
  'Modern cabin between lake and trails',
  'A cozy four-season cabin with a cedar sauna, gear storage, and trail access nearby.',
  'cabin', 'North Shore', 'Lake Tahoe', 'CA', 'United States',
  3, 2, 7, 264, 130,
  '["Sauna","Trails","Lake access","Fireplace"]'::jsonb,
  '["https://images.pexels.com/photos/803975/pexels-photo-803975.jpeg?auto=compress&cs=tinysrgb&w=1400"]'::jsonb,
  true, 2, 21, true
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  base_price = EXCLUDED.base_price,
  cleaning_fee = EXCLUDED.cleaning_fee,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO availability_calendar (property_id, date, is_available, source)
SELECT
  p.id,
  d::date,
  true,
  'stayloop'
FROM properties p
CROSS JOIN generate_series(current_date, current_date + interval '90 days', interval '1 day') AS d
WHERE p.host_id = '11111111-1111-1111-1111-111111111101'
ON CONFLICT (property_id, date) DO NOTHING;
