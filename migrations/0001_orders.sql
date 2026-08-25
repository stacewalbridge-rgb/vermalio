CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  recipient_name TEXT,
  occasion TEXT,
  brutality INTEGER,
  variant_label TEXT,
  front_text TEXT NOT NULL,
  inside_text TEXT NOT NULL,
  art_mode TEXT,
  outside_asset_key TEXT,
  inside_asset_key TEXT,
  price_pence INTEGER NOT NULL,
  shipping_pence INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  customer_email TEXT,
  shipping_json TEXT,
  printer_provider TEXT,
  printer_order_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
