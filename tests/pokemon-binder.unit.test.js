/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import "../source/components/binder/pokemon-binder.js";

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

function noContentResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => null,
    },
    json: async () => null,
  };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("pokemon-binder", () => {
  let binder;

  beforeEach(() => {
    window.POKECOLLECT_API_BASE = "http://localhost:3001/api/v1";
    document.body.innerHTML = "<pokemon-binder></pokemon-binder>";
    binder = document.querySelector("pokemon-binder");
    global.fetch = jest.fn();
  });

  test("setPages maps cards by page and slot", () => {
    binder.setPages([
      { page: 1, slot: 0, userCardId: "u1", imgUrl: "pika.png", name: "Pikachu" },
      { page: 2, slot: 1, userCardId: "u2", imgUrl: "char.png", name: "Charmander" },
      { page: 0, slot: 1, userCardId: "u3", imgUrl: "bad.png", name: "BadPage" },
      { page: 1, slot: 12, userCardId: "u4", imgUrl: "bad-slot.png", name: "BadSlot" },
    ]);

    expect(binder.pagesData.size).toBe(2);
    expect(binder.pagesData.get(1)[0]).toMatchObject({ userCardId: "u1", imgUrl: "pika.png" });
    expect(binder.pagesData.get(2)[1]).toMatchObject({ userCardId: "u2", imgUrl: "char.png" });
  });

  test("jumpToPage normalizes even numbers to left page index", () => {
    binder.jumpToPage(4);
    expect(binder.currentIndex).toBe(3);

    binder.jumpToPage(5);
    expect(binder.currentIndex).toBe(5);
  });

  test("_loadFace renders page number, nine slots, and card image", () => {
    const face = document.createElement("div");
    face.innerHTML = `
      <div class="page-number"></div>
      <div class="cards-container"></div>
    `;

    binder._loadFace(face, [{ name: "Pikachu", imgUrl: "pika.png" }], 2);

    expect(face.querySelector(".page-number").textContent).toBe("Page 2");
    expect(face.querySelectorAll(".card-slot").length).toBe(9);
    expect(face.querySelectorAll("img").length).toBe(1);
    expect(face.querySelector("img").src).toContain("pika.png");
  });

  test("flipForward and flipBackward update index after transition end", () => {
    binder.currentIndex = 1;
    binder.flipForward();
    binder._rightFlipInner.dispatchEvent(new Event("transitionend"));
    expect(binder.currentIndex).toBe(3);

    binder.flipBackward();
    binder._leftFlipInner.dispatchEvent(new Event("transitionend"));
    expect(binder.currentIndex).toBe(1);
  });

  test("showModal disables remove button when userCardId is missing", async () => {
    await binder.showModal({
      name: "Pikachu",
      imgUrl: "pika.png",
      setName: "Base",
      number: "17",
      rarity: "Common",
      marketPrice: 1.5,
    });

    const modal = document.getElementById("global-pokemon-modal");
    const removeBtn = modal.querySelector("#removeBinderBtn");
    expect(removeBtn.disabled).toBe(true);
    expect(removeBtn.textContent).toBe("Unavailable");
  });

  test("showModal unassigns card and emits collection:changed on success", async () => {
    global.fetch.mockResolvedValueOnce(noContentResponse());

    const changedSpy = jest.fn();
    document.addEventListener("collection:changed", changedSpy);

    await binder.showModal({
      userCardId: "user-card-1",
      name: "Pikachu",
      imgUrl: "pika.png",
      setName: "Base",
      number: "17",
      rarity: "Common",
      marketPrice: 1.5,
    });

    const modal = document.getElementById("global-pokemon-modal");
    modal.querySelector("#removeBinderBtn").click();
    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toContain("/binder/slots/user-card-1");
    expect(global.fetch.mock.calls[0][1].method).toBe("DELETE");
    expect(changedSpy).toHaveBeenCalledTimes(1);
    expect(document.getElementById("global-pokemon-modal")).toBeNull();
  });

  test("showModal keeps modal open if unassign API fails", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ error: "Failed to unassign card" }, 500));

    await binder.showModal({
      userCardId: "user-card-2",
      name: "Pikachu",
      imgUrl: "pika.png",
      setName: "Base",
      number: "17",
      rarity: "Common",
      marketPrice: 1.5,
    });

    const modal = document.getElementById("global-pokemon-modal");
    const removeBtn = modal.querySelector("#removeBinderBtn");

    removeBtn.click();
    await flush();

    expect(document.getElementById("global-pokemon-modal")).not.toBeNull();
    expect(removeBtn.disabled).toBe(false);
    expect(removeBtn.textContent).toBe("Remove from Binder");
  });
});
