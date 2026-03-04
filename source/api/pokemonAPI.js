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
    types: Array.isArray(card.types) ? card.types : [],
    set: {
      ...(card.set || {}),
      name: card.set?.name || card.setName || "--",
      printedTotal:
        card.set?.printedTotal ||
        card.set?.cardCount?.official ||
        card.set?.cardCount?.total ||
        null,
      id: card.set?.id || card.setId || null,
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

export async function searchCards(filters = {}) {
  const name = `${filters.name ?? ""}`.trim();
  const number = `${filters.number ?? ""}`.trim();
  const setId = `${filters.setId ?? ""}`.trim();
  const rarityFamily = `${filters.rarityFamily ?? ""}`.trim();
  const rarity = `${filters.rarity ?? ""}`.trim();
  const type = `${filters.type ?? ""}`.trim();

  if (!name && !number && !setId && !rarityFamily && !rarity && !type) {
    throw new Error("At least one search filter is required.");
  }

  const page = Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1;
  const pageSize =
    Number.isInteger(filters.pageSize) && filters.pageSize > 0 ? filters.pageSize : 60;

  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (number) params.set("number", number);
  if (setId) params.set("setId", setId);
  if (rarityFamily) params.set("rarityFamily", rarityFamily);
  if (rarity) params.set("rarity", rarity);
  if (type) params.set("type", type);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  const data = await apiGet(`/cards/search?${params.toString()}`);
  return normalizeCardList(data.data);
}

export async function getCardsByName(name) {
  const safeName = ensureString(name, "name");
  return searchCards({ name: safeName, page: 1, pageSize: 60 });
}

export async function getCardsByPage(page = 1, pageSize = 20) {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("page must be a positive integer.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer.");
  }

  return searchCards({ name: "a", page, pageSize });
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

  return searchCards({ name: safeName, number: safeNumber, page: 1, pageSize: 60 });
}

export async function getAllSets() {
  const data = await apiGet("/cards/sets");
  return Array.isArray(data.data) ? data.data : [];
}

export async function getCardsBySet(setID) {
  const safeSetId = ensureString(setID, "setID");
  return searchCards({ setId: safeSetId, page: 1, pageSize: 60 });
}
