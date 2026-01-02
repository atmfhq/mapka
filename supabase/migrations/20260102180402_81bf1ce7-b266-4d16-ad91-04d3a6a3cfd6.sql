-- Create storage bucket for official event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('official-event-images', 'official-event-images', true);

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload official event images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'official-event-images' 
  AND auth.uid() IS NOT NULL
);

-- Allow anyone to view official event images (public bucket)
CREATE POLICY "Anyone can view official event images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'official-event-images');

-- Allow users to update their own uploads
CREATE POLICY "Users can update their own official event images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'official-event-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own official event images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'official-event-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);