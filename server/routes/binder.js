import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { DEFAULT_CARD_BACK_IMAGE } from "../services/cardCache.js";

export const binderRouter = Router();

binderRouter.use(requireAuth);

function toBinderItem(row) {
  return {
    page: row.page,
    slot: row.slot,
    userCardId: row.user_card_id,
    card: {
      userCardId: row.user_card_id,
      cardId: row.card_id,
      name: row.name,
      setName: row.set_name,
      number: row.number,
      rarity: row.rarity,
      imageUrl: row.image_small_url || DEFAULT_CARD_BACK_IMAGE,
      marketPrice: row.market_price === null ? null : Number(row.market_price),
    },
  };
}

binderRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize || 250)));
  const offset = (page - 1) * pageSize;

  try {
    const countResult = await pool.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM binder_slots bs
        WHERE bs.user_id = $1
      `,
      [req.auth.userId]
    );

    const result = await pool.query(
      `
        SELECT
          bs.page,
          bs.slot,
          bs.user_card_id,
          uc.card_id,
          cc.name,
          cc.set_name,
          cc.number,
          cc.rarity,
          cc.image_small_url,
          cc.market_price
        FROM binder_slots bs
        JOIN user_cards uc ON uc.id = bs.user_card_id AND uc.user_id = bs.user_id
        JOIN cards_cache cc ON cc.card_id = uc.card_id
        WHERE bs.user_id = $1
        ORDER BY bs.page ASC, bs.slot ASC
        LIMIT $2 OFFSET $3
      `,
      [req.auth.userId, pageSize, offset]
    );

    return res.json({
      items: result.rows.map(toBinderItem),
      page,
      pageSize,
      total: countResult.rows[0].total,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load binder" });
  }
});

binderRouter.put("/slots", async (req, res) => {
  const userCardId = req.body.userCardId;
  const page = Number(req.body.page);
  const slot = Number(req.body.slot);

  if (!userCardId || !Number.isInteger(page) || page < 1 || !Number.isInteger(slot) || slot < 0 || slot > 8) {
    return res.status(400).json({ error: "userCardId, page>=1, and slot [0..8] are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ownership = await client.query(
      "SELECT id FROM user_cards WHERE id = $1 AND user_id = $2",
      [userCardId, req.auth.userId]
    );

    if (!ownership.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Card not found in user collection" });
    }

    // Ensure one card has only one slot.
    await client.query(
      "DELETE FROM binder_slots WHERE user_id = $1 AND user_card_id = $2",
      [req.auth.userId, userCardId]
    );

    // If destination is occupied, replace existing occupant.
    await client.query(
      "DELETE FROM binder_slots WHERE user_id = $1 AND page = $2 AND slot = $3",
      [req.auth.userId, page, slot]
    );

    await client.query(
      `
        INSERT INTO binder_slots (user_id, page, slot, user_card_id, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
      `,
      [req.auth.userId, page, slot, userCardId]
    );

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Failed to assign binder slot" });
  } finally {
    client.release();
  }
});

binderRouter.delete("/slots/:userCardId", async (req, res) => {
  const { userCardId } = req.params;

  try {
    const result = await pool.query(
      `
        DELETE FROM binder_slots
        WHERE user_id = $1 AND user_card_id = $2
        RETURNING user_card_id
      `,
      [req.auth.userId, userCardId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Binder slot assignment not found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to unassign card" });
  }
});
