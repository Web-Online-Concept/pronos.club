export type PickStatus = "pending" | "won" | "lost" | "void" | "half_won" | "half_lost";
export type SubscriptionStatus = "free" | "active" | "past_due" | "canceled";
export type NotificationChannel = "email" | "push";

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  locale: string;
  notify_email: boolean;
  notify_push: boolean;
  push_subscription: object | null;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_end: string | null;
  created_at: string;
}

export interface Sport {
  id: string;
  name_fr: string;
  name_en: string;
  name_es: string;
  slug: string;
  icon: string | null;
  active: boolean;
}

export interface Competition {
  id: string;
  sport_id: string;
  name_fr: string;
  name_en: string;
  name_es: string;
  slug: string;
  country: string | null;
  active: boolean;
}

export interface Bookmaker {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  affiliate_url: string | null;
  description_fr: string | null;
  description_en: string | null;
  description_es: string | null;
  bonus_info: string | null;
  active: boolean;
  sort_order: number;
}

export interface Pick {
  id: string;
  sport_id: string;
  competition_id: string;
  bookmaker_id: string;
  event_name: string;
  event_date: string;
  selection: string;
  odds: number;
  stake: number;
  is_premium: boolean;
  analysis_fr: string | null;
  analysis_en: string | null;
  analysis_es: string | null;
  screenshot_url: string | null;
  status: PickStatus;
  profit: number | null;
  result_entered_at: string | null;
  published_at: string;
  notify_sent: boolean;
  // Joined
  sport?: Sport;
  competition?: Competition;
  bookmaker?: Bookmaker;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  subscription_id: string | null;
  stripe_payment_id: string;
  stripe_invoice_id: string | null;
  amount: number;
  currency: string;
  stripe_fee: number | null;
  net_amount: number | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface BankrollSnapshot {
  id: string;
  date: string;
  bankroll: number;
  total_picks: number;
  total_profit: number;
  roi: number;
  win_rate: number;
}
