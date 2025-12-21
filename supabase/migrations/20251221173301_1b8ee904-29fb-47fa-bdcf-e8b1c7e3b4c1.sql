-- Drop the existing status check constraint
ALTER TABLE public.invitations DROP CONSTRAINT invitations_status_check;

-- Add a new constraint that includes 'cancelled' status
ALTER TABLE public.invitations ADD CONSTRAINT invitations_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text]));