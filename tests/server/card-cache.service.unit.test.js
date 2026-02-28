/**
 * @jest-environment node
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockQuery = jest.fn();

jest.unstable_mockModule("../../server/db/pool.js", () => ({
  pool: {
    query: mockQuery,
  },
}));

const { DEFAULT_CARD_BACK_IMAGE, getCachedCardById, upsertCardCache } = await import(
  "../../server/services/cardCache.js"
);

describe("cardCache service", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test("upsertCardCache prefers highest tcgplayer market price", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await upsertCardCache({
      id: "sv2-1",
      name: "Pikachu",
      set: { name: "Base" },
      number: "17",
      rarity: "Common",
      images: { small: "https://cdn.example/pika-small.webp" },
      tcgplayer: {
        prices: {
          normal: { market: 1.25 },
          holofoil: { market: 2.5 },
        },
      },
    });

    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("sv2-1");
    expect(params[5]).toBe("https://cdn.example/pika-small.webp");
    expect(params[6]).toBe(2.5);
  });

  test("upsertCardCache falls back to tcgdex pricing and fallback image", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await upsertCardCache({
      id: "sv2-2",
      name: "Ivysaur",
      setName: "Jungle",
      localId: "12",
      pricing: {
        cardmarket: {
          low: 1.1,
          trend: 3.4,
        },
      },
    });

    const [, params] = mockQuery.mock.calls[0];
    expect(params[2]).toBe("Jungle");
    expect(params[3]).toBe("12");
    expect(params[5]).toBe(DEFAULT_CARD_BACK_IMAGE);
    expect(params[6]).toBe(3.4);
  });

  test("upsertCardCache stores null market price when no valid price exists", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await upsertCardCache({
      id: "sv2-3",
      name: "Bulbasaur",
      imageUrl: "https://cdn.example/bulba.webp",
      pricing: { cardmarket: { low: 0 } },
    });

    const [, params] = mockQuery.mock.calls[0];
    expect(params[5]).toBe("https://cdn.example/bulba.webp");
    expect(params[6]).toBeNull();
  });

  test("getCachedCardById returns row when found and null when missing", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ card_id: "sv2-1", name: "Pikachu" }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(getCachedCardById("sv2-1")).resolves.toEqual({
      card_id: "sv2-1",
      name: "Pikachu",
    });
    await expect(getCachedCardById("missing-id")).resolves.toBeNull();
  });
});
