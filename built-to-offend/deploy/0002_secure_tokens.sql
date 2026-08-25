ALTER TABLE orders ADD COLUMN upload_token_hash TEXT;
ALTER TABLE orders ADD COLUMN upload_token_expires_at TEXT;
ALTER TABLE orders ADD COLUMN print_token_hash TEXT;
ALTER TABLE orders ADD COLUMN print_token_expires_at TEXT;

CREATE TABLE IF NOT EXISTS internal_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
