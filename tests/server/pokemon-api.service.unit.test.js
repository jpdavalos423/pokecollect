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

describe("pokemonApi number normalization", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  test("normalizeCardNumber supports fraction and plain values", () => {
    expect(normalizeCardNumber("17/102")).toBe("17");
    expect(normalizeCardNumber(" 17 ")).toBe("17");
    expect(normalizeCardNumber("   ")).toBe("");
  });

  test("searchCards uses normalized localId filter for fraction input", async () => {
    await searchCards({ name: "pikachu-a", number: "17/102", page: 1, pageSize: 20 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String(global.fetch.mock.calls[0][0]));
    expect(url.searchParams.get("localId")).toBe("eq:17");
  });

  test("searchCards throws for empty name", async () => {
    await expect(searchCards({ name: "" })).rejects.toThrow("Name is required");
  });

  test("searchCards adds derived image urls and uses cache on repeated query", async () => {
    const card = {
      id: "sv2-1",
      name: "Pikachu",
      images: { small: "https://cdn.example/pikachu" },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [card],
    });

    const first = await searchCards({ name: "pikachu-b", page: 1, pageSize: 20 });
    const second = await searchCards({ name: "pikachu-b", page: 1, pageSize: 20 });

    expect(first.data[0].images.small).toContain("/low.webp");
    expect(first.data[0].images.large).toContain("/high.webp");
    expect(second.data[0].id).toBe("sv2-1");
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
        id: "sv2",
        cards: [{ id: "sv2-3", name: "Venusaur", images: { small: "https://cdn.example/v" } }],
      }),
    });

    const first = await fetchCardsBySet("sv2");
    const second = await fetchCardsBySet("sv2");

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
