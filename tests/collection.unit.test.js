/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import "../source/components/collection/collection-view.js";

describe("pokemon-collection", () => {
  let element;

  beforeEach(() => {
    document.body.innerHTML = "";
    element = document.createElement("pokemon-collection");
    document.body.appendChild(element);
  });

  test("renders empty state by default", () => {
    const state = element.shadowRoot.getElementById("state");
    expect(state).not.toBeNull();
    expect(state.textContent).toContain("No cards in your collection yet.");
  });

  test("setLoading and setError update state", () => {
    element.setLoading(true);
    expect(element.shadowRoot.getElementById("state").textContent).toContain("Loading collection...");

    element.setError("Failed to load collection");
    const state = element.shadowRoot.getElementById("state");
    expect(state.textContent).toContain("Failed to load collection");
    expect(state.classList.contains("error")).toBe(true);
  });

  test("setCards renders card data and count", () => {
    element.setCards([
      {
        userCardId: "uc-1",
        cardId: "sv2-1",
        name: "Pikachu",
        setName: "Base",
        number: "17",
        rarity: "Common",
        imageUrl: "https://cdn.example/pikachu.png",
        marketPrice: 1.5,
      },
    ]);

    const cards = element.shadowRoot.querySelectorAll(".collection-card");
    const count = element.shadowRoot.getElementById("collection-count");
    const image = cards[0].querySelector("img");

    expect(cards.length).toBe(1);
    expect(count.textContent).toBe("1 card");
    expect(image.alt).toBe("Pikachu");
    expect(image.src).toContain("pikachu.png");
  });

  test("showCardModal dispatches remove-card event", async () => {
    const onRemove = jest.fn();
    element.addEventListener("remove-card", onRemove);

    await element.showCardModal({
      userCardId: "user-card-1",
      name: "Pikachu",
      imageUrl: "https://cdn.example/pikachu.png",
      setName: "Base",
      number: "17",
      rarity: "Common",
      marketPrice: 1.5,
    });

    const modal = document.getElementById("global-pokemon-modal");
    expect(modal).not.toBeNull();

    modal.querySelector("#deleteCardBtn").click();
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove.mock.calls[0][0].detail).toEqual({ userCardId: "user-card-1" });
    expect(document.getElementById("global-pokemon-modal")).toBeNull();
  });
});
