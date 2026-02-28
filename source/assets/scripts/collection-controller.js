import "../../components/collection/collection-view.js";
import { showAddCardModal } from "./addCardModal.js";
import {
  addCardToCollection,
  fetchCollection,
  removeCardFromCollection,
} from "./collection-store.js";
import { bootstrapSession, getCurrentUser, initAuthPanel } from "./auth-store.js";
import { refreshBinder } from "./binder-controller.js";
import { extractLegacyCardIds } from "./legacy-collection-migration.js";

const DEFAULT_QUERY = {
  page: 1,
  pageSize: 24,
  sortBy: "addedAt",
  sortDir: "desc",
};

let activeQuery = { ...DEFAULT_QUERY };

const LEGACY_COLLECTION_KEY = "pokemonCollection";
const LEGACY_MIGRATION_FLAG = "pokemonCollectionMigrationDone";

function setAppVisibility(isAuthed) {
  const appShell = document.getElementById("appShell");
  const collectionEl = document.querySelector("pokemon-collection");
  const binderEl = document.querySelector("pokemon-binder");
  const controls = document.querySelector(".controls");
  const chips = document.getElementById("activeFilterChips");
  const navCollection = document.getElementById("navCollection");
  const navBinder = document.getElementById("navBinder");
  const pageJump = document.getElementById("binderPageJump");
  const openModal = document.getElementById("global-pokemon-modal");

  appShell?.classList.toggle("hidden", !isAuthed);
  document.body.classList.toggle("auth-ready", isAuthed);
  document.body.classList.toggle("auth-locked", !isAuthed);

  if (isAuthed) return;

  activeQuery = { ...DEFAULT_QUERY };
  if (chips) chips.innerHTML = "";
  if (pageJump) pageJump.value = "";

  if (navCollection && navBinder) {
    navCollection.classList.add("active");
    navBinder.classList.remove("active");
  }

  if (collectionEl) collectionEl.style.display = "none";
  if (binderEl) binderEl.style.display = "none";
  if (controls) controls.style.display = "none";
  document.getElementById("collectionFilters")?.classList.add("hidden");
  openModal?.remove();
}

function showCollection() {
  const collectionEl = document.querySelector("pokemon-collection");
  const binderEl = document.querySelector("pokemon-binder");
  const controls = document.querySelector(".controls");
  const turnPageLeft = document.getElementById("turnPageLeft");
  const turnPageRight = document.getElementById("turnPageRight");
  const jumpToPageGroup = document.getElementById("jumpToPageGroup");
  const addCardBtn = document.getElementById("addCard");

  if (!collectionEl || !binderEl || !controls || !turnPageLeft || !turnPageRight || !jumpToPageGroup || !addCardBtn) {
    return;
  }

  collectionEl.style.display = "flex";
  binderEl.style.display = "none";
  controls.style.display = "flex";
  controls.classList.add("collection-controls");
  controls.classList.remove("binder-controls");

  turnPageLeft.style.display = "none";
  turnPageRight.style.display = "none";
  jumpToPageGroup.style.display = "none";
  addCardBtn.style.display = "inline-block";

  document.getElementById("collectionFilters")?.classList.remove("hidden");
}

function showBinder() {
  const collectionEl = document.querySelector("pokemon-collection");
  const binderEl = document.querySelector("pokemon-binder");
  const controls = document.querySelector(".controls");
  const turnPageLeft = document.getElementById("turnPageLeft");
  const turnPageRight = document.getElementById("turnPageRight");
  const jumpToPageGroup = document.getElementById("jumpToPageGroup");
  const addCardBtn = document.getElementById("addCard");

  if (!collectionEl || !binderEl || !controls || !turnPageLeft || !turnPageRight || !jumpToPageGroup || !addCardBtn) {
    return;
  }

  collectionEl.style.display = "none";
  binderEl.style.display = "";
  controls.style.display = "flex";
  controls.classList.remove("collection-controls");
  controls.classList.add("binder-controls");

  turnPageLeft.style.display = "inline-block";
  turnPageRight.style.display = "inline-block";
  jumpToPageGroup.style.display = "inline-flex";
  addCardBtn.style.display = "inline-block";

  document.getElementById("collectionFilters")?.classList.add("hidden");
}

function readFilterInputs() {
  return {
    name: document.getElementById("filterName")?.value.trim() || "",
    set: document.getElementById("filterSet")?.value.trim() || "",
    rarity: document.getElementById("filterRarity")?.value.trim() || "",
    assigned: document.getElementById("filterAssigned")?.value || "",
    sortBy: document.getElementById("filterSortBy")?.value || "addedAt",
    sortDir: document.getElementById("filterSortDir")?.value || "desc",
    page: 1,
    pageSize: DEFAULT_QUERY.pageSize,
  };
}

