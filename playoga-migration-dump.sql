-- ============================================================
-- PLAYOGA - FULL POSTGRESQL MIGRATION DUMP
-- Generated: 2026-03-01
-- Source Project: xoampivltwofgecadktc
-- ============================================================

-- ============================================================
-- PART 1: ENUMS
-- ============================================================
CREATE TYPE public.subscription_status AS ENUM ('free', 'active', 'expired', 'cancelled');

-- ============================================================
-- PART 2: TABLES
-- ============================================================

-- admins
CREATE TABLE public.admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  full_name text,
  avatar_url text,
  phone text,
  referral_code text UNIQUE,
  referred_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- categories
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  thumbnail_url text,
  is_featured boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- videos
CREATE TABLE public.videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumbnail_url text,
  category_id uuid REFERENCES public.categories(id),
  duration_seconds integer NOT NULL DEFAULT 0,
  is_premium boolean DEFAULT false,
  yogic_points integer DEFAULT 0,
  views_count integer DEFAULT 0,
  total_watch_time_seconds bigint DEFAULT 0,
  completion_count integer DEFAULT 0,
  is_published boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- subscriptions
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'free',
  plan_name text DEFAULT 'Yearly Plan',
  amount_paid numeric,
  gst_amount numeric,
  starts_at timestamptz,
  expires_at timestamptz,
  corporate_id uuid,
  is_corporate boolean DEFAULT false,
  coupon_code text,
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- payments
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id),
  amount numeric NOT NULL,
  gst_amount numeric,
  total_amount numeric NOT NULL,
  discount_amount numeric DEFAULT 0,
  coupon_id uuid,
  currency text DEFAULT 'INR',
  status text DEFAULT 'pending',
  razorpay_order_id text,
  razorpay_payment_id text,
  invoice_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- coupons
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  description text,
  discount_percentage integer,
  discount_amount numeric,
  max_uses integer,
  uses_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK for payments.coupon_id
ALTER TABLE public.payments ADD CONSTRAINT fk_payments_coupon FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);

-- corporates
CREATE TABLE public.corporates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  coupon_code text NOT NULL,
  is_active boolean DEFAULT true,
  max_members integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK for subscriptions.corporate_id
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_corporate_id_fkey FOREIGN KEY (corporate_id) REFERENCES public.corporates(id);

-- corporate_members
CREATE TABLE public.corporate_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corporate_id uuid NOT NULL REFERENCES public.corporates(id),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- watch_progress
CREATE TABLE public.watch_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.videos(id),
  watched_seconds integer DEFAULT 0,
  completed boolean DEFAULT false,
  points_awarded boolean DEFAULT false,
  last_watched_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- yogic_points_transactions
CREATE TABLE public.yogic_points_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid REFERENCES public.videos(id),
  points integer NOT NULL,
  transaction_type text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- wishlist
CREATE TABLE public.wishlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.videos(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- referrals
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- commissions
CREATE TABLE public.commissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_id uuid REFERENCES public.referrals(id),
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id),
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- wallets
CREATE TABLE public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- withdrawal_requests
CREATE TABLE public.withdrawal_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  payment_details jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- live_sessions
CREATE TABLE public.live_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  instructor_name text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  is_premium boolean DEFAULT false,
  is_live boolean DEFAULT false,
  is_completed boolean DEFAULT false,
  max_participants integer,
  stream_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- live_session_registrations
CREATE TABLE public.live_session_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.live_sessions(id),
  registered_at timestamptz NOT NULL DEFAULT now(),
  attended boolean DEFAULT false
);

