/*
  # Property images storage bucket

  Enables hosts to upload listing photos directly (no PMS required) via the StayLoop listing wizard.

  ## What this does
  - Creates a public-read storage bucket `property-images`.
  - Lets authenticated users upload / update / delete objects ONLY within their own
    `{auth.uid()}/...` prefix, so a host can never modify another host's photos.
  - Allows public (anon + authenticated) read so guest-facing property pages can render images.

  ## Notes
  - Object path convention written by `src/lib/listing.ts`: `<user_id>/<timestamp>-<rand>.<ext>`.
  - Until this migration is applied, photo upload gracefully degrades to URL paste in the wizard.
*/

-- Create the bucket (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public read of listing photos.
DROP POLICY IF EXISTS "Property images are publicly readable" ON storage.objects;
CREATE POLICY "Property images are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'property-images');

-- Hosts can upload into their own folder only.
DROP POLICY IF EXISTS "Hosts can upload own property images" ON storage.objects;
CREATE POLICY "Hosts can upload own property images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Hosts can replace their own images.
DROP POLICY IF EXISTS "Hosts can update own property images" ON storage.objects;
CREATE POLICY "Hosts can update own property images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Hosts can delete their own images.
DROP POLICY IF EXISTS "Hosts can delete own property images" ON storage.objects;
CREATE POLICY "Hosts can delete own property images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
