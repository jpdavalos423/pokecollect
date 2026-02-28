import { env } from "../config/env.js";

const searchCache = new Map();
const cardCache = new Map();
const setsCache = new Map();
const setCardsCache = new Map();
const FILE_EXTENSION_RE = /\.(?:png|jpe?g|webp|gif|svg)(?:\?.*)?$/i;

function getCacheEntry(store, key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function setCacheEntry(store, key, value) {
  store.set(key, {
    value,
    expiresAt: Date.now() + env.pokemonCacheTtlMs,
  });
}

async function tcgdexGet(pathname, params = {}) {
  const url = new URL(`${env.tcgdexApiBaseUrl}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(
      `TCGdex API error: ${response.status} ${response.statusText}`
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return response.json();
}

function toRenderableImageUrl(value, quality = "low") {
  if (typeof value !== "string") return null;
  const image = value.trim();
  if (!image) return null;
  if (FILE_EXTENSION_RE.test(image)) return image;
  return `${image.replace(/\/+$/, "")}/${quality}.webp`;
}

function withImageUrls(card) {
  if (!card || typeof card !== "object") return card;

  const imageRef =
    card.images?.small ||
    card.images?.large ||
    card.images?.high ||
    card.image ||
    card.imageUrl ||
    card.imageURL;

  const small = toRenderableImageUrl(card.images?.small || imageRef, "low");
  const large = toRenderableImageUrl(
    card.images?.large || card.images?.high || imageRef,
    "high"
  );
  const fallbackImage = small || large || null;

  return {
    ...card,
    ...(fallbackImage
      ? {
          image: fallbackImage,
          imageUrl: fallbackImage,
          imageURL: fallbackImage,
        }
      : {}),
    images: {
      ...(card.images && typeof card.images === "object" ? card.images : {}),
      ...(small ? { small } : {}),
      ...(large ? { large, high: large } : {}),
    },
  };
}

export function normalizeCardNumber(number) {
  const safeNumber = `${number ?? ""}`.trim();
  if (!safeNumber) return "";
  const [localId] = safeNumber.split("/");
  return (localId || "").trim();
}

export async function searchCards({ name, number, page = 1, pageSize = 20 }) {
  const safeName = (name || "").trim();
  if (!safeName) {
    throw new Error("Name is required");
  }

  const key = JSON.stringify({ name: safeName, number, page, pageSize });
  const cached = getCacheEntry(searchCache, key);
  if (cached) return cached;

  const params = {
    name: safeName,
    "pagination:page": page,
    "pagination:itemsPerPage": pageSize,
  };

  const normalizedNumber = normalizeCardNumber(number);
  if (normalizedNumber) {
    params.localId = `eq:${normalizedNumber}`;
  }

  const raw = await tcgdexGet("/cards", params);
  const data = Array.isArray(raw) ? raw.map(withImageUrls) : [];
  const payload = {
    data,
    page,
    pageSize,
    count: data.length,
    totalCount: data.length,
  };

  setCacheEntry(searchCache, key, payload);
  return payload;
}

export async function fetchCardById(cardId) {
  const safeCardId = (cardId || "").trim();
  if (!safeCardId) {
    throw new Error("Card id is required");
  }

  const cached = getCacheEntry(cardCache, safeCardId);
  if (cached) return cached;

  const raw = await tcgdexGet(`/cards/${encodeURIComponent(safeCardId)}`);
  const data = withImageUrls(raw);
  const payload = { data };
  setCacheEntry(cardCache, safeCardId, payload);
  return payload;
}

export async function fetchSets() {
  const cacheKey = "all";
  const cached = getCacheEntry(setsCache, cacheKey);
  if (cached) return cached;

  const data = await tcgdexGet("/sets");
  const payload = { data: Array.isArray(data) ? data : [] };
  setCacheEntry(setsCache, cacheKey, payload);
  return payload;
}

export async function fetchCardsBySet(setId) {
  const safeSetId = (setId || "").trim();
  if (!safeSetId) {
    throw new Error("setId is required");
  }

  const cached = getCacheEntry(setCardsCache, safeSetId);
  if (cached) return cached;

  const setData = await tcgdexGet(`/sets/${encodeURIComponent(safeSetId)}`);
  const data = Array.isArray(setData?.cards)
    ? setData.cards.map(withImageUrls)
    : [];
  const payload = { data };

  setCacheEntry(setCardsCache, safeSetId, payload);
  return payload;
}