-- site_stats
CREATE TABLE public.site_stats (
  id integer NOT NULL DEFAULT 1 PRIMARY KEY,
  total_visitors integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- visitors
CREATE TABLE public.visitors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- PART 3: DATABASE FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.subscriptions (user_id, status)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_yogic_points(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(SUM(points), 0)::INTEGER
  FROM public.yogic_points_transactions WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.award_yogic_points(_user_id uuid, _video_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _points INTEGER;
  _already_awarded BOOLEAN;
BEGIN
  SELECT points_awarded INTO _already_awarded
  FROM public.watch_progress WHERE user_id = _user_id AND video_id = _video_id;
  IF _already_awarded THEN RETURN 0; END IF;
  SELECT yogic_points INTO _points FROM public.videos WHERE id = _video_id;
  IF _points IS NULL OR _points <= 0 THEN RETURN 0; END IF;
  UPDATE public.watch_progress SET points_awarded = true, updated_at = now()
  WHERE user_id = _user_id AND video_id = _video_id;
  INSERT INTO public.yogic_points_transactions (user_id, video_id, points, transaction_type, description)
  VALUES (_user_id, _video_id, _points, 'earned', 'Video completion reward');
  RETURN _points;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_referral_code(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET referral_code = substring(md5(random()::text), 1, 8)
  WHERE user_id = _user_id AND referral_code IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_referral(_referred_user_id uuid, _referral_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE _referrer_id uuid;
BEGIN
  SELECT user_id INTO _referrer_id FROM profiles WHERE referral_code = _referral_code;
  IF _referrer_id IS NULL THEN RETURN; END IF;
  IF _referrer_id = _referred_user_id THEN RETURN; END IF;
  INSERT INTO referrals (referrer_id, referred_user_id) VALUES (_referrer_id, _referred_user_id) ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_referral(_referred_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE _referrer_id uuid;
BEGIN
  SELECT referrer_id INTO _referrer_id FROM referrals
  WHERE referred_user_id = _referred_user_id AND status = 'pending';
  IF _referrer_id IS NULL THEN RETURN; END IF;
  UPDATE referrals SET status = 'completed' WHERE referred_user_id = _referred_user_id;
  UPDATE profiles SET yogic_points = coalesce(yogic_points, 0) + 100 WHERE user_id = _referrer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_subscription_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  referral_record referrals%rowtype;
  commission_amount numeric := 50;
BEGIN
  IF new.status != 'active' THEN RETURN new; END IF;
  SELECT * INTO referral_record FROM referrals
  WHERE referred_user_id = new.user_id AND status = 'pending' LIMIT 1;
  IF NOT FOUND THEN RETURN new; END IF;
  IF EXISTS (SELECT 1 FROM commissions WHERE referred_user_id = new.user_id AND subscription_id = new.id)
  THEN RETURN new; END IF;
  INSERT INTO commissions (referrer_id, referred_user_id, referral_id, subscription_id, amount, created_at)
  VALUES (referral_record.referrer_id, referral_record.referred_user_id, referral_record.id, new.id, commission_amount, now());
  INSERT INTO wallets (user_id, balance) VALUES (referral_record.referrer_id, commission_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + commission_amount, updated_at = now();
  UPDATE referrals SET status = 'completed' WHERE id = referral_record.id;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_visitor(_visitor_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _total integer;
BEGIN
  INSERT INTO public.visitors (visitor_id) VALUES (_visitor_id) ON CONFLICT (visitor_id) DO NOTHING;
  IF FOUND THEN
    UPDATE public.site_stats SET total_visitors = total_visitors + 1, updated_at = now() WHERE id = 1;
  END IF;
  SELECT total_visitors INTO _total FROM public.site_stats WHERE id = 1;
  RETURN _total;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_total_visitors()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT total_visitors FROM public.site_stats WHERE id = 1;
$$;


-- ============================================================
-- PART 4: TRIGGERS
-- ============================================================

-- Auth trigger (run after creating tables)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Subscription commission trigger
CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_commission();

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_watch_progress_updated_at BEFORE UPDATE ON public.watch_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_live_sessions_updated_at BEFORE UPDATE ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- PART 5: ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yogic_points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;
-- visitors: NO RLS (accessed via security definer function)

-- admins policies
CREATE POLICY "Users can check own admin status" ON public.admins FOR SELECT USING (user_id = auth.uid());

-- profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (is_admin(auth.uid()));

-- categories policies
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (is_admin(auth.uid()));

-- videos policies
CREATE POLICY "Anyone can view published videos" ON public.videos FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can view all videos" ON public.videos FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage videos" ON public.videos FOR ALL USING (is_admin(auth.uid()));

-- subscriptions policies
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions FOR ALL USING (is_admin(auth.uid()));

-- payments policies
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (is_admin(auth.uid()));

-- coupons policies
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (is_admin(auth.uid()));

-- corporates policies
CREATE POLICY "Admins can manage corporates" ON public.corporates FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins full access on corporates" ON public.corporates FOR ALL
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- corporate_members policies
CREATE POLICY "Admins can manage corporate_members" ON public.corporate_members FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins full access on corporate_members" ON public.corporate_members FOR ALL
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- watch_progress policies
CREATE POLICY "Users can read own watch progress" ON public.watch_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own progress" ON public.watch_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.watch_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.watch_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all progress" ON public.watch_progress FOR SELECT USING (is_admin(auth.uid()));

-- yogic_points_transactions policies
CREATE POLICY "Users can view own points" ON public.yogic_points_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all points" ON public.yogic_points_transactions FOR SELECT USING (is_admin(auth.uid()));

-- wishlist policies
CREATE POLICY "Users can manage own wishlist" ON public.wishlist FOR ALL USING (auth.uid() = user_id);

-- referrals policies
CREATE POLICY "Users can view own referrals as referrer" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Users can view own referral as referred" ON public.referrals FOR SELECT USING (auth.uid() = referred_user_id);
CREATE POLICY "Admins can manage referrals" ON public.referrals FOR ALL USING (is_admin(auth.uid()));

-- commissions policies
CREATE POLICY "Users can view own commissions" ON public.commissions FOR SELECT USING (auth.uid() = referrer_id);

-- wallets policies
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);

-- withdrawal_requests policies
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);

-- live_sessions policies
CREATE POLICY "Anyone can view live sessions" ON public.live_sessions FOR SELECT USING (true);
CREATE POLICY "Admins can manage live sessions" ON public.live_sessions FOR ALL USING (is_admin(auth.uid()));

-- live_session_registrations policies
CREATE POLICY "Users can manage own registrations" ON public.live_session_registrations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all registrations" ON public.live_session_registrations FOR SELECT USING (is_admin(auth.uid()));

-- site_stats policies
CREATE POLICY "Anyone can view site stats" ON public.site_stats FOR SELECT USING (true);


-- ============================================================
-- PART 6: STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true);

CREATE POLICY "Public read thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
CREATE POLICY "Admin upload thumbnails" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'thumbnails');
CREATE POLICY "Admin update thumbnails" ON storage.objects FOR UPDATE USING (bucket_id = 'thumbnails');
CREATE POLICY "Admin delete thumbnails" ON storage.objects FOR DELETE USING (bucket_id = 'thumbnails');

CREATE POLICY "Public read videos" ON storage.objects FOR SELECT USING (bucket_id = 'videos');
CREATE POLICY "Admin upload videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos');
CREATE POLICY "Admin update videos" ON storage.objects FOR UPDATE USING (bucket_id = 'videos');
CREATE POLICY "Admin delete videos" ON storage.objects FOR DELETE USING (bucket_id = 'videos');


-- ============================================================
-- PART 7: SEED DATA
-- ============================================================

-- site_stats
INSERT INTO public.site_stats (id, total_visitors, updated_at) VALUES (1, 53, '2026-03-01 13:43:47.014271+00');

-- admins
INSERT INTO public.admins (id, user_id, created_at) VALUES
('4ed95d4a-8517-463f-91fa-77cf887223aa', 'a838101a-785f-45ed-b786-c40520ebf031', '2026-02-05 05:32:38.294482+00');

-- categories (sample - IDs preserved)
INSERT INTO public.categories (id, name, description, thumbnail_url, is_featured, sort_order, created_at, updated_at) VALUES
('2d3f761f-7042-4147-bc8c-15edd500fa63', 'Eye Pain', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770297248586-m38xmciopb.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-16 09:06:01.184226+00'),
('28d0b050-7b8d-427c-80dd-a815c2a30919', 'Anti-aging', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770297329036-iie3awlque.jpg', true, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:15:33.248671+00'),
('8880b1df-595e-4094-ad76-06e23ad06f76', 'Nose Allergy', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770297809697-s1l87t54d5.jpg', true, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:23:33.899581+00'),
('baec2bf1-b811-450b-88a1-a7d3dbee7247', 'Neck Problems', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770297926296-c2u3d0zue4k.jpg', true, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:25:30.682298+00'),
('a49730f7-9f51-4b84-9206-873cf819159a', 'Menopause', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770297987522-kkea2glos3b.jpg', true, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:26:31.912853+00'),
('8c71386f-3a56-47fa-8c6e-12c5038939c0', 'Liver Problems', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298020956-rcax3bk0jy9.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:27:04.482474+00'),
('6d17c4fb-45c2-4095-bdc9-47ac199a46b0', 'Knee Problems', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298062589-ghlvy8612k.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:27:47.30466+00'),
('0f703503-9c4d-4fa2-80c9-bf49fb66f91a', 'Insomnia', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298086626-21ck57bifoo.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:28:09.665214+00'),
('0b8c431b-7466-4934-8a6f-097cdf2881b8', 'Thyroid', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298129847-b2e2ywsj1m.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:28:52.962383+00'),
('1437cce2-a194-48e3-8ca2-0f359679590b', 'Migraine', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298188803-vtmdb2pahn.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:29:51.748902+00'),
('6ac1d436-00ee-474c-9a82-0e7470cf2ffe', 'Fatigue', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298204149-jqn66als4cc.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:30:06.435304+00'),
('debac868-f62a-4225-924a-c16dd185e6ce', 'Edema', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298227749-bqnyiad1lw6.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:30:40.49715+00'),
('a8740723-98f8-4cf1-982c-39011d4cf6fc', 'Obesity', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298288692-0es79oe7byj.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:31:33.237054+00'),
('c02a17a1-4fcf-4a04-888a-de695eb5fe3d', 'Memory Loss', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298306501-t8gcz8ena9.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:31:48.973668+00'),
('e0f3bba1-5143-4e1c-b3b0-a5647502027c', 'Breathing Problems', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298327818-vzha5phw5gh.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:32:10.250509+00'),
('a7b4880d-7cb2-4cd0-9e7f-e69e666b73c3', 'Bone Problems', NULL, 'https://xoampivltwofgecadktc.supabase.co/storage/v1/object/public/thumbnails/1770298345878-placeholder.jpg', false, 0, '2026-02-05 13:04:38.568022+00', '2026-02-05 13:32:28.250509+00');

-- corporates
INSERT INTO public.corporates (id, name, coupon_code, is_active, max_members, expires_at, created_at) VALUES
('0decf864-df7c-4234-9a6d-ebef10949783', 'Test', 'A', false, 1, '2026-02-22 00:00:00+00', '2026-02-21 16:09:50.589168+00');

-- corporate_members
INSERT INTO public.corporate_members (id, corporate_id, email, created_at) VALUES
('7cbef607-ae79-44fc-846c-c0cfb1a27c85', '0decf864-df7c-4234-9a6d-ebef10949783', 'aryamansingh005@gmail.com', '2026-02-21 16:58:39.274823+00'),
('46e68f18-2011-41c8-aa26-7760fd52b959', '0decf864-df7c-4234-9a6d-ebef10949783', 'aryamansingh006@gmail.com', '2026-02-21 17:00:59.702331+00');


-- ============================================================
-- PART 8: AUTH USERS REFERENCE (for manual recreation)
-- Cannot be directly imported - use Supabase Admin API or
-- manually create users and update their IDs
-- ============================================================
/*
AUTH USERS (id | email | full_name | created_at):
9ca0ef2e-347a-4590-bbb9-a1481fda9295 | aryamansingh006@gmail.com | Aryaman Singh | 2026-02-04
a838101a-785f-45ed-b786-c40520ebf031 | playogaofficial@gmail.com | admin | 2026-02-04
3b313d38-3884-4b54-91f5-7a4ee29650e6 | goutham4391@gmail.com | Gowtham kumar D | 2026-02-05
a02cc444-1b52-44c6-a575-251d63befa20 | aryamansingh005@gmail.com | Ayushman | 2026-02-05
36ea768b-6bca-4b2d-bc29-60a821f7d22f | aryamansingh007@gmail.com | Ayushman | 2026-02-06
c7b51011-2116-4b2f-abfa-452e94794f23 | aryamansingh008@gmail.com | Ayushman | 2026-02-06
df7c5754-2e7a-4fee-a554-5ee1ea395041 | hillborntechnologies@gmail.com | Gowtham kumar D | 2026-02-06
098ccceb-5414-4ee3-bfd8-0b2a432a0c92 | aryamansingh009@gmail.com | - | 2026-02-06
fef428b0-248d-404b-9f72-5d1bfda35093 | raja@gmail.com | - | 2026-02-07
655e63eb-2b5b-4f1b-b53e-3a7b216935ce | raja2@gmail.com | - | 2026-02-07
e4fd6feb-649a-45d1-aa23-0642ae6ec225 | kunjan11shukan@gmail.com | Kunjan Shah | 2026-02-08
c82e1ffe-532e-4a94-b37c-a26a11f2a327 | wwe@gmail.com | hero | 2026-02-08
fe7a75d8-405a-4653-96cb-269b32cee136 | wwe2@gmail.com | hero2 | 2026-02-08
f615559f-5418-4f40-836d-5d8641eab2b9 | testreferral@test.com | Test Referral User | 2026-02-08
d503807f-7d55-43ce-b422-e147145c2ecd | spaid.tech@gmail.com | SPAID AI | 2026-02-09
4b69b2da-3f5a-49af-8535-24591a65db7e | arya@gmail.com | Arya | 2026-02-09
b18677ba-d04a-461e-b1d7-783ac4ad7d4f | referreduser@test.com | Test Referred User | 2026-02-09
10c8b571-14cf-494f-9e91-c03ddc149ad5 | arya2@gmail.com | Arya2 | 2026-02-09
da8f47fa-e78c-4888-b1a0-8a49a435a54f | spaid2@gmail.com | SPAID AI | 2026-02-09
863b77f3-85af-412e-a8a3-ce60eaaf9ca2 | raja3@gmail.com | raja3 | 2026-02-10
(+ more users - see full auth.users export below)
*/


-- ============================================================
-- PART 9: REQUIRED SECRETS (set these in your new project)
-- ============================================================
/*
REQUIRED EDGE FUNCTION SECRETS:
- SUPABASE_URL (auto-set by Supabase)
- SUPABASE_ANON_KEY (auto-set by Supabase)
- SUPABASE_SERVICE_ROLE_KEY (auto-set by Supabase)
- RAZORPAY_KEY_ID (your Razorpay key ID)
- RAZORPAY_KEY_SECRET (your Razorpay key secret)
- SMTP_EMAIL (Gmail address for notifications)
- SMTP_APP_PASSWORD (Gmail app password)

FRONTEND ENV VARS (.env):
- VITE_SUPABASE_URL=https://<your-new-project-ref>.supabase.co
- VITE_SUPABASE_PUBLISHABLE_KEY=<your-new-anon-key>
- VITE_SUPABASE_PROJECT_ID=<your-new-project-ref>
*/


-- ============================================================
-- PART 10: EDGE FUNCTIONS (deploy to supabase/functions/)
-- ============================================================
/*
Edge functions to deploy (source code in supabase/functions/):
1. award-yogic-points/index.ts
2. create-razorpay-order/index.ts
3. verify-razorpay-payment/index.ts
4. validate-coupon/index.ts
5. validate-corporate-coupon/index.ts
6. activate-corporate-subscription/index.ts
7. admin-list-users/index.ts
8. firebase-phone-auth/index.ts
9. send-session-notification/index.ts

All functions have verify_jwt = false in config.toml
*/


-- ============================================================
-- NOTE: After running this SQL:
-- 1. Create auth users via Supabase Admin API (cannot INSERT into auth.users directly)
-- 2. Then INSERT profiles, subscriptions, and other user-related data
-- 3. Deploy edge functions via `supabase functions deploy`
-- 4. Set secrets via `supabase secrets set KEY=VALUE`
-- 5. Re-upload storage files (thumbnails & videos) to new buckets
-- 6. Update all thumbnail_url/video_url references to new project URL
-- ============================================================
