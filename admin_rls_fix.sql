-- Run this in your Supabase SQL Editor to implement dynamic Admin access

-- 1. Create Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
  email text PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now()
);

-- Insert the default root admin (safely ignores if it already exists)
INSERT INTO public.admins (email) VALUES ('kibetian2005@gmail.com') ON CONFLICT DO NOTHING;

-- 2. Drop the old policies first to replace them cleanly
DROP POLICY IF EXISTS "Admin can read all usernames" ON usernames;
DROP POLICY IF EXISTS "Admin can read all wallets" ON wallets;
DROP POLICY IF EXISTS "Admin can read all proxies" ON proxies;
DROP POLICY IF EXISTS "Admin can read all emails" ON emails;
DROP POLICY IF EXISTS "Admin can read all transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can read all user bans" ON user_bans;
DROP POLICY IF EXISTS "Admin can modify wallets" ON wallets;
DROP POLICY IF EXISTS "Admin can modify bans" ON user_bans;

-- 3. Set up dynamic policies
CREATE POLICY "Admins can read all usernames" 
ON usernames FOR SELECT 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admins));

CREATE POLICY "Admins can read all wallets" 
ON wallets FOR SELECT 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admins));

CREATE POLICY "Admins can read all proxies" 
ON proxies FOR SELECT 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admins));

CREATE POLICY "Admins can read all emails" 
ON emails FOR SELECT 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admins));

CREATE POLICY "Admins can read all transactions" 
ON transactions FOR SELECT 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admins));

CREATE POLICY "Admins can read all user bans" 
ON user_bans FOR SELECT 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admins));

-- Allow Admins to also Upsert/Update Balances & Bans
CREATE POLICY "Admins can modify wallets" 
ON wallets FOR ALL 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admins));

CREATE POLICY "Admins can modify bans" 
ON user_bans FOR ALL 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admins));
