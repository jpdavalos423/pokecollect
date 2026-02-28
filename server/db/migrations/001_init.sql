CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards_cache (
  card_id TEXT PRIMARY KEY,
  name TEXT,
  set_name TEXT,
  number TEXT,
  rarity TEXT,
  image_small_url TEXT,
  market_price NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards_cache(card_id) ON DELETE RESTRICT,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS binder_slots (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page INT NOT NULL CHECK (page >= 1),
  slot INT NOT NULL CHECK (slot >= 0 AND slot <= 8),
  user_card_id UUID NOT NULL UNIQUE REFERENCES user_cards(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, page, slot)
);

CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_added_at ON user_cards(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_binder_slots_user_id ON binder_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_cache_name ON cards_cache(name);
CREATE INDEX IF NOT EXISTS idx_cards_cache_set_name ON cards_cache(set_name);
CREATE INDEX IF NOT EXISTS idx_cards_cache_rarity ON cards_cache(rarity);
CREATE INDEX IF NOT EXISTS idx_cards_cache_market_price ON cards_cache(market_price);
