import { apiGet } from "../assets/scripts/api-client.js";

const FALLBACK_CARD_IMAGE = "assets/images/card-back.png";

export default null;

function ensureString(value, fieldName) {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizeCard(card) {
  if (!card || typeof card !== "object") {
    return null;
  }

  const image =
    card.images?.small ||
    card.image ||
    card.imageUrl ||
    card.imageURL ||
    FALLBACK_CARD_IMAGE;

  return {
    id: card.id,
    name: card.name || "Unknown",
    number: card.number || card.localId || null,
    localId: card.localId || card.number || null,
    rarity: card.rarity || null,
    image,
    images: {
      small: image,
    },
    set: {
      ...(card.set || {}),
      name: card.set?.name || card.setName || "--",
      printedTotal:
        card.set?.printedTotal ||
        card.set?.cardCount?.official ||
        card.set?.cardCount?.total ||
        null,
    },
    tcgplayer: card.tcgplayer,
    pricing: card.pricing,
    marketPrice: card.marketPrice,
  };
}

function normalizeCardList(data) {
  if (!Array.isArray(data)) return [];
  return data.map(normalizeCard).filter(Boolean);
}

export async function getCardsByName(name) {
  const safeName = ensureString(name, "name");
  const data = await apiGet(`/cards/search?name=${encodeURIComponent(safeName)}&page=1&pageSize=60`);
  return normalizeCardList(data.data);
}

export async function getCardsByPage(page = 1, pageSize = 20) {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("page must be a positive integer.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer.");
  }

  const data = await apiGet(
    `/cards/search?name=${encodeURIComponent("a")}&page=${page}&pageSize=${pageSize}`
  );
  return normalizeCardList(data.data);
}

export async function getCardById(id) {
  const safeId = ensureString(id, "id");
  try {
    const data = await apiGet(`/cards/${encodeURIComponent(safeId)}`);
    return normalizeCard(data.data || null);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function getCardsByNameAndNumber(name, number) {
  const safeName = ensureString(name, "name");
  const safeNumber = `${number ?? ""}`.trim();
  if (!safeNumber) {
    throw new Error("number must be provided");
  }

  const data = await apiGet(
    `/cards/search?name=${encodeURIComponent(safeName)}&number=${encodeURIComponent(
      safeNumber
    )}&page=1&pageSize=60`
  );

  return normalizeCardList(data.data);
}

export async function getAllSets() {
  const data = await apiGet("/cards/sets");
  return Array.isArray(data.data) ? data.data : [];
}

export async function getCardsBySet(setID) {
  const safeSetId = ensureString(setID, "setID");
  const data = await apiGet(`/cards/set/${encodeURIComponent(safeSetId)}`);
  return normalizeCardList(data.data);
}
