import { env } from "../config/env.js";

const searchCache = new Map();
const cardCache = new Map();
const setsCache = new Map();
const setCardsCache = new Map();
const FILE_EXTENSION_RE = /\.(?:png|jpe?g|webp|gif|svg)(?:\?.*)?$/i;
const RARITY_FAMILY_MAP = {
  tcg_common: ["Common", "Uncommon"],
  tcg_rare: [
    "Rare",
    "Rare Holo",
    "Holo Rare",
    "Rare Holo LV.X",
    "Radiant Rare",
    "Amazing Rare",
    "Black White Rare",
    "ACE SPEC Rare",
    "PROMO",
    "Promo",
  ],
  tcg_ultra: [
    "Ultra Rare",
    "Secret Rare",
    "Rare Ultra",
    "Rare Secret",
    "Hyper rare",
    "Mega Hyper Rare",
    "Full Art Trainer",
    "Special illustration rare",
    "Illustration rare",
    "Classic Collection",
    "LEGEND",
    "Rare PRIME",
    "Double rare",
    "Holo Rare V",
    "Holo Rare VMAX",
    "Holo Rare VSTAR",
  ],
  tcg_misc: ["None"],
  pocket_diamond: ["One Diamond", "Two Diamond", "Three Diamond", "Four Diamond"],
  pocket_star: ["One Star", "Two Star", "Three Star"],
  pocket_shiny: [
    "One Shiny",
    "Two Shiny",
    "Shiny rare",
    "Shiny rare V",
    "Shiny rare VMAX",
    "Shiny Ultra Rare",
  ],
  pocket_special: ["Crown"],
};

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

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizePageNumber(value, defaultValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultValue;
  return Math.floor(parsed);
}

