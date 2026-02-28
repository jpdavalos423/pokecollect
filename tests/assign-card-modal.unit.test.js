/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { showAssignCardModal } from "../source/assets/scripts/assign-card-modal.js";

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

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("assign-card-modal", () => {
  beforeEach(() => {
    window.POKECOLLECT_API_BASE = "http://localhost:3001/api/v1";
    document.body.innerHTML = "";
    global.fetch = jest.fn();
  });

  test("returns early for invalid page/slot input", async () => {
    await showAssignCardModal(0, 0);
    await showAssignCardModal(1, 9);
    expect(document.getElementById("assign-card-modal")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("renders unassigned cards and assigns selected card", async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ userCardId: "uc-1", name: "Pikachu", imageUrl: "https://cdn.example/pika.png" }],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const collectionChangedSpy = jest.fn();
    document.addEventListener("collection:changed", collectionChangedSpy);

    await showAssignCardModal(1, 2);

    const modal = document.getElementById("assign-card-modal");
    const cards = modal.querySelectorAll(".search-result-card");
    const confirmBtn = modal.querySelector("#confirmAssignCardBtn");

    expect(cards.length).toBe(1);
    cards[0].click();
    expect(confirmBtn.style.display).toBe("inline-flex");

    confirmBtn.click();
    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(global.fetch.mock.calls[0][0])).toContain("/collection");
    expect(String(global.fetch.mock.calls[1][0])).toContain("/binder/slots");
    expect(global.fetch.mock.calls[1][1].method).toBe("PUT");
    expect(collectionChangedSpy).toHaveBeenCalledTimes(1);
    expect(document.getElementById("assign-card-modal")).toBeNull();
  });

  test("shows empty-state message when collection has no unassigned cards", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await showAssignCardModal(2, 4);

    const modal = document.getElementById("assign-card-modal");
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain("No unassigned cards available");
  });

  test("keeps modal open and shows API error when assignment fails", async () => {
    global.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ userCardId: "uc-2", name: "Charmander", imageUrl: "https://cdn.example/charmander.png" }],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ error: "Slot assignment failed" }, 500));

    await showAssignCardModal(3, 0);

    const modal = document.getElementById("assign-card-modal");
    const cards = modal.querySelectorAll(".search-result-card");
    const confirmBtn = modal.querySelector("#confirmAssignCardBtn");

    cards[0].click();
    confirmBtn.click();
    await flush();

    expect(document.getElementById("assign-card-modal")).not.toBeNull();
    expect(modal.textContent).toContain("Error: Slot assignment failed");
    expect(confirmBtn.disabled).toBe(false);
    expect(confirmBtn.textContent).toBe("Assign to Slot");
  });
});
