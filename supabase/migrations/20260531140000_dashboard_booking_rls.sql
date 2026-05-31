/*
  Dashboard booking access: align RLS with guest_user_id / host_user_id columns
  used by Stripe checkout while keeping guest_id / host_id compatibility.
*/

DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT TO authenticated
  USING (
    auth.uid() = guest_id
    OR auth.uid() = host_id
    OR auth.uid() = guest_user_id
    OR auth.uid() = host_user_id
  );

DROP POLICY IF EXISTS "Hosts and guests can update their bookings" ON bookings;
CREATE POLICY "Hosts and guests can update their bookings"
  ON bookings FOR UPDATE TO authenticated
  USING (
    auth.uid() = guest_id
    OR auth.uid() = host_id
    OR auth.uid() = guest_user_id
    OR auth.uid() = host_user_id
  )
  WITH CHECK (
    auth.uid() = guest_id
    OR auth.uid() = host_id
    OR auth.uid() = guest_user_id
    OR auth.uid() = host_user_id
  );

DROP POLICY IF EXISTS "Guests create bookings" ON bookings;
CREATE POLICY "Guests create bookings"
  ON bookings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = guest_id
    OR auth.uid() = guest_user_id
  );