async function tcgdexGet(pathname, params = {}) {
  const url = new URL(`${env.tcgdexApiBaseUrl}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  let response;
  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    const error = new Error("TCGdex API unavailable");
    error.status = 503;
    error.cause = err;
    throw error;
  }

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

function includesCaseInsensitive(source, query) {
  return String(source || "").toLowerCase().includes(String(query || "").toLowerCase());
}

function equalsCaseInsensitive(source, query) {
  return String(source || "").toLowerCase() === String(query || "").toLowerCase();
}

export function getRarityFamilyValues(familyKey) {
  const key = normalizeString(familyKey);
  if (!key) return [];
  const values = RARITY_FAMILY_MAP[key];
  return Array.isArray(values) ? values : [];
}

function getCardTypes(card) {
  if (Array.isArray(card?.types)) {
    return card.types.map((type) => normalizeString(type)).filter(Boolean);
  }
  const singleType = normalizeString(card?.type);
  return singleType ? [singleType] : [];
}

function matchesCardFilters(card, filters) {
  if (!card || typeof card !== "object") return false;

  if (filters.name && !includesCaseInsensitive(card.name, filters.name)) {
    return false;
  }

  if (filters.number) {
    const cardNumber = normalizeCardNumber(card.localId || card.number || "");
    if (cardNumber !== filters.number) {
      return false;
    }
  }

  if (filters.rarity) {
    const cardRarity = normalizeString(card.rarity);
    if (!equalsCaseInsensitive(cardRarity, filters.rarity)) {
      return false;
    }
  } else if (filters.rarityFamily) {
    const cardRarity = normalizeString(card.rarity);
    const familyValues = getRarityFamilyValues(filters.rarityFamily);
    if (!familyValues.length) return false;
    if (!familyValues.some((value) => equalsCaseInsensitive(cardRarity, value))) {
      return false;
    }
  }

  if (filters.type) {
    const cardTypes = getCardTypes(card);
    if (!cardTypes.some((cardType) => equalsCaseInsensitive(cardType, filters.type))) {
      return false;
    }
  }

  return true;
}

async function filterCardsByCriteria(cards, filters, limit = Number.POSITIVE_INFINITY) {
  const matches = [];

  for (const card of cards) {
    let candidate = card;
    const missingRarity = (filters.rarity || filters.rarityFamily) && !normalizeString(card?.rarity);
    const missingType = filters.type && getCardTypes(card).length === 0;

    if ((missingRarity || missingType) && normalizeString(card?.id)) {
      try {
        const detailed = await fetchCardById(card.id);
        if (detailed?.data) {
          candidate = detailed.data;
        }
      } catch {
        // Keep using partial card data if detail lookup fails.
      }
    }

    if (matchesCardFilters(candidate, filters)) {
      matches.push(candidate);
      if (matches.length >= limit) {
        break;
      }
    }
  }

  return matches;
}

function paginate(data, page, pageSize) {
  const offset = (page - 1) * pageSize;
  return data.slice(offset, offset + pageSize);
}

function hasAtLeastOneSearchFilter(filters) {
  return Boolean(
    filters.name ||
      filters.number ||
      filters.setId ||
      filters.rarityFamily ||
      filters.rarity ||
      filters.type
  );
}

export async function searchCards({
  name,
  number,
  setId,
  rarityFamily,
  rarity,
  type,
  page = 1,
  pageSize = 20,
}) {
  const filters = {
    name: normalizeString(name),
    number: normalizeCardNumber(number),
    setId: normalizeString(setId),
    rarityFamily: normalizeString(rarityFamily),
    rarity: normalizeString(rarity),
    type: normalizeString(type),
  };

  const safePage = normalizePageNumber(page, 1);
  const safePageSize = Math.min(100, normalizePageNumber(pageSize, 20));

  if (!hasAtLeastOneSearchFilter(filters)) {
    throw new Error("At least one search filter is required");
  }

  const key = JSON.stringify({ ...filters, page: safePage, pageSize: safePageSize });
  const cached = getCacheEntry(searchCache, key);
  if (cached) return cached;

  let data = [];
  let totalCount = 0;

  if (filters.setId) {
    const setPayload = await fetchCardsBySet(filters.setId);
    const filtered = (Array.isArray(setPayload.data) ? setPayload.data : []).filter((card) =>
      matchesCardFilters(card, filters)
    );
    totalCount = filtered.length;
    data = paginate(filtered, safePage, safePageSize);
  } else {
    const broadRarityTypeSearch =
      !filters.name && !filters.number && (filters.rarityFamily || filters.rarity || filters.type);

    if (broadRarityTypeSearch) {
      const maxPagesToScan = 6;
      const targetCount = safePage * safePageSize;
      const filteredAccumulator = [];

      for (let currentPage = 1; currentPage <= maxPagesToScan; currentPage += 1) {
        let cards = [];
        try {
          const params = {
            "pagination:page": currentPage,
            "pagination:itemsPerPage": safePageSize,
          };
          const raw = await tcgdexGet("/cards", params);
          cards = Array.isArray(raw) ? raw.map(withImageUrls) : [];
        } catch (err) {
          if (filteredAccumulator.length > 0) {
            break;
          }
          throw err;
        }

        const remainingTarget = Math.max(1, targetCount - filteredAccumulator.length);
        const filteredPage = await filterCardsByCriteria(cards, filters, remainingTarget);
        filteredAccumulator.push(...filteredPage);

        if (cards.length === 0 || filteredAccumulator.length >= targetCount) {
          break;
        }
      }

      totalCount = filteredAccumulator.length;
      data = paginate(filteredAccumulator, safePage, safePageSize);
    } else {
      const params = {
        "pagination:page": safePage,
        "pagination:itemsPerPage": safePageSize,
      };

      if (filters.name) {
        params.name = filters.name;
      }

      if (filters.number) {
        params.localId = `eq:${filters.number}`;
      }

      const raw = await tcgdexGet("/cards", params);
      const cards = Array.isArray(raw) ? raw.map(withImageUrls) : [];
      const filtered = await filterCardsByCriteria(cards, filters);

      data = filtered;
      totalCount = filtered.length;
    }
  }

  const payload = {
    data,
    page: safePage,
    pageSize: safePageSize,
    count: data.length,
    totalCount,
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
