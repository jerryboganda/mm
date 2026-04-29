-- Subscription Management System - Database Migration
-- Creates all 13 new tables for the subscription system

-- 1. subscription_packages
CREATE TABLE IF NOT EXISTS subscription_packages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  icon_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_visible_to_users BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  trial_days INTEGER NOT NULL DEFAULT 0,
  trial_requires_payment_method BOOLEAN NOT NULL DEFAULT false,
  grace_period_days INTEGER NOT NULL DEFAULT 0,
  max_subscribers INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB,
  revenuecat_product_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_pkg_status ON subscription_packages(status);
CREATE INDEX IF NOT EXISTS idx_sub_pkg_display_order ON subscription_packages(display_order);

-- 2. package_prices
CREATE TABLE IF NOT EXISTS package_prices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id VARCHAR NOT NULL REFERENCES subscription_packages(id) ON DELETE CASCADE,
  billing_cycle TEXT NOT NULL,
  custom_duration_days INTEGER,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  original_price NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  revenuecat_offering_id TEXT,
  package_version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pkg_price_package ON package_prices(package_id);
CREATE INDEX IF NOT EXISTS idx_pkg_price_cycle ON package_prices(billing_cycle);

-- 3. package_features
CREATE TABLE IF NOT EXISTS package_features (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id VARCHAR NOT NULL REFERENCES subscription_packages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  value_type TEXT NOT NULL DEFAULT 'check',
  value TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  feature_key TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pkg_feature_package ON package_features(package_id);

-- 4. add_ons
CREATE TABLE IF NOT EXISTS add_ons (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  pricing_type TEXT NOT NULL DEFAULT 'one_time',
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_cycle TEXT,
  max_quantity_per_user INTEGER NOT NULL DEFAULT 1,
  compatible_package_ids JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_addon_status ON add_ons(is_active);

-- 5. add_on_bundles
CREATE TABLE IF NOT EXISTS add_on_bundles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  add_on_ids JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. coupons
CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  campaign_id VARCHAR,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC(12,2) NOT NULL,
  min_purchase_amount NUMERIC(12,2),
  max_discount_amount NUMERIC(12,2),
  applicable_package_ids JSONB,
  applicable_add_on_ids JSONB,
  max_total_uses INTEGER,
  max_uses_per_user INTEGER NOT NULL DEFAULT 1,
  current_use_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_stackable BOOLEAN NOT NULL DEFAULT false,
  referral_user_id VARCHAR REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupon_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_campaign ON coupons(campaign_id);
CREATE INDEX IF NOT EXISTS idx_coupon_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupon_validity ON coupons(valid_from, valid_until);

-- 7. coupon_usage
CREATE TABLE IF NOT EXISTS coupon_usage (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id VARCHAR NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id VARCHAR,
  discount_applied NUMERIC(12,2) NOT NULL,
  used_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id);

-- 8. subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id VARCHAR NOT NULL REFERENCES subscription_packages(id),
  price_id VARCHAR REFERENCES package_prices(id),
  status TEXT NOT NULL DEFAULT 'trialing',
  trial_start_at TIMESTAMP,
  trial_end_at TIMESTAMP,
  activated_at TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  canceled_at TIMESTAMP,
  cancel_reason TEXT,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT true,
  paused_at TIMESTAMP,
  resumed_at TIMESTAMP,
  expired_at TIMESTAMP,
  grace_period_end_at TIMESTAMP,
  failed_payment_count INTEGER NOT NULL DEFAULT 0,
  last_payment_failed_at TIMESTAMP,
  next_retry_at TIMESTAMP,
  billing_cycle TEXT NOT NULL,
  price_at_purchase NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  coupon_id VARCHAR REFERENCES coupons(id),
  discount_amount NUMERIC(12,2),
  external_subscription_id TEXT,
  payment_gateway TEXT DEFAULT 'revenuecat',
  package_version_at_purchase INTEGER NOT NULL DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_package ON subscriptions(package_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_sub_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_sub_external_id ON subscriptions(external_subscription_id);

-- 9. subscription_add_ons
CREATE TABLE IF NOT EXISTS subscription_add_ons (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id VARCHAR NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  add_on_id VARCHAR NOT NULL REFERENCES add_ons(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_purchase NUMERIC(12,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_addon_subscription ON subscription_add_ons(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_addon_addon ON subscription_add_ons(add_on_id);

-- 10. invoices
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id VARCHAR REFERENCES subscriptions(id),
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(12,2) NOT NULL,
  discount_total NUMERIC(12,2) DEFAULT 0,
  tax_total NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  paid_at TIMESTAMP,
  due_at TIMESTAMP,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  coupon_id VARCHAR REFERENCES coupons(id),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoices(status);

-- 11. invoice_line_items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  package_id VARCHAR REFERENCES subscription_packages(id),
  add_on_id VARCHAR REFERENCES add_ons(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_line_item_invoice ON invoice_line_items(invoice_id);

-- 12. payment_transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR REFERENCES invoices(id),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_gateway TEXT NOT NULL,
  gateway_transaction_id TEXT,
  gateway_response JSONB,
  failure_reason TEXT,
  failure_code TEXT,
  refunded_amount NUMERIC(12,2),
  refunded_at TIMESTAMP,
  refund_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_txn_invoice ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_txn_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_txn_gateway_id ON payment_transactions(gateway_transaction_id);

-- 13. subscription_audit_logs
CREATE TABLE IF NOT EXISTS subscription_audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id VARCHAR REFERENCES subscriptions(id),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performed_by VARCHAR REFERENCES users(id),
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  details JSONB,
  source TEXT NOT NULL DEFAULT 'system',
  ip_address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_audit_subscription ON subscription_audit_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_audit_user ON subscription_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_audit_action ON subscription_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_sub_audit_created ON subscription_audit_logs(created_at);
