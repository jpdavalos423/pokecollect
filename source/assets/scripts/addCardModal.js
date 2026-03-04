import { addCardToCollection } from "./collection-store.js";
import { getAllSets, searchCards } from "../../api/pokemonAPI.js";

const FALLBACK_CARD_IMAGE = "assets/images/card-back.png";

const RARITY_TAXONOMY = {
  tcg: {
    label: "TCG",
    families: {
      tcg_common: { label: "Common / Uncommon", rarities: ["Common", "Uncommon"] },
      tcg_rare: {
        label: "Rare",
        rarities: [
          "Rare",
          "Rare Holo",
          "Holo Rare",
          "Rare Holo LV.X",
          "Radiant Rare",
          "Amazing Rare",
          "Black White Rare",
          "ACE SPEC Rare",
          "PROMO",
          "Promo",
        ],
      },
      tcg_ultra: {
        label: "Ultra / Secret",
        rarities: [
          "Ultra Rare",
          "Secret Rare",
          "Rare Ultra",
          "Rare Secret",
          "Hyper rare",
          "Mega Hyper Rare",
          "Full Art Trainer",
          "Special illustration rare",
          "Illustration rare",
          "Classic Collection",
          "LEGEND",
          "Rare PRIME",
          "Double rare",
          "Holo Rare V",
          "Holo Rare VMAX",
          "Holo Rare VSTAR",
        ],
      },
      tcg_misc: { label: "Other", rarities: ["None"] },
    },
  },
  pocket: {
    label: "TCG Pocket",
    families: {
      pocket_diamond: {
        label: "Diamond",
        rarities: ["One Diamond", "Two Diamond", "Three Diamond", "Four Diamond"],
      },
      pocket_star: { label: "Star", rarities: ["One Star", "Two Star", "Three Star"] },
      pocket_shiny: {
        label: "Shiny",
        rarities: ["One Shiny", "Two Shiny", "Shiny rare", "Shiny rare V", "Shiny rare VMAX", "Shiny Ultra Rare"],
      },
      pocket_special: { label: "Special", rarities: ["Crown"] },
    },
  },
};

const CARD_TYPE_OPTIONS = [
  "Grass",
  "Fire",
  "Water",
  "Lightning",
  "Psychic",
  "Fighting",
  "Darkness",
  "Metal",
  "Dragon",
  "Fairy",
  "Colorless",
];

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )];
}

function applyOptions(selectEl, options) {
  if (!selectEl) return;
  options.forEach((optionLabel) => {
    const option = document.createElement("option");
    option.value = optionLabel;
    option.textContent = optionLabel;
    selectEl.appendChild(option);
  });
}

function getFamilyOptions() {
  const families = [];

  Object.values(RARITY_TAXONOMY).forEach((group) => {
    Object.entries(group.families).forEach(([familyKey, family]) => {
      families.push({
        key: familyKey,
        label: `${group.label}: ${family.label}`,
      });
    });
  });

  return families;
}

function getExactRarityOptions(familyKey) {
  if (!familyKey) return [];
  for (const group of Object.values(RARITY_TAXONOMY)) {
    const family = group.families[familyKey];
    if (family) return family.rarities;
  }
  return [];
}

function populateRarityFamilyOptions(selectEl) {
  if (!selectEl) return;
  const families = getFamilyOptions();
  families.forEach(({ key, label }) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    selectEl.appendChild(option);
  });
}

function populateExactRarityOptions(selectEl, familyKey) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">Any exact rarity</option>';
  const exactOptions = getExactRarityOptions(familyKey);
  applyOptions(selectEl, exactOptions);
  selectEl.disabled = !familyKey;
}

function normalizeSetLookup(sets) {
  const byName = new Map();
  const byId = new Map();

  sets.forEach((set) => {
    const id = `${set?.id || ""}`.trim();
    const name = `${set?.name || ""}`.trim();

    if (id) byId.set(id.toLowerCase(), id);
    if (name && id) byName.set(name.toLowerCase(), id);
  });

  return { byName, byId };
}

function resolveSetId(rawValue, setLookup) {
  const value = `${rawValue ?? ""}`.trim();
  if (!value) return "";

  const byNameMatch = setLookup.byName.get(value.toLowerCase());
  if (byNameMatch) return byNameMatch;

  const byIdMatch = setLookup.byId.get(value.toLowerCase());
  return byIdMatch || "";
}

