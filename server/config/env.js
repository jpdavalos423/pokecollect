import dotenv from "dotenv";

dotenv.config();

const requiredVars = ["DATABASE_URL", "JWT_SECRET"];

for (const name of requiredVars) {
  if (!process.env[name] || !process.env[name].trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  tcgdexApiBaseUrl: process.env.TCGDEX_API_BASE_URL || "https://api.tcgdex.net/v2/en",
  pokemonCacheTtlMs: Number(process.env.POKEMON_CACHE_TTL_MS || 5 * 60 * 1000),
  cardCacheStaleMs: Number(process.env.CARD_CACHE_STALE_MS || 24 * 60 * 60 * 1000),
};
