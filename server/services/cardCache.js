import { pool } from "../db/pool.js";

export const DEFAULT_CARD_BACK_IMAGE = "assets/images/card-back.png";

function extractNumericValues(value, output = []) {
  if (value === null || value === undefined) return output;
  if (typeof value === "number" && Number.isFinite(value)) {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractNumericValues(item, output));
    return output;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => extractNumericValues(item, output));
  }
  return output;
}

function parseMarketPrice(card) {
  const pokemonTcgPrices = card?.tcgplayer?.prices;
  if (pokemonTcgPrices) {
    const values = Object.values(pokemonTcgPrices)
      .map((entry) => entry?.market)
      .filter((value) => Number.isFinite(value));
    if (values.length) {
      return Math.max(...values);
    }
  }

  const tcgdexPricing = card?.pricing;
  if (tcgdexPricing) {
    const values = extractNumericValues(tcgdexPricing, []).filter(
      (value) => Number.isFinite(value) && value > 0
    );
    if (values.length) {
      return Math.max(...values);
    }
  }

  return null;
}

function mapCardToCache(card) {
  const imageSmall =
    card.images?.small ||
    card.image ||
    card.imageURL ||
    card.imageUrl ||
    DEFAULT_CARD_BACK_IMAGE;

  return {
    cardId: card.id,
    name: card.name || null,
    setName: card.set?.name || card.setName || null,
    number: card.number || card.localId || null,
    rarity: card.rarity || null,
    imageSmallUrl: imageSmall,
    marketPrice: parseMarketPrice(card),
  };
}

export async function upsertCardCache(card) {
  const mapped = mapCardToCache(card);
  await pool.query(
    `
      INSERT INTO cards_cache (
        card_id,
        name,
        set_name,
        number,
        rarity,
        image_small_url,
        market_price,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (card_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        set_name = EXCLUDED.set_name,
        number = EXCLUDED.number,
        rarity = EXCLUDED.rarity,
        image_small_url = EXCLUDED.image_small_url,
        market_price = EXCLUDED.market_price,
        updated_at = NOW()
    `,
    [
      mapped.cardId,
      mapped.name,
      mapped.setName,
      mapped.number,
      mapped.rarity,
      mapped.imageSmallUrl,
      mapped.marketPrice,
    ]
  );
}

export async function getCachedCardById(cardId) {
  const result = await pool.query(
    `
      SELECT card_id, name, set_name, number, rarity, image_small_url, market_price, updated_at
      FROM cards_cache
      WHERE card_id = $1
    `,
    [cardId]
  );
  return result.rows[0] || null;
}
