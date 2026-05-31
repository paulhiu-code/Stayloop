/*
  Hand-maintained database types for StayLoop.

  Regenerate from a linked Supabase project with:
    npm run gen:types
*/

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BookingPayoutStatus = 'pending' | 'released' | 'failed';

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

export type DatabaseBooking = {
  id: string;
  property_id: string;
  guest_id: string;
  host_id: string;
  guest_user_id: string | null;
  host_user_id: string | null;
  check_in: string;
  check_out: string;
  check_in_date: string | null;
  check_out_date: string | null;
  num_guests: number;
  total_nights: number;
  base_amount: number;
  cleaning_fee: number;
  guest_service_fee: number;
  host_service_fee: number;
  total_amount: number;
  host_payout: number;
  status: BookingStatus;
  payment_intent_id: string | null;
  stripe_payment_intent_id: string | null;
  total_amount_cents: number | null;
  platform_fee_amount: number | null;
  payout_status: BookingPayoutStatus;
  payout_date: string | null;
  created_at: string;
  updated_at: string;
};