export function showAddCardModal(context = "collection") {
  const oldModal = document.getElementById("global-pokemon-modal");
  if (oldModal) oldModal.remove();

  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const modal = document.createElement("div");
  modal.className = "card-modal";
  modal.id = "global-pokemon-modal";
  modal.innerHTML = `
    <section class="modal-content" role="dialog" aria-modal="true" aria-label="Add Pokemon card">
      <article class="modal-info modal-add-card">
        <header class="modal-header-row">
          <h2 class="modal-name">Add a Pokemon Card</h2>
          <button id="closeAddCardModalBtn" class="modal-close-btn" type="button" aria-label="Close add card modal">Close</button>
        </header>

        <form id="cardSearchForm" class="modal-search-form">
          <div class="modal-search-grid">
            <input id="cardSearchInputName" class="modal-search-field modal-search-field--full" type="text" placeholder="Pokemon name" autocomplete="off" />
            <input id="cardSearchInputNum" class="modal-search-field" type="text" placeholder="Local number (e.g. 17 or 17/102)" autocomplete="off" />
            <input id="cardSearchInputSet" class="modal-search-field modal-search-field--span2" type="text" list="cardSearchSetOptions" placeholder="Set name or set id" autocomplete="off" />
            <datalist id="cardSearchSetOptions"></datalist>
            <select id="cardSearchRarityFamily" class="modal-search-field" aria-label="Filter by rarity family">
              <option value="">Any rarity family</option>
            </select>
            <select id="cardSearchRarityExact" class="modal-search-field" aria-label="Filter by exact rarity" disabled>
              <option value="">Any exact rarity</option>
            </select>
            <select id="cardSearchType" class="modal-search-field" aria-label="Filter by type">
              <option value="">Any type</option>
            </select>
          </div>
          <button id="cardSearchSubmit" type="submit">Search</button>
        </form>

        <div id="cardSearchStatus" class="modal-status" aria-live="polite"></div>
        <div id="cardSearchResult" class="search-results-grid"></div>

        <footer class="modal-add-card-actions">
          <div id="selectedCardSummary" class="modal-selected-summary">No card selected.</div>
          <button id="confirmAddCardBtn" type="button" disabled>Add to Collection</button>
        </footer>
      </article>
    </section>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#cardSearchForm");
  const resultBox = modal.querySelector("#cardSearchResult");
  const statusBox = modal.querySelector("#cardSearchStatus");
  const selectedSummary = modal.querySelector("#selectedCardSummary");
  const confirmBtn = modal.querySelector("#confirmAddCardBtn");
  const closeBtn = modal.querySelector("#closeAddCardModalBtn");
  const inputName = modal.querySelector("#cardSearchInputName");
  const inputNum = modal.querySelector("#cardSearchInputNum");
  const inputSet = modal.querySelector("#cardSearchInputSet");
  const rarityFamilySelect = modal.querySelector("#cardSearchRarityFamily");
  const rarityExactSelect = modal.querySelector("#cardSearchRarityExact");
  const typeSelect = modal.querySelector("#cardSearchType");
  const searchBtn = modal.querySelector("#cardSearchSubmit");
  const setOptionsEl = modal.querySelector("#cardSearchSetOptions");

  populateRarityFamilyOptions(rarityFamilySelect);
  populateExactRarityOptions(rarityExactSelect, "");
  applyOptions(typeSelect, CARD_TYPE_OPTIONS);

  let selectedCard = null;
  let isClosed = false;
  let activeSearchId = 0;
  let setLookup = { byName: new Map(), byId: new Map() };

  const updateSelectedSummary = () => {
    if (!selectedCard) {
      selectedSummary.textContent = "No card selected.";
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Add to Collection";
      return;
    }

    const number = selectedCard.number || selectedCard.localId || "-";
    const setName = selectedCard.set?.name || "Unknown set";
    selectedSummary.textContent = `Selected: ${selectedCard.name || "Unknown"} • ${setName} • #${number}`;
    confirmBtn.disabled = false;
  };

  const setStatus = (message, state = "info") => {
    statusBox.textContent = message || "";
    statusBox.dataset.state = state;
  };

  const close = () => {
    if (isClosed) return;
    isClosed = true;

    document.removeEventListener("keydown", onDocumentKeydown);
    modal.removeEventListener("click", onBackdropClick);
    closeBtn.removeEventListener("click", close);
    rarityFamilySelect.removeEventListener("change", onRarityFamilyChange);
    form.removeEventListener("submit", onSubmit);
    confirmBtn.removeEventListener("click", onConfirmAdd);

    modal.remove();
    if (opener && typeof opener.focus === "function") {
      opener.focus();
    }
  };

  const trapFocus = (event) => {
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements(modal);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  function onDocumentKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    trapFocus(event);
  }

  function onBackdropClick(event) {
    if (event.target === modal) {
      close();
    }
  }

  function onRarityFamilyChange() {
    populateExactRarityOptions(rarityExactSelect, rarityFamilySelect.value);
  }

  const renderCards = (cards) => {
    resultBox.innerHTML = "";

    cards.forEach((card) => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "search-result-card";
      cardDiv.tabIndex = 0;
      cardDiv.setAttribute("role", "button");
      cardDiv.setAttribute("aria-pressed", "false");

      const img = document.createElement("img");
      img.className = "search-result-img";
      img.src = card.images?.small || card.image || FALLBACK_CARD_IMAGE;
      img.alt = card.name || "Pokemon card";
      img.loading = "lazy";
      img.onerror = () => {
        img.onerror = null;
        img.src = FALLBACK_CARD_IMAGE;
      };

      const label = document.createElement("div");
      label.className = "card-name";
      label.textContent = card.name || "Unknown";

      const meta = document.createElement("div");
      meta.className = "search-result-meta";
      const number = card.number || card.localId || "-";
      const setName = card.set?.name || "--";
      const rarity = card.rarity || "--";
      meta.textContent = `${setName} • #${number} • ${rarity}`;

      const selectCard = () => {
        if (cardDiv.classList.contains("selected")) {
          cardDiv.classList.remove("selected");
          cardDiv.setAttribute("aria-pressed", "false");
          selectedCard = null;
          updateSelectedSummary();
          return;
        }

        resultBox.querySelectorAll(".search-result-card.selected").forEach((el) => {
          el.classList.remove("selected");
          el.setAttribute("aria-pressed", "false");
        });

        cardDiv.classList.add("selected");
        cardDiv.setAttribute("aria-pressed", "true");
        selectedCard = card;
        updateSelectedSummary();
      };

      cardDiv.addEventListener("click", selectCard);
      cardDiv.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (cardDiv.classList.contains("selected") && selectedCard?.id === card.id) {
            void onConfirmAdd();
            return;
          }
          selectCard();
          return;
        }

        if (event.key === " ") {
          event.preventDefault();
          selectCard();
        }
      });

      cardDiv.append(img, label, meta);
      resultBox.appendChild(cardDiv);
    });
  };

  async function onSubmit(event) {
    event.preventDefault();

    const filters = {
      name: inputName.value.trim(),
      number: inputNum.value.trim(),
      setId: resolveSetId(inputSet.value, setLookup),
      rarityFamily: rarityFamilySelect.value.trim(),
      rarity: rarityExactSelect.value.trim(),
      type: typeSelect.value,
      page: 1,
      pageSize: 36,
    };

    if (
      !filters.name &&
      !filters.number &&
      !filters.setId &&
      !filters.rarityFamily &&
      !filters.rarity &&
      !filters.type
    ) {
      setStatus("Enter at least one search filter.", "error");
      resultBox.innerHTML = "";
      selectedCard = null;
      updateSelectedSummary();
      return;
    }

    const requestId = ++activeSearchId;
    selectedCard = null;
    updateSelectedSummary();
    resultBox.innerHTML = "";
    searchBtn.disabled = true;
    setStatus("Loading cards...", "loading");

    try {
      const cards = await searchCards(filters);
      if (requestId !== activeSearchId || isClosed) return;

      if (!cards.length) {
        setStatus("No cards found.", "empty");
        return;
      }

      renderCards(cards);
      setStatus(`Found ${cards.length} cards. Select one to add.`, "success");
    } catch (err) {
      if (requestId !== activeSearchId || isClosed) return;
      setStatus(err.message || "Search failed.", "error");
    } finally {
      if (requestId === activeSearchId) {
        searchBtn.disabled = false;
      }
    }
  }

  async function onConfirmAdd() {
    if (!selectedCard?.id) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Adding...";
    setStatus("Adding card...", "loading");

    try {
      await addCardToCollection(selectedCard.id);
      document.dispatchEvent(
        new CustomEvent("collection:changed", {
          detail: { context },
        })
      );
      close();
    } catch (err) {
      setStatus(err.message || "Failed to add card.", "error");
      updateSelectedSummary();
    }
  }

  document.addEventListener("keydown", onDocumentKeydown);
  modal.addEventListener("click", onBackdropClick);
  closeBtn.addEventListener("click", close);
  rarityFamilySelect.addEventListener("change", onRarityFamilyChange);
  form.addEventListener("submit", onSubmit);
  confirmBtn.addEventListener("click", onConfirmAdd);

  updateSelectedSummary();
  setStatus("Use any filter to search cards.", "info");

  void (async () => {
    try {
      const sets = await getAllSets();
      setLookup = normalizeSetLookup(Array.isArray(sets) ? sets : []);
      setOptionsEl.innerHTML = "";

      for (const set of sets) {
        const option = document.createElement("option");
        option.value = set.name || set.id || "";
        option.label = set.id || "";
        setOptionsEl.appendChild(option);
      }
    } catch {
      // Set loading should not block searching by other filters.
    }
  })();

  inputName.focus();
}
