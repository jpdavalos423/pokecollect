/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  assignBinderSlot,
  fetchBinder,
  unassignBinderCard,
} from "../source/assets/scripts/binder-store.js";

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

describe("binder-store", () => {
  beforeEach(() => {
    window.POKECOLLECT_API_BASE = "http://localhost:3001/api/v1";
    sessionStorage.clear();
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ ok: true }));
  });

  test("fetchBinder serializes query params", async () => {
    await fetchBinder({ page: 3, pageSize: 50, assigned: false });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).toContain("/binder?");
    expect(url).toContain("page=3");
    expect(url).toContain("pageSize=50");
    expect(url).toContain("assigned=false");
  });

  test("assignBinderSlot sends PUT body", async () => {
    await assignBinderSlot("user-card-1", 2, 7);

    const [, options] = global.fetch.mock.calls[0];
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({
      userCardId: "user-card-1",
      page: 2,
      slot: 7,
    });
  });

  test("unassignBinderCard issues DELETE request", async () => {
    await unassignBinderCard("user-card-2");

    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).toContain("/binder/slots/user-card-2");
    expect(options.method).toBe("DELETE");
  });
});
