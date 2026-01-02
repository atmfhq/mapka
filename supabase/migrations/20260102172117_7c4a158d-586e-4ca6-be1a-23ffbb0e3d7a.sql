-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Add official event fields to megaphones table
ALTER TABLE public.megaphones
ADD COLUMN is_official boolean NOT NULL DEFAULT false,
ADD COLUMN cover_image_url text,
ADD COLUMN organizer_display_name text,
ADD COLUMN external_link text,
ADD COLUMN location_details text;

-- 7. Create policy to ensure only admins can create official events
CREATE POLICY "Only admins can create official events"
ON public.megaphones FOR INSERT
WITH CHECK (
  (is_official = false) OR public.has_role(auth.uid(), 'admin')
);

-- 8. Update existing insert policy to handle official flag
DROP POLICY IF EXISTS "Users can create their own megaphones" ON public.megaphones;

CREATE POLICY "Users can create their own megaphones"
ON public.megaphones FOR INSERT
WITH CHECK (
  auth.uid() = host_id 
  AND ((is_official = false) OR public.has_role(auth.uid(), 'admin'))
);

-- 9. Ensure only admins can update is_official to true
CREATE OR REPLACE FUNCTION public.check_official_event_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If trying to set is_official to true, verify user is admin
  IF NEW.is_official = true AND (OLD.is_official IS NULL OR OLD.is_official = false) THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only administrators can create official events';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_official_event_admin
BEFORE INSERT OR UPDATE ON public.megaphones
FOR EACH ROW
EXECUTE FUNCTION public.check_official_event_update();