/**
 * @jest-environment node
 */

import { jest } from "@jest/globals";
import {
  handleCardsSearchRequest,
  parseCardsSearchQuery,
  hasAtLeastOneSearchFilter,
  searchCardsFromCache,
} from "../../server/routes/cards.js";

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

describe("cards search route", () => {
  test("parseCardsSearchQuery normalizes params", () => {
    const query = parseCardsSearchQuery({
      name: "  Pikachu  ",
      number: " 17/102 ",
      setId: "  sv2 ",
      rarityFamily: " tcg_rare ",
      rarity: " rare ",
      type: " grass ",
      page: "2",
      pageSize: "500",
    });

    expect(query).toEqual({
      name: "Pikachu",
      number: "17/102",
      setId: "sv2",
      rarityFamily: "tcg_rare",
      rarity: "rare",
      type: "grass",
      page: 2,
      pageSize: 100,
    });
  });

  test("hasAtLeastOneSearchFilter returns false when all filters empty", () => {
    expect(hasAtLeastOneSearchFilter({})).toBe(false);
    expect(hasAtLeastOneSearchFilter({ name: "", number: "", setId: "" })).toBe(false);
    expect(hasAtLeastOneSearchFilter({ rarityFamily: "tcg_rare" })).toBe(true);
    expect(hasAtLeastOneSearchFilter({ type: "Water" })).toBe(true);
  });

  test("handleCardsSearchRequest returns 400 when no filters provided", async () => {
    const req = { query: {} };
    const res = createMockRes();

    await handleCardsSearchRequest(req, res, {
      searchCards: jest.fn(),
      upsertCardCache: jest.fn(),
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("At least one");
  });

  test("handleCardsSearchRequest passes new filters to service and upserts returned cards", async () => {
    const req = {
      query: {
        setId: "sv2",
        rarityFamily: "tcg_rare",
        rarity: "Rare",
        type: "Grass",
        number: "17/102",
        page: "1",
        pageSize: "2",
      },
    };
    const res = createMockRes();

    const searchCardsMock = jest.fn().mockResolvedValue({
      data: [{ id: "sv2-1" }, { id: "sv2-2" }],
      page: 1,
      pageSize: 2,
      count: 2,
      totalCount: 2,
    });
    const upsertMock = jest.fn().mockResolvedValue(undefined);

    await handleCardsSearchRequest(req, res, {
      searchCards: searchCardsMock,
      upsertCardCache: upsertMock,
    });

    expect(searchCardsMock).toHaveBeenCalledWith({
      name: "",
      number: "17/102",
      setId: "sv2",
      rarityFamily: "tcg_rare",
      rarity: "Rare",
      type: "Grass",
      page: 1,
      pageSize: 2,
    });
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.totalCount).toBe(2);
  });

  test("searchCardsFromCache returns mapped rows for rarity/name filters", async () => {
    const dbQuery = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "sv2-1",
            name: "Rowlet",
            localId: "17",
            number: "17",
            rarity: "Rare",
            setName: "Sun & Moon",
            image: "https://cdn.example/rowlet.webp",
            imageUrl: "https://cdn.example/rowlet.webp",
            imageURL: "https://cdn.example/rowlet.webp",
            images: { small: "https://cdn.example/rowlet.webp" },
            set: { name: "Sun & Moon" },
          },
        ],
      });

    const result = await searchCardsFromCache(
      { name: "Rowlet", rarity: "Rare", number: "", setId: "", type: "", page: 1, pageSize: 20 },
      { dbQuery }
    );

    expect(result.count).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.data[0].name).toBe("Rowlet");
    const countSql = dbQuery.mock.calls[0][0];
    expect(countSql).toContain("LOWER(cc.rarity) =");
    expect(countSql).not.toContain("cc.rarity ILIKE");
    expect(dbQuery.mock.calls[0][1]).toContain("rare");
  });

  test("searchCardsFromCache supports rarity family matching via ANY", async () => {
    const dbQuery = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: "one" }, { id: "two" }] });

    const result = await searchCardsFromCache(
      { name: "", rarityFamily: "tcg_rare", rarity: "", number: "", setId: "", type: "", page: 1, pageSize: 20 },
      { dbQuery }
    );

    expect(result.count).toBe(2);
    const countSql = dbQuery.mock.calls[0][0];
    expect(countSql).toContain("LOWER(cc.rarity) = ANY");
    expect(dbQuery.mock.calls[0][1][0]).toEqual(expect.arrayContaining(["rare", "rare holo"]));
  });

  test("handleCardsSearchRequest falls back to cache on provider unavailable", async () => {
    const req = { query: { rarity: "Rare", page: "1", pageSize: "20" } };
    const res = createMockRes();

    const providerErr = new Error("TCGdex API unavailable");
    providerErr.status = 503;

    const dbQuery = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "cached-1",
            name: "Cached Card",
            localId: "7",
            number: "7",
            rarity: "Rare",
            setName: "Cache Set",
            image: "https://cdn.example/cached.webp",
            imageUrl: "https://cdn.example/cached.webp",
            imageURL: "https://cdn.example/cached.webp",
            images: { small: "https://cdn.example/cached.webp" },
            set: { name: "Cache Set" },
          },
        ],
      });

    await handleCardsSearchRequest(req, res, {
      searchCards: jest.fn().mockRejectedValue(providerErr),
      upsertCardCache: jest.fn(),
      dbQuery,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.fallback).toBe("cache");
    expect(res.body.count).toBe(1);
  });
});
