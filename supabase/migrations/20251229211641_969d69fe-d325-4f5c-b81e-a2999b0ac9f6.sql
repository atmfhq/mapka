-- Drop the existing constraint
ALTER TABLE public.invitations DROP CONSTRAINT invitations_status_check;

-- Add the updated constraint that includes 'declined'
ALTER TABLE public.invitations ADD CONSTRAINT invitations_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'declined'::text, 'cancelled'::text]));