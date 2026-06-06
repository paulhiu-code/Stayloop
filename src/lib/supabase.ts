import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  user_type: 'host' | 'guest' | 'both';
  phone: string | null;
  bio: string | null;
  is_verified: boolean;
  referred_by: string | null;
  referral_code: string;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  property_type: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  base_price: number;
  cleaning_fee: number;
  amenities: string[];
  house_rules: string | null;
  images: string[];
  instant_book: boolean;
  min_nights: number;
  max_nights: number;
  is_active: boolean;
  pms_integration: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Booking = {
  id: string;
  property_id: string;
  guest_id: string;
  host_id: string;
  check_in: string;
  check_out: string;
  num_guests: number;
  total_nights: number;
  base_amount: number;
  cleaning_fee: number;
  guest_service_fee: number;
  host_service_fee: number;
  total_amount: number;
  host_payout: number;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  payment_intent_id: string | null;
  payout_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ReferralEarning = {
  id: string;
  booking_id: string;
  earner_id: string;
  referee_id: string;
  referral_level: 1 | 2 | 3;
  commission_percentage: number;
  commission_amount: number;
  booking_date: string;
  payout_date: string | null;
  status: 'pending' | 'paid';
  stripe_transfer_id?: string | null;
  created_at: string;
};
