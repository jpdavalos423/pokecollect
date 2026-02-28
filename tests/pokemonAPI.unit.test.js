/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  getAllSets,
  getCardById,
  getCardsByName,
  getCardsByNameAndNumber,
  getCardsByPage,
  getCardsBySet,
} from "../source/api/pokemonAPI.js";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => "application/json",
    },
    json: async () => payload,
  };
}

describe("source/api/pokemonAPI", () => {
  beforeEach(() => {
    window.POKECOLLECT_API_BASE = "http://localhost:3001/api/v1";
    sessionStorage.clear();
    global.fetch = jest.fn();
  });

  test("getCardsByName returns normalized cards", async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: "sv2-1",
            name: "Pikachu",
            localId: "17",
            rarity: "Common",
            images: { small: "https://cdn.example/pika-small.webp" },
            set: { name: "Base", printedTotal: 102 },
          },
        ],
      })
    );

    const cards = await getCardsByName("pikachu");

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: "sv2-1",
      name: "Pikachu",
      localId: "17",
      image: "https://cdn.example/pika-small.webp",
    });
    expect(String(global.fetch.mock.calls[0][0])).toContain("/cards/search");
    expect(String(global.fetch.mock.calls[0][0])).toContain("name=pikachu");
  });

  test("getCardsByName validates empty name", async () => {
    await expect(getCardsByName("")).rejects.toThrow("name must be a non-empty string.");
  });

  test("getCardsByNameAndNumber includes number query", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

    await getCardsByNameAndNumber("Charizard", "4/102");

    expect(String(global.fetch.mock.calls[0][0])).toContain("name=Charizard");
    expect(String(global.fetch.mock.calls[0][0])).toContain("number=4%2F102");
  });

  test("getCardsByPage validates pagination inputs", async () => {
    await expect(getCardsByPage(0, 20)).rejects.toThrow("page must be a positive integer.");
    await expect(getCardsByPage(1, 0)).rejects.toThrow("pageSize must be a positive integer.");
  });

  test("getCardById returns null for 404", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ error: "Not found" }, 404));
    await expect(getCardById("missing-id")).resolves.toBeNull();
  });

  test("getAllSets and getCardsBySet return backend data arrays", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "base1", name: "Base" }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "base1-1", name: "Alakazam", images: { small: "https://cdn.example/a.webp" } }],
        })
      );

    const sets = await getAllSets();
    const cards = await getCardsBySet("base1");

    expect(sets).toEqual([{ id: "base1", name: "Base" }]);
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe("base1-1");
  });
});
