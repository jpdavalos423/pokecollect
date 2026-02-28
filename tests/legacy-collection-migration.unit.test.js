import { extractLegacyCardIds } from "../source/assets/scripts/legacy-collection-migration.js";

describe("legacy collection migration parser", () => {
  test("preserves duplicate card ids", () => {
    const raw = JSON.stringify([
      { id: "sv2-1" },
      { id: "sv2-1" },
      { id: "sv3-4" },
    ]);

    expect(extractLegacyCardIds(raw)).toEqual(["sv2-1", "sv2-1", "sv3-4"]);
  });

  test("returns [] for malformed values", () => {
    expect(extractLegacyCardIds("not-json")).toEqual([]);
    expect(extractLegacyCardIds("")).toEqual([]);
  });
});
