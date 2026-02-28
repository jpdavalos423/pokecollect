/**
 * Given a card object, computes and formats a market-price range
 * across available pricing variants, or returns a fallback if none exist.
 *
 * Supports:
 * - Pokémon TCG API shape (`tcgplayer.prices`)
 * - TCGdex shape (`pricing`)
 *
 * @param {Object|null|undefined} fullCard
 * @returns {string}
 */
export function formatMarketPrice(fullCard) {
  const values = [];

  // Legacy Pokémon TCG API shape
  const pokemonPrices = fullCard?.tcgplayer?.prices;
  if (pokemonPrices) {
    Object.values(pokemonPrices).forEach((entry) => {
      if (Number.isFinite(entry?.market)) {
        values.push(entry.market);
      }
    });
  }

  // TCGdex pricing shape (nested provider objects with numeric values)
  const walk = (value) => {
    if (value === null || value === undefined) return;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      values.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(fullCard?.pricing);

  if (values.length === 0) {
    return "Price unavailable";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  return min === max
    ? `$${min.toFixed(2)}`
    : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
}
