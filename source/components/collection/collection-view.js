import { formatMarketPrice } from "../../assets/scripts/priceHelper.js";
import { getCardById } from "../../api/pokemonAPI.js";

const FALLBACK_CARD_IMAGE = "assets/images/card-back.png";

class PokemonCollection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.cards = [];
    this.loading = false;
    this.error = "";
    this.density = "comfy";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: min(1200px, 100%);
          margin: 0 auto;
          padding: var(--space-4, 16px) 0;
          box-sizing: border-box;
        }

        .state {
          text-align: center;
          padding: 1.5rem;
          color: var(--ink-500, #56728d);
          border-radius: 14px;
          font-weight: 600;
          background: rgba(252, 254, 255, 0.6);
          border: 1px dashed #b7cde2;
        }

        .state.error {
          color: #b42318;
          background: #fee4e2;
          border: 1px solid #f0b7b3;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          gap: 12px;
          flex-wrap: wrap;
          background: rgba(252, 254, 255, 0.72);
          border: 1px solid #bdd2e7;
          border-radius: 18px;
          box-shadow: 0 8px 18px rgba(15, 42, 70, 0.1);
          padding: 12px;
        }

        .count {
          color: var(--ink-700, #36536f);
          font-size: 0.92rem;
          font-weight: 700;
        }

        .density-toggle {
          display: inline-flex;
          gap: 8px;
          padding: 4px;
          border-radius: 999px;
          background: #e9f2fb;
          border: 1px solid #c3d7ea;
        }

        .density-toggle button {
          all: unset;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 999px;
          color: #1e5d92;
          font-size: 0.8rem;
          font-weight: 800;
          transition: background-color 0.18s ease, color 0.18s ease;
        }

        .density-toggle button.active {
          background: linear-gradient(180deg, #2584d9 0%, #1269b5 100%);
          color: #fff;
        }

        .collection-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }

        .collection-list.compact {
          grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
          gap: 10px;
        }

        .collection-card {
          border-radius: 16px;
          border: 1px solid #c7d9eb;
          background: linear-gradient(180deg, #ffffff 0%, #f2f8ff 100%);
          box-shadow: 0 8px 18px rgba(19, 44, 76, 0.1);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .collection-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 24px rgba(19, 44, 76, 0.18);
          border-color: #8db5d9;
        }

        .collection-card img {
          width: 100%;
          object-fit: contain;
          border-radius: 12px;
          background: #e8f1fb;
        }

        .card-name {
          font-weight: 800;
          color: #163b63;
          margin-top: 2px;
        }

        .card-meta {
          display: grid;
          gap: 4px;
          color: #3f5875;
          font-size: 0.82rem;
          font-weight: 600;
        }

        :host-context(body.dark-mode) .toolbar,
        :host-context(body.dark-mode) .state {
          background: rgba(21, 34, 50, 0.82);
          border-color: #35516d;
          color: #c0d4e8;
        }

        :host-context(body.dark-mode) .count,
        :host-context(body.dark-mode) .card-meta {
          color: #bfd3e8;
        }

        :host-context(body.dark-mode) .density-toggle {
          background: #203246;
          border-color: #39546f;
        }

        :host-context(body.dark-mode) .density-toggle button {
          color: #bed6eb;
        }

        :host-context(body.dark-mode) .collection-card {
          background: linear-gradient(180deg, #16283b 0%, #102132 100%);
          border-color: #35516d;
        }

        :host-context(body.dark-mode) .collection-card:hover {
          border-color: #4e7395;
          box-shadow: 0 16px 24px rgba(4, 11, 18, 0.4);
        }

        :host-context(body.dark-mode) .collection-card img {
          background: #0b1827;
        }

        :host-context(body.dark-mode) .card-name {
          color: #dfeaf7;
        }

        @media (max-width: 760px) {
          .toolbar {
            padding: 10px;
          }
        }
      </style>
      <div class="toolbar">
        <div class="count" id="collection-count"></div>
        <div class="density-toggle" role="group" aria-label="Card density">
          <button id="density-comfy" class="active" type="button">Comfy</button>
          <button id="density-compact" type="button">Compact</button>
        </div>
      </div>
      <div class="collection-list" id="collection-list"></div>
      <div class="state" id="state"></div>
    `;

    this.shadowRoot.getElementById("density-comfy")?.addEventListener("click", () => {
      this.density = "comfy";
      this.render();
    });

    this.shadowRoot.getElementById("density-compact")?.addEventListener("click", () => {
      this.density = "compact";
      this.render();
    });
  }

  connectedCallback() {
    this.render();
  }

  setCards(cards) {
    this.cards = Array.isArray(cards) ? cards : [];
    this.loading = false;
    this.error = "";
    this.render();
  }

  setLoading(isLoading) {
    this.loading = Boolean(isLoading);
    this.render();
  }

  setError(message) {
    this.error = message || "";
    this.loading = false;
    this.render();
  }

  render() {
    const list = this.shadowRoot.getElementById("collection-list");
    const state = this.shadowRoot.getElementById("state");
    const count = this.shadowRoot.getElementById("collection-count");
    const comfyBtn = this.shadowRoot.getElementById("density-comfy");
    const compactBtn = this.shadowRoot.getElementById("density-compact");

    list.innerHTML = "";
    state.textContent = "";
    state.className = "state";
    count.textContent = `${this.cards.length} card${this.cards.length === 1 ? "" : "s"}`;

    list.classList.toggle("compact", this.density === "compact");
    comfyBtn.classList.toggle("active", this.density === "comfy");
    compactBtn.classList.toggle("active", this.density === "compact");

    if (this.loading) {
      state.textContent = "Loading collection...";
      return;
    }

    if (this.error) {
      state.textContent = this.error;
      state.classList.add("error");
      return;
    }

    if (!this.cards.length) {
      state.textContent = "No cards in your collection yet.";
      return;
    }

    this.cards.forEach((card) => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "collection-card";

      const img = document.createElement("img");
      img.src = card.imageUrl || FALLBACK_CARD_IMAGE;
      img.alt = card.name || "Pokemon card";
      img.loading = "lazy";
      img.onerror = () => {
        img.onerror = null;
        img.src = FALLBACK_CARD_IMAGE;
      };

      const nameEl = document.createElement("div");
      nameEl.className = "card-name";
      nameEl.textContent = card.name || "Unknown";

      const metaEl = document.createElement("div");
      metaEl.className = "card-meta";
      const setLabel = card.setName ? `Set: ${card.setName}` : "Set: --";
      const rarityLabel = card.rarity ? `Rarity: ${card.rarity}` : "Rarity: --";
      const numberLabel = card.number ? `No. ${card.number}` : "No. --";
      const priceLabel = card.marketPrice ? `Price: $${Number(card.marketPrice).toFixed(2)}` : "Price: unavailable";
      metaEl.innerHTML = `
        <span>${setLabel}</span>
        <span>${numberLabel}</span>
        <span>${rarityLabel}</span>
        <span>${priceLabel}</span>
      `;

      cardDiv.append(img, nameEl, metaEl);
      cardDiv.addEventListener("click", () => this.showCardModal(card));
      list.appendChild(cardDiv);
    });
  }

  async showCardModal(card) {
    const oldModal = document.getElementById("global-pokemon-modal");
    if (oldModal) oldModal.remove();

    let fullCard = null;
    try {
      if (card.cardId) {
        fullCard = await getCardById(card.cardId);
      }
    } catch {
      fullCard = null;
    }

    const modal = document.createElement("div");
    modal.className = "card-modal";
    modal.id = "global-pokemon-modal";

    const price = fullCard ? formatMarketPrice(fullCard) : card.marketPrice ? `$${Number(card.marketPrice).toFixed(2)}` : "Price unavailable";
    const rarity = fullCard?.rarity || card.rarity || "Unknown";
    const set = fullCard?.set?.name || card.setName || "--";
    const number = fullCard?.number || card.number || "-";
    const setSize = fullCard?.set?.printedTotal || "-";

    modal.innerHTML = `
      <section class="modal-content" role="dialog" aria-modal="true" aria-label="Card details">
        <figure class="modal-image">
          <img class="modal-card" src="${card.imageUrl || FALLBACK_CARD_IMAGE}" alt="Pokemon Card">
        </figure>
        <article class="modal-info">
          <h2 class="modal-name">${card.name || "Unknown"}</h2>
          <ul class="modal-details">
            <li>Set: ${set}</li>
            <li>Number: ${number}/${setSize}</li>
            <li>Rarity: ${rarity}</li>
            <li>Price: ${price}</li>
          </ul>
          <button id="deleteCardBtn" type="button">Remove from Collection</button>
        </article>
      </section>
    `;

    const removeModal = () => {
      document.removeEventListener("keydown", onEsc);
      modal.remove();
    };

    const onEsc = (event) => {
      if (event.key === "Escape") removeModal();
    };

    document.addEventListener("keydown", onEsc);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) removeModal();
    });

    modal.querySelector("#deleteCardBtn")?.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("remove-card", {
          detail: { userCardId: card.userCardId },
          bubbles: true,
          composed: true,
        })
      );
      removeModal();
    });

    document.body.appendChild(modal);
  }
}

customElements.define("pokemon-collection", PokemonCollection);
