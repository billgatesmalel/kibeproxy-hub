-- Run this in your Supabase SQL Editor to enforce strict Database-level bans

-- We want to prevent banned users from SELECTING or INSERTING into the proxies or emails tables.
-- Note: Make sure RLS is already enabled on these tables.

-- Drop existing generic policies if they exist (to replace with stricter ones)
DROP POLICY IF EXISTS "Users can read own proxies" ON proxies;
DROP POLICY IF EXISTS "Users can read own emails" ON emails;
DROP POLICY IF EXISTS "Users can insert own proxies" ON proxies;
DROP POLICY IF EXISTS "Users can insert own emails" ON emails;

-- Proxies Table (Strict)
CREATE POLICY "Users can read own proxies if not banned" 
ON proxies FOR SELECT 
USING (
  auth.uid() = user_id 
  AND NOT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = auth.uid() AND banned = true)
);

CREATE POLICY "Users can insert own proxies if not banned" 
ON proxies FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND NOT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = auth.uid() AND banned = true)
);

-- Emails Table (Strict)
CREATE POLICY "Users can read own emails if not banned" 
ON emails FOR SELECT 
USING (
  auth.uid() = user_id 
  AND NOT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = auth.uid() AND banned = true)
);

CREATE POLICY "Users can insert own emails if not banned" 
ON emails FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND NOT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = auth.uid() AND banned = true)
);

-- Note: We only blocked SELECT and INSERT here, which completely locks down their access to new or existing proxy/email data.
