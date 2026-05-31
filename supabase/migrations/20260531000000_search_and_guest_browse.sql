/*
  Guest search and browse: public review access, review stats view,
  extended property types, and search_properties RPC for anonymous guests.
*/

-- ── Anon read access for reviews ────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can view reviews" ON reviews;
CREATE POLICY "Anon can view reviews"
  ON reviews FOR SELECT
  TO anon
  USING (true);

-- ── Property review aggregates ──────────────────────────────────────────────

CREATE OR REPLACE VIEW public.property_review_stats AS
SELECT
  property_id,
  ROUND(AVG(rating)::numeric, 2) AS avg_rating,
  COUNT(*)::integer AS review_count
FROM reviews
GROUP BY property_id;

GRANT SELECT ON public.property_review_stats TO anon, authenticated;

-- ── Extended property types ───────────────────────────────────────────────────

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_property_type_check;
ALTER TABLE properties ADD CONSTRAINT properties_property_type_check
  CHECK (property_type IN (
    'house', 'apartment', 'condo', 'villa', 'cabin', 'cottage',
    'townhouse', 'loft', 'other',
    'unique_stay', 'entire_home', 'hotel_room', 'beach_house'
  ));

-- ── Search RPC ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_properties(
  p_location text DEFAULT NULL,
  p_check_in date DEFAULT NULL,
  p_check_out date DEFAULT NULL,
  p_guests integer DEFAULT 1,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_property_types text[] DEFAULT NULL,
  p_amenities text[] DEFAULT NULL,
  p_instant_book boolean DEFAULT NULL,
  p_sort text DEFAULT 'recommended',
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  host_id uuid,
  title text,
  description text,
  property_type text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  latitude numeric,
  longitude numeric,
  bedrooms integer,
  bathrooms numeric,
  max_guests integer,
  base_price numeric,
  cleaning_fee numeric,
  amenities jsonb,
  house_rules text,
  images jsonb,
  instant_book boolean,
  min_nights integer,
  max_nights integer,
  is_active boolean,
  pms_integration jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  avg_rating numeric,
  review_count integer,
  nights integer,
  total_price numeric,
  recommended_score numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nights integer;
  v_has_dates boolean;
BEGIN
  v_has_dates := p_check_in IS NOT NULL AND p_check_out IS NOT NULL AND p_check_out > p_check_in;
  v_nights := CASE WHEN v_has_dates THEN (p_check_out - p_check_in)::integer ELSE NULL END;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.*,
      prs.avg_rating AS stat_avg_rating,
      COALESCE(prs.review_count, 0) AS stat_review_count,
      v_nights AS calc_nights,
      CASE
        WHEN v_has_dates THEN
          ROUND(
            ((p.base_price * v_nights) + COALESCE(p.cleaning_fee, 0))
            * 1.05,
            2
          )
        ELSE NULL
      END AS calc_total_price,
      (
        COALESCE(prs.avg_rating, 0) * 20
        + LEAST(COALESCE(prs.review_count, 0), 100)
        + CASE WHEN p.instant_book THEN 15 ELSE 0 END
        + CASE WHEN COALESCE(prs.review_count, 0) >= 10 THEN 10 ELSE 0 END
      )::numeric AS calc_recommended_score
    FROM properties p
    LEFT JOIN property_review_stats prs ON prs.property_id = p.id
    WHERE p.is_active = true
      AND p.max_guests >= GREATEST(COALESCE(p_guests, 1), 1)
      AND (
        p_location IS NULL
        OR btrim(p_location) = ''
        OR p.title ILIKE '%' || p_location || '%'
        OR p.city ILIKE '%' || p_location || '%'
        OR p.state ILIKE '%' || p_location || '%'
        OR p.country ILIKE '%' || p_location || '%'
        OR p.description ILIKE '%' || p_location || '%'
      )
      AND (p_property_types IS NULL OR p.property_type = ANY(p_property_types))
      AND (p_amenities IS NULL OR p.amenities @> to_jsonb(p_amenities))
      AND (p_instant_book IS NULL OR p.instant_book = p_instant_book)
      AND (
        NOT v_has_dates
        OR NOT EXISTS (
          SELECT 1
          FROM availability_calendar ac
          WHERE ac.property_id = p.id
            AND ac.date >= p_check_in
            AND ac.date < p_check_out
            AND ac.is_available = false
        )
      )
      AND (
        NOT v_has_dates
        OR NOT EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.property_id = p.id
            AND b.status IN ('pending', 'confirmed', 'checked_in')
            AND b.check_in < p_check_out
            AND b.check_out > p_check_in
        )
      )
  ),
  priced AS (
    SELECT
      f.*,
      COALESCE(f.calc_total_price, f.base_price) AS sort_price
    FROM filtered f
    WHERE (
      p_min_price IS NULL
      OR COALESCE(f.calc_total_price, f.base_price) >= p_min_price
    )
    AND (
      p_max_price IS NULL
      OR COALESCE(f.calc_total_price, f.base_price) <= p_max_price
    )
  )
  SELECT
    priced.id,
    priced.host_id,
    priced.title,
    priced.description,
    priced.property_type,
    priced.address,
    priced.city,
    priced.state,
    priced.country,
    priced.postal_code,
    priced.latitude,
    priced.longitude,
    priced.bedrooms,
    priced.bathrooms,
    priced.max_guests,
    priced.base_price,
    priced.cleaning_fee,
    priced.amenities,
    priced.house_rules,
    priced.images,
    priced.instant_book,
    priced.min_nights,
    priced.max_nights,
    priced.is_active,
    priced.pms_integration,
    priced.created_at,
    priced.updated_at,
    priced.stat_avg_rating,
    priced.stat_review_count,
    priced.calc_nights,
    priced.calc_total_price,
    priced.calc_recommended_score
  FROM priced
  ORDER BY
    CASE WHEN p_sort = 'price_asc' THEN priced.sort_price END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN priced.sort_price END DESC NULLS LAST,
    CASE WHEN p_sort = 'rating' THEN priced.stat_avg_rating END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest' THEN EXTRACT(EPOCH FROM priced.created_at) END DESC NULLS LAST,
    CASE WHEN p_sort = 'recommended' OR p_sort IS NULL THEN priced.calc_recommended_score END DESC NULLS LAST,
    priced.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 24), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_properties(
  text, date, date, integer, numeric, numeric, text[], text[], boolean, text, integer, integer
) TO anon, authenticated;
