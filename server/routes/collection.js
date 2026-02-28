import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { fetchCardById } from "../services/pokemonApi.js";
import {
  DEFAULT_CARD_BACK_IMAGE,
  getCachedCardById,
  upsertCardCache,
} from "../services/cardCache.js";

export const collectionRouter = Router();

collectionRouter.use(requireAuth);

const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

function parsePagination(query) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 24)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function parseSort(query) {
  const allowed = {
    addedAt: "uc.added_at",
    name: "cc.name",
    set: "cc.set_name",
    rarity: "cc.rarity",
    price: "cc.market_price",
  };

  const sortBy = allowed[query.sortBy] ? query.sortBy : "addedAt";
  const sortDir = String(query.sortDir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  return { sortBy, sortDir, sql: `${allowed[sortBy]} ${sortDir}, uc.id ASC` };
}

function toCollectionDto(row) {
  return {
    userCardId: row.user_card_id,
    cardId: row.card_id,
    name: row.name,
    setName: row.set_name,
    number: row.number,
    rarity: row.rarity,
    imageUrl: row.image_small_url || DEFAULT_CARD_BACK_IMAGE,
    marketPrice: row.market_price === null ? null : Number(row.market_price),
    addedAt: row.added_at,
    binder:
      row.binder_page === null
        ? null
        : {
            page: row.binder_page,
            slot: row.binder_slot,
          },
  };
}

function buildFilters(query, userId) {
  const where = ["uc.user_id = $1"];
  const params = [userId];

  const push = (clause, value) => {
    params.push(value);
    where.push(`${clause} $${params.length}`);
  };

  if (query.name) push("cc.name ILIKE", `%${query.name.trim()}%`);
  if (query.set) push("cc.set_name ILIKE", `%${query.set.trim()}%`);
  if (query.rarity) push("cc.rarity ILIKE", `%${query.rarity.trim()}%`);
  if (query.number) push("cc.number =", query.number.trim());

  if (query.priceMin !== undefined && query.priceMin !== "") {
    push("COALESCE(cc.market_price, 0) >=", Number(query.priceMin));
  }

  if (query.priceMax !== undefined && query.priceMax !== "") {
    push("COALESCE(cc.market_price, 0) <=", Number(query.priceMax));
  }

  if (query.addedAfter) push("uc.added_at >=", query.addedAfter);
  if (query.addedBefore) push("uc.added_at <=", query.addedBefore);

  if (query.assigned === "true") {
    where.push("bs.user_card_id IS NOT NULL");
  } else if (query.assigned === "false") {
    where.push("bs.user_card_id IS NULL");
  }

  return { whereSql: where.join(" AND "), params };
}

function getAddCollectionDeps(overrides = {}) {
  return {
    getCachedCardById,
    fetchCardById,
    upsertCardCache,
    dbQuery: (text, params) => pool.query(text, params),
    nowMs: () => Date.now(),
    cardCacheStaleMs: env.cardCacheStaleMs,
    ...overrides,
  };
}

function extractErrorDetails(err) {
  if (err?.body !== undefined && err?.body !== null) return err.body;
  if (err?.payload !== undefined && err?.payload !== null) return err.payload;
  return null;
}

function isProviderUnavailableError(err) {
  const status = Number(err?.status);
  if (Number.isFinite(status)) {
    return status === 408 || status === 429 || status >= 500;
  }

  const code = String(err?.code || "").toUpperCase();
  if (NETWORK_ERROR_CODES.has(code)) return true;

  const message = String(err?.message || "").toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

export function parseCardIdFromBody(body) {
  const rawCardId = body?.cardId;
  if (typeof rawCardId !== "string") return null;
  const cardId = rawCardId.trim();
  return cardId || null;
}

export function isCardCacheRecordStale(cachedCard, nowMs = Date.now(), staleMs = env.cardCacheStaleMs) {
  if (!cachedCard) return true;

  const updatedAtMs = new Date(cachedCard.updated_at || "").getTime();
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) {
    return true;
  }

  return nowMs - updatedAtMs >= staleMs;
}

export function mapAddCollectionError(err) {
  if (err?.code === "INVALID_CARD_ID") {
    return {
      status: 400,
      code: "INVALID_CARD_ID",
      error: "cardId must be a non-empty string",
      details: null,
    };
  }

  if (err?.code === "CARD_NOT_FOUND" || Number(err?.status) === 404) {
    return {
      status: 404,
      code: "CARD_NOT_FOUND",
      error: "Card not found",
      details: extractErrorDetails(err),
    };
  }

  if (isProviderUnavailableError(err)) {
    return {
      status: 503,
      code: "CARD_PROVIDER_UNAVAILABLE",
      error: "Card provider is unavailable",
      details: extractErrorDetails(err),
    };
  }

  if (Number.isFinite(Number(err?.status))) {
    return {
      status: 502,
      code: "CARD_PROVIDER_ERROR",
      error: "Card provider returned an unexpected error",
      details: extractErrorDetails(err),
    };
  }

  return {
    status: 500,
    code: "ADD_CARD_FAILED",
    error: "Failed to add card",
    details: null,
  };
}

export async function ensureCardCacheForAdd(cardId, deps = {}) {
  const resolvedDeps = getAddCollectionDeps(deps);
  const cached = await resolvedDeps.getCachedCardById(cardId);
  const shouldRefresh =
    !cached ||
    isCardCacheRecordStale(
      cached,
      resolvedDeps.nowMs(),
      resolvedDeps.cardCacheStaleMs
    );

  if (!shouldRefresh) return;

  try {
    const remote = await resolvedDeps.fetchCardById(cardId);
    if (!remote?.data) {
      const notFoundError = new Error("Card not found");
      notFoundError.status = 404;
      notFoundError.code = "CARD_NOT_FOUND";
      throw notFoundError;
    }
    await resolvedDeps.upsertCardCache(remote.data);
  } catch (err) {
    if (!cached) throw err;

    console.warn("Using stale cache entry after refresh failure", {
      cardId,
      status: err?.status || null,
      message: err?.message || "Unknown refresh failure",
    });
  }
}

export async function addCardToCollectionForUser(userId, cardId, deps = {}) {
  const resolvedDeps = getAddCollectionDeps(deps);

  await ensureCardCacheForAdd(cardId, resolvedDeps);

  const result = await resolvedDeps.dbQuery(
    `
      WITH inserted AS (
        INSERT INTO user_cards (user_id, card_id)
        VALUES ($1, $2)
        RETURNING id, user_id, card_id, added_at
      )
      SELECT
        inserted.id AS user_card_id,
        inserted.card_id,
        inserted.added_at,
        cc.name,
        cc.set_name,
        cc.number,
        cc.rarity,
        cc.image_small_url,
        cc.market_price,
        bs.page AS binder_page,
        bs.slot AS binder_slot
      FROM inserted
      JOIN cards_cache cc ON cc.card_id = inserted.card_id
      LEFT JOIN binder_slots bs ON bs.user_card_id = inserted.id AND bs.user_id = inserted.user_id
    `,
    [userId, cardId]
  );

  const row = result.rows[0];
  if (!row) {
    const insertError = new Error("Failed to load inserted collection card");
    insertError.code = "ADD_CARD_FAILED";
    throw insertError;
  }

  return toCollectionDto(row);
}

export async function handleAddCollectionCard(req, res, deps = {}) {
  const cardId = parseCardIdFromBody(req.body);
  if (!cardId) {
    return res.status(400).json({
      error: "cardId must be a non-empty string",
      code: "INVALID_CARD_ID",
    });
  }

  try {
    const item = await addCardToCollectionForUser(req.auth.userId, cardId, deps);
    return res.status(201).json({ item });
  } catch (err) {
    const mapped = mapAddCollectionError(err);
    console.error("Add collection card failed", {
      code: mapped.code,
      status: mapped.status,
      userId: req.auth?.userId || null,
      cardId,
      upstreamStatus: err?.status || null,
      message: err?.message || "Unknown add-card failure",
    });

    const payload = {
      error: mapped.error,
      code: mapped.code,
    };

    if (mapped.details !== null && mapped.details !== undefined) {
      payload.details = mapped.details;
    }

    return res.status(mapped.status).json(payload);
  }
}

collectionRouter.get("/", async (req, res) => {
  try {
    const { whereSql, params } = buildFilters(req.query, req.auth.userId);
    const { page, pageSize, offset } = parsePagination(req.query);
    const { sortBy, sortDir, sql: orderSql } = parseSort(req.query);

    const countResult = await pool.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM user_cards uc
        JOIN cards_cache cc ON cc.card_id = uc.card_id
        LEFT JOIN binder_slots bs ON bs.user_card_id = uc.id AND bs.user_id = uc.user_id
        WHERE ${whereSql}
      `,
      params
    );

    const dataParams = [...params, pageSize, offset];
    const listResult = await pool.query(
      `
        SELECT
          uc.id AS user_card_id,
          uc.card_id,
          uc.added_at,
          cc.name,
          cc.set_name,
          cc.number,
          cc.rarity,
          cc.image_small_url,
          cc.market_price,
          bs.page AS binder_page,
          bs.slot AS binder_slot
        FROM user_cards uc
        JOIN cards_cache cc ON cc.card_id = uc.card_id
        LEFT JOIN binder_slots bs ON bs.user_card_id = uc.id AND bs.user_id = uc.user_id
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT $${dataParams.length - 1}
        OFFSET $${dataParams.length}
      `,
      dataParams
    );

    return res.json({
      items: listResult.rows.map(toCollectionDto),
      page,
      pageSize,
      total: countResult.rows[0].total,
      sortBy,
      sortDir: sortDir.toLowerCase(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load collection" });
  }
});

collectionRouter.post("/", async (req, res) => {
  return handleAddCollectionCard(req, res);
});

collectionRouter.delete("/:userCardId", async (req, res) => {
  const { userCardId } = req.params;

  try {
    const result = await pool.query(
      `
        DELETE FROM user_cards
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `,
      [userCardId, req.auth.userId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Card not found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to remove card" });
  }
});
