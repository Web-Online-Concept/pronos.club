-- ============================================
-- PRONOS.CLUB - Initial Schema
-- ============================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  is_admin boolean DEFAULT false,
  locale text DEFAULT 'fr' CHECK (locale IN ('fr', 'en', 'es')),
  notify_email boolean DEFAULT true,
  notify_push boolean DEFAULT true,
  push_subscription jsonb,
  stripe_customer_id text,
  subscription_status text DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled')),
  subscription_end timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- SPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS sports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_fr text NOT NULL,
  name_en text NOT NULL,
  name_es text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text,
  active boolean DEFAULT true
);

-- ============================================
-- COMPETITIONS
-- ============================================
CREATE TABLE IF NOT EXISTS competitions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_id uuid NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  name_fr text NOT NULL,
  name_en text NOT NULL,
  name_es text NOT NULL,
  slug text UNIQUE NOT NULL,
  country text,
  active boolean DEFAULT true
);

-- ============================================
-- BOOKMAKERS
-- ============================================
CREATE TABLE IF NOT EXISTS bookmakers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  affiliate_url text,
  description_fr text,
  description_en text,
  description_es text,
  bonus_info text,
  active boolean DEFAULT true,
  sort_order int DEFAULT 0
);

-- ============================================
-- PICKS
-- ============================================
CREATE TABLE IF NOT EXISTS picks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_id uuid NOT NULL REFERENCES sports(id),
  competition_id uuid NOT NULL REFERENCES competitions(id),
  bookmaker_id uuid NOT NULL REFERENCES bookmakers(id),
  event_name text NOT NULL,
  event_date timestamptz NOT NULL,
  selection text NOT NULL,
  odds decimal(6,2) NOT NULL,
  stake decimal(4,1) NOT NULL DEFAULT 1.0,
  is_premium boolean DEFAULT false,
  analysis_fr text,
  analysis_en text,
  analysis_es text,
  screenshot_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void', 'half_won', 'half_lost')),
  profit decimal(8,2),
  result_entered_at timestamptz,
  published_at timestamptz DEFAULT now(),
  notify_sent boolean DEFAULT false
);

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  plan text NOT NULL CHECK (plan IN ('monthly', 'quarterly', 'yearly')),
  status text NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
  amount int NOT NULL,
  currency text DEFAULT 'eur',
  current_period_start timestamptz,
  currentPeriodEnd timestamptz,
  canceled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id),
  stripe_payment_id text UNIQUE NOT NULL,
  stripe_invoice_id text,
  amount int NOT NULL,
  currency text DEFAULT 'eur',
  stripe_fee int,
  net_amount int,
  status text NOT NULL CHECK (status IN ('succeeded', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- NOTIFICATION LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pick_id uuid REFERENCES picks(id),
  user_id uuid REFERENCES users(id),
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at timestamptz,
  error text
);

-- ============================================
-- BANKROLL SNAPSHOTS
-- ============================================
CREATE TABLE IF NOT EXISTS bankroll_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  date date UNIQUE NOT NULL,
  bankroll decimal(10,2) NOT NULL,
  total_picks int NOT NULL DEFAULT 0,
  total_profit decimal(10,2) NOT NULL DEFAULT 0,
  roi decimal(6,2) NOT NULL DEFAULT 0,
  win_rate decimal(5,2) NOT NULL DEFAULT 0
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_picks_status ON picks(status);
CREATE INDEX idx_picks_published ON picks(published_at DESC);
CREATE INDEX idx_picks_sport ON picks(sport_id);
CREATE INDEX idx_picks_premium ON picks(is_premium);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_notification_logs_pick ON notification_logs(pick_id);
CREATE INDEX idx_bankroll_date ON bankroll_snapshots(date DESC);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankroll_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmakers ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- USERS: read own, admin reads all
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin reads all users" ON users FOR SELECT USING (is_admin());
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- SPORTS/COMPETITIONS/BOOKMAKERS: public read
CREATE POLICY "Public read sports" ON sports FOR SELECT USING (true);
CREATE POLICY "Public read competitions" ON competitions FOR SELECT USING (true);
CREATE POLICY "Public read bookmakers" ON bookmakers FOR SELECT USING (true);
CREATE POLICY "Admin manages sports" ON sports FOR ALL USING (is_admin());
CREATE POLICY "Admin manages competitions" ON competitions FOR ALL USING (is_admin());
CREATE POLICY "Admin manages bookmakers" ON bookmakers FOR ALL USING (is_admin());

-- PICKS: public reads free, premium reads all, admin manages
CREATE POLICY "Public reads free picks" ON picks FOR SELECT USING (
  is_premium = false
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND subscription_status = 'active')
  OR is_admin()
);
CREATE POLICY "Admin manages picks" ON picks FOR ALL USING (is_admin());

-- SUBSCRIPTIONS: own only, admin reads all
CREATE POLICY "Users read own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin reads all subscriptions" ON subscriptions FOR SELECT USING (is_admin());

-- PAYMENTS: own only, admin reads all
CREATE POLICY "Users read own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin reads all payments" ON payments FOR SELECT USING (is_admin());

-- NOTIFICATION LOGS: admin only
CREATE POLICY "Admin reads notification logs" ON notification_logs FOR SELECT USING (is_admin());

-- BANKROLL: public read
CREATE POLICY "Public reads bankroll" ON bankroll_snapshots FOR SELECT USING (true);
CREATE POLICY "Admin manages bankroll" ON bankroll_snapshots FOR ALL USING (is_admin());

-- ============================================
-- SEED DATA: Sports
-- ============================================
INSERT INTO sports (name_fr, name_en, name_es, slug, icon) VALUES
  ('Football', 'Football', 'Fútbol', 'football', '⚽'),
  ('Tennis', 'Tennis', 'Tenis', 'tennis', '🎾'),
  ('Basketball', 'Basketball', 'Baloncesto', 'basketball', '🏀'),
  ('Rugby', 'Rugby', 'Rugby', 'rugby', '🏉'),
  ('Hockey sur glace', 'Ice Hockey', 'Hockey sobre hielo', 'hockey', '🏒'),
  ('Baseball', 'Baseball', 'Béisbol', 'baseball', '⚾'),
  ('MMA', 'MMA', 'MMA', 'mma', '🥊'),
  ('Handball', 'Handball', 'Balonmano', 'handball', '🤾')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- AUTO-CREATE USER PROFILE ON AUTH SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO users (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
