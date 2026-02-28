/**
 * @jest-environment node
 */

import { jest } from "@jest/globals";
import {
  addCardToCollectionForUser,
  handleAddCollectionCard,
  isCardCacheRecordStale,
  parseCardIdFromBody,
} from "../../server/routes/collection.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("collection add flow", () => {
  test("parseCardIdFromBody requires non-empty string", () => {
    expect(parseCardIdFromBody({})).toBeNull();
    expect(parseCardIdFromBody({ cardId: null })).toBeNull();
    expect(parseCardIdFromBody({ cardId: 42 })).toBeNull();
    expect(parseCardIdFromBody({ cardId: "   " })).toBeNull();
    expect(parseCardIdFromBody({ cardId: " sv2-1 " })).toBe("sv2-1");
  });

  test("isCardCacheRecordStale identifies stale and fresh records", () => {
    const now = Date.now();
    expect(isCardCacheRecordStale(null, now, 1000)).toBe(true);
    expect(isCardCacheRecordStale({ updated_at: new Date(now - 500).toISOString() }, now, 1000)).toBe(
      false
    );
    expect(isCardCacheRecordStale({ updated_at: new Date(now - 1500).toISOString() }, now, 1000)).toBe(
      true
    );
  });

  test("handleAddCollectionCard returns 400 INVALID_CARD_ID for invalid cardId", async () => {
    const req = { body: { cardId: 55 }, auth: { userId: "u1" } };
    const res = createMockRes();

    await handleAddCollectionCard(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "cardId must be a non-empty string",
      code: "INVALID_CARD_ID",
    });
  });

  test("handleAddCollectionCard maps missing provider card to 404 CARD_NOT_FOUND", async () => {
    const req = { body: { cardId: "sv2-1" }, auth: { userId: "u1" } };
    const res = createMockRes();

    const deps = {
      getCachedCardById: jest.fn().mockResolvedValue(null),
      fetchCardById: jest.fn().mockResolvedValue({ data: null }),
      upsertCardCache: jest.fn(),
      dbQuery: jest.fn(),
      nowMs: () => Date.now(),
      cardCacheStaleMs: 1000,
    };

    await handleAddCollectionCard(req, res, deps);

    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("CARD_NOT_FOUND");
    expect(deps.dbQuery).not.toHaveBeenCalled();
  });

  test("handleAddCollectionCard maps network failures to 503 CARD_PROVIDER_UNAVAILABLE", async () => {
    const req = { body: { cardId: "sv2-1" }, auth: { userId: "u1" } };
    const res = createMockRes();

    const networkError = new Error("connect refused");
    networkError.code = "ECONNREFUSED";

    const deps = {
      getCachedCardById: jest.fn().mockResolvedValue(null),
      fetchCardById: jest.fn().mockRejectedValue(networkError),
      upsertCardCache: jest.fn(),
      dbQuery: jest.fn(),
      nowMs: () => Date.now(),
      cardCacheStaleMs: 1000,
    };

    await handleAddCollectionCard(req, res, deps);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("CARD_PROVIDER_UNAVAILABLE");
  });

  test("handleAddCollectionCard maps upstream non-404 HTTP errors to 502 CARD_PROVIDER_ERROR", async () => {
    const req = { body: { cardId: "sv2-1" }, auth: { userId: "u1" } };
    const res = createMockRes();

    const upstreamError = new Error("bad request");
    upstreamError.status = 400;
    upstreamError.body = "invalid id";

    const deps = {
      getCachedCardById: jest.fn().mockResolvedValue(null),
      fetchCardById: jest.fn().mockRejectedValue(upstreamError),
      upsertCardCache: jest.fn(),
      dbQuery: jest.fn(),
      nowMs: () => Date.now(),
      cardCacheStaleMs: 1000,
    };

    await handleAddCollectionCard(req, res, deps);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      error: "Card provider returned an unexpected error",
      code: "CARD_PROVIDER_ERROR",
      details: "invalid id",
    });
  });

  test("handleAddCollectionCard returns 201 with DTO and imageUrl", async () => {
    const req = { body: { cardId: "sv2-1" }, auth: { userId: "u1" } };
    const res = createMockRes();

    const deps = {
      getCachedCardById: jest
        .fn()
        .mockResolvedValue({ card_id: "sv2-1", updated_at: new Date().toISOString() }),
      fetchCardById: jest.fn(),
      upsertCardCache: jest.fn(),
      dbQuery: jest.fn().mockResolvedValue({
        rows: [
          {
            user_card_id: "user-card-1",
            card_id: "sv2-1",
            added_at: "2026-01-01T00:00:00.000Z",
            name: "Pikachu",
            set_name: "Base",
            number: "17",
            rarity: "Common",
            image_small_url: "https://cdn.example/pika.png",
            market_price: "1.50",
            binder_page: null,
            binder_slot: null,
          },
        ],
      }),
      nowMs: () => Date.now(),
      cardCacheStaleMs: 1000,
    };

    await handleAddCollectionCard(req, res, deps);

    expect(res.statusCode).toBe(201);
    expect(res.body.item).toEqual({
      userCardId: "user-card-1",
      cardId: "sv2-1",
      name: "Pikachu",
      setName: "Base",
      number: "17",
      rarity: "Common",
      imageUrl: "https://cdn.example/pika.png",
      marketPrice: 1.5,
      addedAt: "2026-01-01T00:00:00.000Z",
      binder: null,
    });
  });

  test("addCardToCollectionForUser refreshes stale cache when refresh succeeds", async () => {
    const now = Date.now();

    const deps = {
      getCachedCardById: jest
        .fn()
        .mockResolvedValue({ card_id: "sv2-1", updated_at: new Date(now - 20_000).toISOString() }),
      fetchCardById: jest.fn().mockResolvedValue({ data: { id: "sv2-1", name: "Pikachu" } }),
      upsertCardCache: jest.fn().mockResolvedValue(undefined),
      dbQuery: jest.fn().mockResolvedValue({
        rows: [
          {
            user_card_id: "user-card-1",
            card_id: "sv2-1",
            added_at: "2026-01-01T00:00:00.000Z",
            name: "Pikachu",
            set_name: "Base",
            number: "17",
            rarity: "Common",
            image_small_url: "https://cdn.example/pika.png",
            market_price: "1.50",
            binder_page: null,
            binder_slot: null,
          },
        ],
      }),
      nowMs: () => now,
      cardCacheStaleMs: 1_000,
    };

    const item = await addCardToCollectionForUser("u1", "sv2-1", deps);

    expect(item.cardId).toBe("sv2-1");
    expect(deps.fetchCardById).toHaveBeenCalledWith("sv2-1");
    expect(deps.upsertCardCache).toHaveBeenCalledTimes(1);
  });

  test("addCardToCollectionForUser uses stale cache fallback when refresh fails", async () => {
    const now = Date.now();

    const deps = {
      getCachedCardById: jest
        .fn()
        .mockResolvedValue({ card_id: "sv2-1", updated_at: new Date(now - 20_000).toISOString() }),
      fetchCardById: jest.fn().mockRejectedValue(new Error("network timeout")),
      upsertCardCache: jest.fn(),
      dbQuery: jest.fn().mockResolvedValue({
        rows: [
          {
            user_card_id: "user-card-2",
            card_id: "sv2-1",
            added_at: "2026-01-01T00:00:00.000Z",
            name: "Pikachu",
            set_name: "Base",
            number: "17",
            rarity: "Common",
            image_small_url: "https://cdn.example/pika.png",
            market_price: "1.50",
            binder_page: null,
            binder_slot: null,
          },
        ],
      }),
      nowMs: () => now,
      cardCacheStaleMs: 1_000,
    };

    const item = await addCardToCollectionForUser("u1", "sv2-1", deps);

    expect(item.userCardId).toBe("user-card-2");
    expect(deps.fetchCardById).toHaveBeenCalledWith("sv2-1");
    expect(deps.upsertCardCache).not.toHaveBeenCalled();
    expect(deps.dbQuery).toHaveBeenCalledTimes(1);
  });
});
