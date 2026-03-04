/**
 * @jest-environment node
 */

import { jest } from "@jest/globals";
import {
  fetchCardById,
  fetchCardsBySet,
  fetchSets,
  normalizeCardNumber,
  searchCards,
} from "../../server/services/pokemonApi.js";

describe("server/services/pokemonApi", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("normalizeCardNumber supports fraction and plain values", () => {
    expect(normalizeCardNumber("17/102")).toBe("17");
    expect(normalizeCardNumber(" 17 ")).toBe("17");
    expect(normalizeCardNumber("   ")).toBe("");
  });

  test("searchCards requires at least one filter", async () => {
    await expect(searchCards({})).rejects.toThrow("At least one search filter is required");
  });

  test("searchCards accepts rarityFamily as a standalone filter", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "family-1",
          name: "Card 1",
          localId: "1",
          rarity: "Rare",
          types: ["Grass"],
          images: { small: "https://cdn.example/family1" },
        },
      ],
    });

    const result = await searchCards({
      rarityFamily: "tcg_rare",
      page: 1,
      pageSize: 20,
    });

    expect(result.count).toBe(1);
    expect(result.data[0].id).toBe("family-1");
  });

  test("searchCards normalizes number query and applies rarity/type filters", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "sv-a-1",
          name: "Bulbasaur",
          localId: "17",
          rarity: "Rare",
          types: ["Grass"],
          images: { small: "https://cdn.example/a" },
        },
        {
          id: "sv-a-2",
          name: "Bulbasaur",
          localId: "17",
          rarity: "Common",
          types: ["Grass"],
          images: { small: "https://cdn.example/b" },
        },
        {
          id: "sv-a-3",
          name: "Bulbasaur",
          localId: "17",
          rarity: "Secret Rare",
          types: ["Grass"],
          images: { small: "https://cdn.example/c" },
        },
      ],
    });

    const result = await searchCards({
      name: "bulba",
      number: "17/102",
      rarity: "rare",
      type: "grass",
      page: 1,
      pageSize: 20,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String(global.fetch.mock.calls[0][0]));
    expect(url.searchParams.get("localId")).toBe("eq:17");
    expect(result.count).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.data[0].id).toBe("sv-a-1");
    expect(result.data[0].images.small).toContain("/low.webp");
  });

  test("searchCards exact rarity matches only exact values", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "sv-r-1",
          name: "Gardevoir",
          localId: "9",
          rarity: "Rare Holo",
          types: ["Psychic"],
          images: { small: "https://cdn.example/r1" },
        },
        {
          id: "sv-r-2",
          name: "Gardevoir",
          localId: "9",
          rarity: "Rare",
          types: ["Psychic"],
          images: { small: "https://cdn.example/r2" },
        },
      ],
    });

    const result = await searchCards({
      name: "garde",
      rarity: "Rare Holo",
      type: "Psychic",
      page: 1,
      pageSize: 20,
    });

    expect(result.count).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.data[0].id).toBe("sv-r-1");
  });

  test("searchCards filters by rarity family when exact rarity is not provided", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "fam-a",
          name: "Card A",
          localId: "10",
          rarity: "Rare Holo",
          types: ["Psychic"],
          images: { small: "https://cdn.example/fa" },
        },
        {
          id: "fam-b",
          name: "Card B",
          localId: "11",
          rarity: "Secret Rare",
          types: ["Psychic"],
          images: { small: "https://cdn.example/fb" },
        },
      ],
    });

    const result = await searchCards({
      rarityFamily: "tcg_rare",
      type: "Psychic",
      page: 1,
      pageSize: 20,
    });

    expect(result.count).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.data[0].id).toBe("fam-a");
  });

  test("searchCards supports setId path and paginates filtered results", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sv-set-1",
        cards: [
          {
            id: "sv-s-1",
            name: "Treecko",
            localId: "17",
            rarity: "Rare",
            types: ["Grass"],
            images: { small: "https://cdn.example/treecko" },
          },
          {
            id: "sv-s-2",
            name: "Treecko",
            localId: "17",
            rarity: "Rare",
            types: ["Grass"],
            images: { small: "https://cdn.example/treecko2" },
          },
          {
            id: "sv-s-3",
            name: "Treecko",
            localId: "17",
            rarity: "Common",
            types: ["Grass"],
            images: { small: "https://cdn.example/treecko3" },
          },
        ],
      }),
    });

    const result = await searchCards({
      setId: "sv-set-1",
      number: "17/102",
      rarity: "rare",
      type: "grass",
      page: 2,
      pageSize: 1,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).toContain("/sets/sv-set-1");
    expect(result.count).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(result.data[0].id).toBe("sv-s-2");
  });

  test("searchCards rarity+type only scans additional pages when first page has no matches", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "page1-a",
            name: "Card A",
            localId: "1",
            rarity: "Common",
            types: ["Water"],
            images: { small: "https://cdn.example/a" },
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "page2-a",
            name: "Card B",
            localId: "2",
            rarity: "Rare",
            types: ["Grass"],
            images: { small: "https://cdn.example/b" },
          },
        ],
      });

    const result = await searchCards({
      rarity: "Rare",
      type: "Grass",
      page: 1,
      pageSize: 1,
    });

    expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    const requestedUrls = global.fetch.mock.calls.map(([url]) => String(url));
    expect(requestedUrls.some((url) => url.includes("pagination%3Apage=1"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("pagination%3Apage=2"))).toBe(true);
    expect(result.count).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.data[0].id).toBe("page2-a");
  });

  test("searchCards rarity+type scanning does not stop on provider page-size caps", async () => {
    const pageOne = Array.from({ length: 20 }, (_, idx) => ({
      id: `page1-${idx + 1}`,
      name: `Page1 Card ${idx + 1}`,
      localId: `${idx + 1}`,
      rarity: "Common",
      types: ["Water"],
      images: { small: `https://cdn.example/page1-${idx + 1}` },
    }));

    const pageTwo = Array.from({ length: 20 }, (_, idx) => ({
      id: idx === 0 ? "page2-match" : `page2-${idx + 1}`,
      name: idx === 0 ? "Page2 Match" : `Page2 Card ${idx + 1}`,
      localId: `${idx + 21}`,
      rarity: idx === 0 ? "Rare" : "Common",
      types: idx === 0 ? ["Grass"] : ["Water"],
      images: { small: `https://cdn.example/page2-${idx + 1}` },
    }));

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => pageOne,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => pageTwo,
      });

    const result = await searchCards({
      rarity: "Rare",
      type: "Grass",
      page: 1,
      pageSize: 36,
    });

    expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    const requestedUrls = global.fetch.mock.calls.map(([url]) => String(url));
    expect(requestedUrls.some((url) => url.includes("pagination%3Apage=1"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("pagination%3Apage=2"))).toBe(true);
    expect(result.count).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.data[0].id).toBe("page2-match");
  });

  test("fetchCardById validates input and maps image url", async () => {
    await expect(fetchCardById("")).rejects.toThrow("Card id is required");

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sv2-2",
        name: "Ivysaur",
        image: "https://cdn.example/ivysaur",
      }),
    });

    const result = await fetchCardById("sv2-2");
    expect(result.data.id).toBe("sv2-2");
    expect(result.data.images.small).toContain("/low.webp");
    expect(result.data.images.high).toContain("/high.webp");
  });

  test("fetchSets returns array and caches responses", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "base1", name: "Base" }],
    });

    const first = await fetchSets();
    const second = await fetchSets();

    expect(first.data).toHaveLength(1);
    expect(second.data[0].id).toBe("base1");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("fetchCardsBySet validates input, maps card images, and caches", async () => {
    await expect(fetchCardsBySet("")).rejects.toThrow("setId is required");

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sv2-z",
        cards: [{ id: "sv2-3", name: "Venusaur", images: { small: "https://cdn.example/v" } }],
      }),
    });

    const first = await fetchCardsBySet("sv2-z");
    const second = await fetchCardsBySet("sv2-z");

    expect(first.data[0].images.small).toContain("/low.webp");
    expect(second.data[0].id).toBe("sv2-3");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("tcgdexGet surfaces upstream errors with status and body", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "upstream down",
    });

    await expect(fetchCardById("sv2-error")).rejects.toMatchObject({
      status: 503,
      body: "upstream down",
    });
  });
});
