-- Run this in your Supabase SQL Editor to restore Admin Portal visibility

-- 1. Usernames Table
CREATE POLICY "Admin can read all usernames" 
ON usernames FOR SELECT 
USING (auth.jwt() ->> 'email' = 'kibetian2005@gmail.com');

-- 2. Wallets Table
CREATE POLICY "Admin can read all wallets" 
ON wallets FOR SELECT 
USING (auth.jwt() ->> 'email' = 'kibetian2005@gmail.com');

-- 3. Proxies Table
CREATE POLICY "Admin can read all proxies" 
ON proxies FOR SELECT 
USING (auth.jwt() ->> 'email' = 'kibetian2005@gmail.com');

-- 4. Emails Table
CREATE POLICY "Admin can read all emails" 
ON emails FOR SELECT 
USING (auth.jwt() ->> 'email' = 'kibetian2005@gmail.com');

-- 5. Transactions Table
CREATE POLICY "Admin can read all transactions" 
ON transactions FOR SELECT 
USING (auth.jwt() ->> 'email' = 'kibetian2005@gmail.com');

-- 6. User Bans Table
CREATE POLICY "Admin can read all user bans" 
ON user_bans FOR SELECT 
USING (auth.jwt() ->> 'email' = 'kibetian2005@gmail.com');

-- Allow Admin to also Upsert/Update Balances & Bans
CREATE POLICY "Admin can modify wallets" 
ON wallets FOR ALL 
USING (auth.jwt() ->> 'email' = 'kibetian2005@gmail.com');

CREATE POLICY "Admin can modify bans" 
ON user_bans FOR ALL 
USING (auth.jwt() ->> 'email' = 'kibetian2005@gmail.com');
