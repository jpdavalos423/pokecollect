import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import {
  fetchCardById,
  fetchCardsBySet,
  fetchSets,
  getRarityFamilyValues,
  searchCards,
} from "../services/pokemonApi.js";
import { upsertCardCache } from "../services/cardCache.js";
import { normalizeCardNumber } from "../services/pokemonApi.js";

export const cardsRouter = Router();

cardsRouter.use(requireAuth);

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizePageNumber(value, fallback, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, Math.floor(parsed));
}

export function parseCardsSearchQuery(query = {}) {
  return {
    name: normalizeString(query.name),
    number: normalizeString(query.number),
    setId: normalizeString(query.setId),
    rarityFamily: normalizeString(query.rarityFamily),
    rarity: normalizeString(query.rarity),
    type: normalizeString(query.type),
    page: normalizePageNumber(query.page, 1),
    pageSize: normalizePageNumber(query.pageSize, 20, { max: 100 }),
  };
}

export function hasAtLeastOneSearchFilter(filters) {
  return Boolean(
    filters?.name ||
      filters?.number ||
      filters?.setId ||
      filters?.rarityFamily ||
      filters?.rarity ||
      filters?.type
  );
}

function getCardsRouteDeps(overrides = {}) {
  return {
    searchCards,
    upsertCardCache,
    dbQuery: (text, params) => pool.query(text, params),
    ...overrides,
  };
}

export async function searchCardsFromCache(filters, deps = {}) {
  const dbQuery = deps.dbQuery || ((text, params) => pool.query(text, params));
  const where = [];
  const params = [];
  const push = (clause, value) => {
    params.push(value);
    where.push(`${clause} $${params.length}`);
  };

  if (filters.name) {
    push("cc.name ILIKE", `%${filters.name}%`);
  }
  if (filters.setId) {
    push("cc.set_name ILIKE", `%${filters.setId}%`);
  }
  if (filters.number) {
    push("cc.number =", normalizeCardNumber(filters.number));
  }
  if (filters.rarity) {
    push("LOWER(cc.rarity) =", filters.rarity.toLowerCase());
  } else if (filters.rarityFamily) {
    const familyValues = getRarityFamilyValues(filters.rarityFamily).map((value) =>
      value.toLowerCase()
    );
    if (!familyValues.length) {
      return {
        data: [],
        page: filters.page,
        pageSize: filters.pageSize,
        count: 0,
        totalCount: 0,
      };
    }
    params.push(familyValues);
    where.push(`LOWER(cc.rarity) = ANY($${params.length}::TEXT[])`);
  }
  if (filters.type) {
    params.push(filters.type);
    where.push(
      `EXISTS (
        SELECT 1
        FROM unnest(COALESCE(cc.types, ARRAY[]::TEXT[])) AS t(type_value)
        WHERE LOWER(type_value) = LOWER($${params.length})
      )`
    );
  }

  if (!where.length) {
    return {
      data: [],
      page: filters.page,
      pageSize: filters.pageSize,
      count: 0,
      totalCount: 0,
    };
  }

  const countResult = await dbQuery(
    `
      SELECT COUNT(*)::INT AS total
      FROM cards_cache cc
      WHERE ${where.join(" AND ")}
    `,
    params
  );

  const offset = (filters.page - 1) * filters.pageSize;
  const dataParams = [...params, filters.pageSize, offset];
  const rowsResult = await dbQuery(
    `
      SELECT
        cc.card_id AS id,
        cc.name,
        cc.number AS "localId",
        cc.number,
        cc.rarity,
        cc.types AS "types",
        cc.set_name AS "setName",
        cc.image_small_url AS "image",
        cc.image_small_url AS "imageUrl",
        cc.image_small_url AS "imageURL",
        jsonb_build_object('small', cc.image_small_url) AS images,
        jsonb_build_object('name', cc.set_name) AS set
      FROM cards_cache cc
      WHERE ${where.join(" AND ")}
      ORDER BY cc.updated_at DESC, cc.card_id ASC
      LIMIT $${dataParams.length - 1}
      OFFSET $${dataParams.length}
    `,
    dataParams
  );

  const total = Number(countResult.rows?.[0]?.total || 0);
  const data = rowsResult.rows || [];
  return {
    data,
    page: filters.page,
    pageSize: filters.pageSize,
    count: data.length,
    totalCount: total,
  };
}

export async function handleCardsSearchRequest(req, res, deps = {}) {
  const resolvedDeps = getCardsRouteDeps(deps);
  const query = parseCardsSearchQuery(req.query || {});

  if (!hasAtLeastOneSearchFilter(query)) {
    return res.status(400).json({
      error:
        "At least one of 'name', 'number', 'setId', 'rarityFamily', 'rarity', or 'type' is required",
    });
  }

  try {
    const data = await resolvedDeps.searchCards(query);
    if (Array.isArray(data.data)) {
      await Promise.all(
        data.data.map((card) => resolvedDeps.upsertCardCache(card).catch(() => null))
      );
    }

    return res.json({
      data: data.data || [],
      page: data.page || query.page,
      pageSize: data.pageSize || query.pageSize,
      count: data.count || 0,
      totalCount: data.totalCount || 0,
    });
  } catch (err) {
    if (Number(err?.status) === 503) {
      try {
        const fallback = await searchCardsFromCache(query, resolvedDeps);
        return res.json({
          ...fallback,
          fallback: "cache",
        });
      } catch {
        // If cache lookup fails, fall through to original provider error.
      }
    }

    const status = err.status || 500;
    return res.status(status).json({ error: err.message, details: err.body || null });
  }
}

cardsRouter.get("/search", async (req, res) => {
  return handleCardsSearchRequest(req, res);
});

cardsRouter.get("/sets", async (_req, res) => {
  try {
    const data = await fetchSets();
    return res.json({ data: data.data || [] });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message, details: err.body || null });
  }
});

cardsRouter.get("/set/:setId", async (req, res) => {
  try {
    const data = await fetchCardsBySet(req.params.setId);
    if (Array.isArray(data.data)) {
      await Promise.all(data.data.map((card) => upsertCardCache(card).catch(() => null)));
    }
    return res.json({ data: data.data || [] });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message, details: err.body || null });
  }
});

cardsRouter.get("/:cardId", async (req, res) => {
  try {
    const data = await fetchCardById(req.params.cardId);
    if (data?.data) {
      await upsertCardCache(data.data).catch(() => null);
    }
    return res.json({ data: data.data || null });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message, details: err.body || null });
  }
});
