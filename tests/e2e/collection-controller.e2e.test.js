/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import "../../source/assets/scripts/collection-controller.js";

function jsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: {
      get: () => "application/json",
    },
    json: async () => payload,
  };
}

function setupApiMock({ sessionUser = null } = {}) {
  global.fetch = jest.fn(async (url, options = {}) => {
    const requestUrl = String(url);

    if (requestUrl.endsWith("/auth/me")) {
      if (!sessionUser) {
        return jsonResponse({ error: "Unauthorized" }, false, 401);
      }
      return jsonResponse({ user: sessionUser });
    }

    if (requestUrl.endsWith("/auth/login")) {
      const body = JSON.parse(options.body || "{}");
      return jsonResponse({
        token: "token-login",
        user: { email: body.email || "test@example.com" },
      });
    }

    if (requestUrl.endsWith("/auth/register")) {
      const body = JSON.parse(options.body || "{}");
      return jsonResponse({
        token: "token-register",
        user: { email: body.email || "test@example.com" },
      });
    }

    if (requestUrl.endsWith("/auth/logout")) {
      return jsonResponse({});
    }

    if (requestUrl.includes("/collection")) {
      return jsonResponse({ items: [] });
    }

    if (requestUrl.includes("/binder")) {
      return jsonResponse({ items: [] });
    }

    return jsonResponse({});
  });
}

function setupDom() {
  window.POKECOLLECT_API_BASE = "http://localhost:3001/api/v1";
  document.body.innerHTML = `
    <header>
      <div class="brand-block" aria-label="PokeCollect">
        <h1 class="wordmark">PokeCollect</h1>
        <p class="tagline">Track, price, and organize your card collection</p>
      </div>
      <section id="authPanel" class="auth-panel" aria-label="Account">
        <div class="auth-row">
          <div class="auth-fields">
            <input id="authEmail" type="email" />
            <input id="authPassword" type="password" />
          </div>
          <div class="auth-actions">
            <button id="authLogin" type="button">Sign In</button>
            <button id="authRegister" type="button">Register</button>
            <button id="authLogout" type="button" style="display:none;">Sign Out</button>
          </div>
        </div>
        <p id="authStatus" class="auth-status">Sign in to sync your collection.</p>
      </section>
    </header>

    <button id="quickSignOut" class="quick-signout hidden" type="button">Sign Out</button>

    <main id="appShell" class="hidden">
      <nav>
        <ul class="navbar">
          <li><a href="#" id="navCollection" class="active">Collection</a></li>
          <li><button id="darkModeToggle" type="button"></button></li>
          <li><a href="#" id="navBinder">Binder</a></li>
        </ul>
      </nav>

      <section id="collectionFilters" class="collection-filters"></section>
      <section class="binder-container"><pokemon-binder style="display:none;"></pokemon-binder></section>
      <pokemon-collection style="display:none;"></pokemon-collection>

      <section class="controls" style="display:none;">
        <button id="turnPageLeft" type="button">Previous Page</button>
        <button id="addCard" type="button">Add Card</button>
        <button id="turnPageRight" type="button">Next Page</button>
        <span id="jumpToPageGroup" class="jump-group" style="display:none;">
          <input id="binderPageJump" type="number" min="1" />
          <button id="jumpToPageBtn" type="button">Go</button>
        </span>
      </section>
      <div id="activeFilterChips" class="filter-chips"></div>
    </main>
  `;
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("collection-controller auth-gated shell", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setupDom();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("signed-out bootstrap hides app shell and keeps sign-in visible", async () => {
    setupApiMock({ sessionUser: null });

    document.dispatchEvent(new Event("DOMContentLoaded"));
    await flush();
    await flush();

    const appShell = document.getElementById("appShell");
    const authPanel = document.getElementById("authPanel");
    const quickSignOut = document.getElementById("quickSignOut");

    expect(appShell.classList.contains("hidden")).toBe(true);
    expect(authPanel.classList.contains("hidden")).toBe(false);
    expect(quickSignOut.classList.contains("hidden")).toBe(true);
    expect(document.body.classList.contains("auth-locked")).toBe(true);
    expect(document.body.classList.contains("auth-ready")).toBe(false);
  });

  test("signed-in bootstrap shows app shell and quick sign out", async () => {
    setupApiMock({ sessionUser: { email: "testcollection@example.com" } });

    document.dispatchEvent(new Event("DOMContentLoaded"));
    await flush();
    await flush();

    const appShell = document.getElementById("appShell");
    const authPanel = document.getElementById("authPanel");
    const quickSignOut = document.getElementById("quickSignOut");
    const navCollection = document.getElementById("navCollection");

    expect(appShell.classList.contains("hidden")).toBe(false);
    expect(authPanel.classList.contains("hidden")).toBe(true);
    expect(quickSignOut.classList.contains("hidden")).toBe(false);
    expect(navCollection.classList.contains("active")).toBe(true);
    expect(document.body.classList.contains("auth-ready")).toBe(true);
    expect(document.body.classList.contains("auth-locked")).toBe(false);
  });

  test("quick sign out returns user to locked screen and clears modal", async () => {
    setupApiMock({ sessionUser: { email: "testcollection@example.com" } });

    document.dispatchEvent(new Event("DOMContentLoaded"));
    await flush();
    await flush();

    const fakeModal = document.createElement("div");
    fakeModal.id = "global-pokemon-modal";
    document.body.appendChild(fakeModal);

    document.getElementById("quickSignOut").click();
    await flush();
    await flush();

    const appShell = document.getElementById("appShell");
    const authPanel = document.getElementById("authPanel");
    const quickSignOut = document.getElementById("quickSignOut");

    expect(appShell.classList.contains("hidden")).toBe(true);
    expect(authPanel.classList.contains("hidden")).toBe(false);
    expect(quickSignOut.classList.contains("hidden")).toBe(true);
    expect(document.getElementById("global-pokemon-modal")).toBeNull();
    expect(document.body.classList.contains("auth-locked")).toBe(true);
  });
});
