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
  max_adults?: number | null;
  max_children?: number | null;
  max_pets?: number | null;
  base_price: number;
  cleaning_fee: number;
  amenities: string[];
  house_rules: string | null;
  images: string[];
  instant_book: boolean;
  min_nights: number;
  max_nights: number;
  check_in_time?: string | null;
  check_out_time?: string | null;
  currency_code?: string;
  timezone?: string | null;
  cancellation_policy?: string | null;
  is_active: boolean;
  pms_integration: Record<string, unknown> | null;
  external_pms_property_id?: string | null;
  external_pms_provider?: string | null;
  synced_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Booking = {
  id: string;
  property_id: string;
  guest_id: string | null;
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
  stripe_payment_intent_id?: string | null;
  payout_date: string | null;
  payout_status?: 'pending' | 'released' | 'failed' | null;
  external_pms_booking_id?: string | null;
  external_pms_provider?: string | null;
  booking_source?: string;
  is_block?: boolean;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  synced_at?: string | null;
  sync_direction?: 'native' | 'from_pms' | 'to_pms';
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
  created_at: string;
};
