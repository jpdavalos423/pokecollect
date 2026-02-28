import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  fetchCardById,
  fetchCardsBySet,
  fetchSets,
  searchCards,
} from "../services/pokemonApi.js";
import { upsertCardCache } from "../services/cardCache.js";

export const cardsRouter = Router();

cardsRouter.use(requireAuth);

cardsRouter.get("/search", async (req, res) => {
  const name = (req.query.name || "").trim();
  const number = (req.query.number || "").trim();
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);

  if (!name) {
    return res.status(400).json({ error: "Query param 'name' is required" });
  }

  try {
    const data = await searchCards({ name, number, page, pageSize });
    if (Array.isArray(data.data)) {
      await Promise.all(data.data.map((card) => upsertCardCache(card).catch(() => null)));
    }
    return res.json({
      data: data.data || [],
      page: data.page || page,
      pageSize: data.pageSize || pageSize,
      count: data.count || 0,
      totalCount: data.totalCount || 0,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message, details: err.body || null });
  }
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
