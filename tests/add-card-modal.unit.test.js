/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockAddCardToCollection = jest.fn();
const mockSearchCards = jest.fn();
const mockGetAllSets = jest.fn();

await jest.unstable_mockModule("../source/assets/scripts/collection-store.js", () => ({
  addCardToCollection: mockAddCardToCollection,
}));

await jest.unstable_mockModule("../source/api/pokemonAPI.js", () => ({
  searchCards: mockSearchCards,
  getAllSets: mockGetAllSets,
}));

const { showAddCardModal } = await import("../source/assets/scripts/addCardModal.js");

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function deferred() {
  let resolve;
  const promise = new Promise((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe("add card modal", () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="openAddCardBtn">Open</button>';
    mockAddCardToCollection.mockReset();
    mockSearchCards.mockReset();
    mockGetAllSets.mockReset();
    mockGetAllSets.mockResolvedValue([{ id: "base1", name: "Base Set" }]);
  });

  test("renders advanced controls and loads set options", async () => {
    showAddCardModal("collection");
    await flush();

    expect(document.getElementById("cardSearchInputSet")).not.toBeNull();
    expect(document.getElementById("cardSearchRarityFamily")).not.toBeNull();
    expect(document.getElementById("cardSearchRarityExact")).not.toBeNull();
    expect(document.getElementById("cardSearchType")).not.toBeNull();
    expect(document.getElementById("cardSearchRarityExact").disabled).toBe(true);
    const rowOrder = Array.from(document.querySelectorAll(".modal-search-grid > *"))
      .map((el) => el.id)
      .filter((id) => id && id !== "cardSearchSetOptions");
    expect(rowOrder).toEqual([
      "cardSearchInputName",
      "cardSearchInputNum",
      "cardSearchInputSet",
      "cardSearchRarityFamily",
      "cardSearchRarityExact",
      "cardSearchType",
    ]);
    expect(document.querySelectorAll("#cardSearchSetOptions option").length).toBe(1);
  });

  test("form submit triggers searchCards with entered filters", async () => {
    mockSearchCards.mockResolvedValue([]);

    showAddCardModal("collection");
    await flush();

    document.getElementById("cardSearchInputName").value = "Pikachu";
    document.getElementById("cardSearchInputNum").value = "17/102";
    document.getElementById("cardSearchInputSet").value = "Base Set";
    const rarityFamily = document.getElementById("cardSearchRarityFamily");
    rarityFamily.value = "tcg_rare";
    rarityFamily.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("cardSearchRarityExact").value = "Rare";
    document.getElementById("cardSearchType").value = "Grass";

    document
      .getElementById("cardSearchForm")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await flush();

    expect(mockSearchCards).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Pikachu",
        number: "17/102",
        setId: "base1",
        rarity: "Rare",
        type: "Grass",
      })
    );
  });

  test("changing rarity family repopulates exact rarity options and resets selection", async () => {
    showAddCardModal("collection");
    await flush();

    const familySelect = document.getElementById("cardSearchRarityFamily");
    const exactSelect = document.getElementById("cardSearchRarityExact");

    familySelect.value = "tcg_rare";
    familySelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(exactSelect.disabled).toBe(false);
    expect(Array.from(exactSelect.options).some((option) => option.value === "Rare Holo")).toBe(true);

    exactSelect.value = "Rare Holo";
    familySelect.value = "pocket_diamond";
    familySelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(exactSelect.value).toBe("");
    expect(Array.from(exactSelect.options).some((option) => option.value === "Rare Holo")).toBe(false);
    expect(Array.from(exactSelect.options).some((option) => option.value === "One Diamond")).toBe(true);
  });

  test("family-only selection does not send rarity filter", async () => {
    mockSearchCards.mockResolvedValue([]);

    showAddCardModal("collection");
    await flush();

    const familySelect = document.getElementById("cardSearchRarityFamily");
    familySelect.value = "tcg_rare";
    familySelect.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("cardSearchType").value = "Grass";

    document
      .getElementById("cardSearchForm")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();

    expect(mockSearchCards).toHaveBeenCalledWith(
      expect.objectContaining({
        rarityFamily: "tcg_rare",
        rarity: "",
      })
    );
  });

  test("Escape closes modal and restores focus", async () => {
    const opener = document.getElementById("openAddCardBtn");
    opener.focus();

    showAddCardModal("collection");
    await flush();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(document.getElementById("global-pokemon-modal")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  test("selecting a result enables add button and shows metadata", async () => {
    mockSearchCards.mockResolvedValue([
      {
        id: "sv2-1",
        name: "Rowlet",
        number: "17",
        rarity: "Common",
        image: "https://cdn.example/rowlet.webp",
        images: { small: "https://cdn.example/rowlet.webp" },
        set: { name: "Sun & Moon" },
      },
    ]);

    showAddCardModal("collection");
    await flush();

    document.getElementById("cardSearchInputName").value = "Rowlet";
    document
      .getElementById("cardSearchForm")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();

    const card = document.querySelector(".search-result-card");
    expect(card).not.toBeNull();
    expect(card.textContent).toContain("Sun & Moon");
    expect(card.textContent).toContain("#17");

    const addBtn = document.getElementById("confirmAddCardBtn");
    expect(addBtn.disabled).toBe(true);

    card.click();
    expect(addBtn.disabled).toBe(false);
    expect(document.getElementById("selectedCardSummary").textContent).toContain("Rowlet");
  });

  test("clicking the selected card again deselects it", async () => {
    mockSearchCards.mockResolvedValue([
      {
        id: "sv2-2",
        name: "Dartrix",
        number: "18",
        rarity: "Uncommon",
        image: "https://cdn.example/dartrix.webp",
        images: { small: "https://cdn.example/dartrix.webp" },
        set: { name: "Sun & Moon" },
      },
    ]);

    showAddCardModal("collection");
    await flush();

    document.getElementById("cardSearchInputName").value = "Dartrix";
    document
      .getElementById("cardSearchForm")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();

    const card = document.querySelector(".search-result-card");
    const addBtn = document.getElementById("confirmAddCardBtn");

    card.click();
    expect(addBtn.disabled).toBe(false);

    card.click();
    expect(addBtn.disabled).toBe(true);
    expect(document.getElementById("selectedCardSummary").textContent).toContain("No card selected");
    expect(card.classList.contains("selected")).toBe(false);
  });

  test("pressing Enter on a selected card adds it to collection", async () => {
    mockAddCardToCollection.mockResolvedValue(undefined);
    mockSearchCards.mockResolvedValue([
      {
        id: "sv2-3",
        name: "Decidueye",
        number: "19",
        rarity: "Rare",
        image: "https://cdn.example/decidueye.webp",
        images: { small: "https://cdn.example/decidueye.webp" },
        set: { name: "Sun & Moon" },
      },
    ]);

    showAddCardModal("collection");
    await flush();

    document.getElementById("cardSearchInputName").value = "Decidueye";
    document
      .getElementById("cardSearchForm")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();

    const card = document.querySelector(".search-result-card");
    card.click();

    card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flush();
    await flush();

    expect(mockAddCardToCollection).toHaveBeenCalledWith("sv2-3");
    expect(document.getElementById("global-pokemon-modal")).toBeNull();
  });

  test("ignores stale search responses and keeps latest results", async () => {
    const first = deferred();
    const second = deferred();

    mockSearchCards
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    showAddCardModal("collection");
    await flush();

    const nameInput = document.getElementById("cardSearchInputName");
    const form = document.getElementById("cardSearchForm");

    nameInput.value = "First";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    nameInput.value = "Second";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    second.resolve([
      {
        id: "second-card",
        name: "Second Card",
        number: "12",
        rarity: "Rare",
        image: "https://cdn.example/second.webp",
        images: { small: "https://cdn.example/second.webp" },
        set: { name: "SV" },
      },
    ]);
    await flush();

    first.resolve([
      {
        id: "first-card",
        name: "First Card",
        number: "9",
        rarity: "Common",
        image: "https://cdn.example/first.webp",
        images: { small: "https://cdn.example/first.webp" },
        set: { name: "SV" },
      },
    ]);
    await flush();
    await flush();

    const resultText = document.getElementById("cardSearchResult").textContent;
    expect(resultText).toContain("Second Card");
    expect(resultText).not.toContain("First Card");
  });

  test("search thumbnail falls back when image fails", async () => {
    mockSearchCards.mockResolvedValue([
      {
        id: "broken",
        name: "Broken Image",
        number: "1",
        rarity: "Common",
        image: "https://cdn.example/broken.webp",
        images: { small: "https://cdn.example/broken.webp" },
        set: { name: "Base" },
      },
    ]);

    showAddCardModal("collection");
    await flush();

    document.getElementById("cardSearchInputName").value = "Broken";
    document
      .getElementById("cardSearchForm")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();

    const img = document.querySelector(".search-result-img");
    img.dispatchEvent(new Event("error"));

    expect(img.src).toContain("assets/images/card-back.png");
  });
});
