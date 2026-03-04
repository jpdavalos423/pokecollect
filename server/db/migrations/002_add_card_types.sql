ALTER TABLE cards_cache
  ADD COLUMN IF NOT EXISTS types TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_cards_cache_types_gin ON cards_cache USING GIN (types);