function renderFilterChips(filters) {
  const container = document.getElementById("activeFilterChips");
  if (!container) return;

  const entries = Object.entries(filters).filter(([key, value]) => {
    if (["page", "pageSize"].includes(key)) return false;
    if (key === "sortBy" && value === "addedAt") return false;
    if (key === "sortDir" && value === "desc") return false;
    return value !== "" && value !== undefined && value !== null;
  });

  container.innerHTML = "";
  entries.forEach(([key, value]) => {
    const chip = document.createElement("span");
    chip.className = "filter-chip";
    chip.textContent = `${key}: ${value}`;
    container.appendChild(chip);
  });
}

export async function loadCollection(query = activeQuery) {
  const view = document.querySelector("pokemon-collection");
  if (!view) return;

  if (!getCurrentUser()) {
    activeQuery = { ...DEFAULT_QUERY };
    view.setCards([]);
    view.setError("");
    return;
  }

  activeQuery = { ...activeQuery, ...query };
  renderFilterChips(activeQuery);

  view.setLoading(true);
  try {
    const response = await fetchCollection(activeQuery);
    view.setCards(response.items || []);
  } catch (err) {
    view.setError(err.message || "Failed to load collection");
  }
}

async function migrateLegacyCollectionIfNeeded() {
  if (!getCurrentUser()) return;
  if (localStorage.getItem(LEGACY_MIGRATION_FLAG) === "true") return;

  const raw = localStorage.getItem(LEGACY_COLLECTION_KEY);
  if (!raw) {
    localStorage.setItem(LEGACY_MIGRATION_FLAG, "true");
    return;
  }

  const cardIds = extractLegacyCardIds(raw);

  if (!cardIds.length) {
    localStorage.setItem(LEGACY_MIGRATION_FLAG, "true");
    return;
  }

  const shouldImport = window.confirm(
    `Found ${cardIds.length} legacy local cards. Import all copies into your account now?`
  );

  if (!shouldImport) {
    localStorage.setItem(LEGACY_MIGRATION_FLAG, "true");
    return;
  }

  for (const cardId of cardIds) {
    try {
      await addCardToCollection(cardId);
    } catch {
      // Best effort migration: continue importing remaining cards.
    }
  }

  localStorage.setItem(LEGACY_MIGRATION_FLAG, "true");
  document.dispatchEvent(new CustomEvent("collection:changed"));
}

async function removeCollectionCard(event) {
  const userCardId = event.detail?.userCardId;
  if (!userCardId) return;

  try {
    await removeCardFromCollection(userCardId);
    document.dispatchEvent(new CustomEvent("collection:changed"));
  } catch (err) {
    console.error("Failed to remove card", err);
  }
}

function bindNavigation() {
  document.getElementById("navCollection")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!getCurrentUser()) return;
    document.getElementById("navBinder").classList.remove("active");
    document.getElementById("navCollection").classList.add("active");
    showCollection();
  });

  document.getElementById("navBinder")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!getCurrentUser()) return;
    document.getElementById("navCollection").classList.remove("active");
    document.getElementById("navBinder").classList.add("active");
    showBinder();
  });
}

function bindFilterActions() {
  document.getElementById("applyFilters")?.addEventListener("click", () => {
    loadCollection(readFilterInputs());
  });

  document.getElementById("clearFilters")?.addEventListener("click", () => {
    [
      "filterName",
      "filterSet",
      "filterRarity",
      "filterAssigned",
      "filterSortBy",
      "filterSortDir",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      if (id === "filterSortBy") el.value = "addedAt";
      else if (id === "filterSortDir") el.value = "desc";
      else el.value = "";
    });

    loadCollection({ ...DEFAULT_QUERY });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initAuthPanel();
  bindNavigation();
  bindFilterActions();

  const collectionView = document.querySelector("pokemon-collection");
  collectionView?.addEventListener("remove-card", removeCollectionCard);

  document.getElementById("addCard")?.addEventListener("click", () => {
    if (!getCurrentUser()) {
      alert("Sign in before adding cards.");
      return;
    }

    const isBinderView = document.querySelector("pokemon-binder").style.display !== "none";
    showAddCardModal(isBinderView ? "binder" : "collection");
  });

  document.addEventListener("collection:changed", async () => {
    await loadCollection(activeQuery);
    await refreshBinder();
  });

  document.addEventListener("auth:changed", async () => {
    const isAuthed = Boolean(getCurrentUser());

    if (!isAuthed) {
      setAppVisibility(false);
      await loadCollection({ ...DEFAULT_QUERY });
      await refreshBinder();
      return;
    }

    setAppVisibility(true);
    showCollection();
    await migrateLegacyCollectionIfNeeded();
    await loadCollection({ ...DEFAULT_QUERY });
    await refreshBinder();
  });

  setAppVisibility(false);
  await bootstrapSession();
});
