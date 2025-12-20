-- Create event_participants join table
CREATE TABLE public.event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.megaphones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'pending', 'declined')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Event participants are viewable by everyone" 
ON public.event_participants 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can join events" 
ON public.event_participants 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation" 
ON public.event_participants 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can leave events" 
ON public.event_participants 
FOR DELETE 
USING (auth.uid() = user_id);