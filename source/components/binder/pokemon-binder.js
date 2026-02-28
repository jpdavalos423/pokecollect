import { showAssignCardModal } from "../../assets/scripts/assign-card-modal.js";
import { formatMarketPrice } from "../../assets/scripts/priceHelper.js";
import { unassignBinderCard } from "../../assets/scripts/binder-store.js";

const FALLBACK_CARD_IMAGE = "assets/images/card-back.png";

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      max-width: 900px;
      aspect-ratio: 4 / 3;
      border: 1px solid #8fb2d2;
      border-radius: 24px;
      background: linear-gradient(180deg, #edf4fb 0%, #e2edf8 100%);
      box-shadow: 0 16px 36px rgba(13, 37, 67, 0.25);
      overflow: hidden;
      perspective: 1000px;
    }

    .binder {
      display: flex;
      width: 100%;
      height: 100%;
      position: relative;
      background:
        linear-gradient(90deg, rgba(16, 41, 65, 0.09) 0%, rgba(16, 41, 65, 0.05) 7%, rgba(16, 41, 65, 0.05) 93%, rgba(16, 41, 65, 0.09) 100%),
        linear-gradient(180deg, #f5f9ff 0%, #e9f2fc 100%);
    }

    .leaf-container {
      flex: 1;
      position: relative;
    }

    .leaf-back,
    .leaf-flip {
      position: absolute;
      inset: 0;
    }

    .leaf-back { z-index: 1; }
    .leaf-flip { z-index: 2; }

    .leaf-flip .leaf-inner {
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      transition: transform 0.3s ease;
    }

    .left-leaf .leaf-flip .leaf-inner { transform-origin: right center; }
    .right-leaf .leaf-flip .leaf-inner { transform-origin: left center; }
    .leaf-flip.flip-forward .leaf-inner { transform: rotateY(-180deg); }
    .leaf-flip.flip-back .leaf-inner { transform: rotateY(180deg); }

    .page {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      padding: 10px;
      box-sizing: border-box;
      background: linear-gradient(180deg, #ffffff 0%, #f2f8ff 100%);
      backface-visibility: hidden;
    }

    :host-context(body.dark-mode) .page {
      background: linear-gradient(180deg, #16283b 0%, #0f1f30 100%);
      color: #fff;
    }

    .page.back { transform: rotateY(180deg); }

    .page-number {
      font-family: 'Chakra Petch', 'Segoe UI', Tahoma, Verdana, sans-serif;
      color: #1a5a92;
      font-size: 0.92rem;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    :host-context(body.dark-mode) .page-number {
      color: #ffda73;
    }

    .cards-container {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, auto);
      gap: 8px;
    }

    .card-slot {
      border-radius: 9px;
      border: 1px dashed #8aaed1;
      background: linear-gradient(180deg, #f5f9ff 0%, #e8f2fe 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      aspect-ratio: 1/1.4;
      overflow: hidden;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .card-slot:hover {
      border-color: #2a75bb;
      box-shadow: 0 0 0 2px rgba(42, 117, 187, 0.2);
    }

    .card-slot img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    :host-context(body.dark-mode) {
      border-color: #36516d;
      background: linear-gradient(180deg, #152639 0%, #122032 100%);
      box-shadow: 0 20px 38px rgba(4, 11, 18, 0.5);
    }

    :host-context(body.dark-mode) .binder {
      background:
        linear-gradient(90deg, rgba(2, 8, 15, 0.45) 0%, rgba(2, 8, 15, 0.2) 7%, rgba(2, 8, 15, 0.2) 93%, rgba(2, 8, 15, 0.45) 100%),
        linear-gradient(180deg, #132538 0%, #112234 100%);
    }

    :host-context(body.dark-mode) .card-slot {
      border-color: #3e5f7f;
      background: linear-gradient(180deg, #182c40 0%, #102131 100%);
    }

    :host-context(body.dark-mode) .card-slot:hover {
      border-color: #5a88b1;
      box-shadow: 0 0 0 2px rgba(120, 182, 238, 0.22);
    }

    .leaf-inner.instant { transition: none !important; }
  </style>
  <div class="binder">
    <div class="leaf-container left-leaf">
      <div class="leaf leaf-back">
        <div class="page front">
          <div class="page-number"></div>
          <div class="cards-container"></div>
        </div>
      </div>
      <div class="leaf leaf-flip">
        <div class="leaf-inner">
          <div class="page front">
            <div class="page-number"></div>
            <div class="cards-container"></div>
          </div>
          <div class="page back">
            <div class="page-number"></div>
            <div class="cards-container"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="leaf-container right-leaf">
      <div class="leaf leaf-back">
        <div class="page front">
          <div class="page-number"></div>
          <div class="cards-container"></div>
        </div>
      </div>
      <div class="leaf leaf-flip">
        <div class="leaf-inner">
          <div class="page front">
            <div class="page-number"></div>
            <div class="cards-container"></div>
          </div>
          <div class="page back">
            <div class="page-number"></div>
            <div class="cards-container"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

class PokemonBinder extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._leftLeafContainer = this.shadowRoot.querySelector(".left-leaf");
    this._rightLeafContainer = this.shadowRoot.querySelector(".right-leaf");
    this._leftBackLeaf = this._leftLeafContainer.querySelector(".leaf-back");
    this._leftFlipLeaf = this._leftLeafContainer.querySelector(".leaf-flip");
    this._rightBackLeaf = this._rightLeafContainer.querySelector(".leaf-back");
    this._rightFlipLeaf = this._rightLeafContainer.querySelector(".leaf-flip");
    this._leftFlipInner = this._leftFlipLeaf.querySelector(".leaf-inner");
    this._rightFlipInner = this._rightFlipLeaf.querySelector(".leaf-inner");

    this.pagesData = new Map();
    this.currentIndex = 1;
    this.flipping = false;

    this._renderFaces();
  }

  setPages(collection) {
    if (!Array.isArray(collection)) {
      this.pagesData = new Map();
      this._renderFaces();
      return;
    }

    const pagesMap = new Map();
    for (const card of collection) {
      const page = Number(card.page);
      const slot = Number(card.slot);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(slot) || slot < 0 || slot > 8) {
        continue;
      }

      if (!pagesMap.has(page)) pagesMap.set(page, Array(9).fill(undefined));
      pagesMap.get(page)[slot] = { ...card };
    }

    this.pagesData = pagesMap;
    if (this.currentIndex < 1) this.currentIndex = 1;
    this._renderFaces();
  }

  jumpToPage(page) {
    if (!Number.isInteger(page) || page < 1) return;
    this.currentIndex = page % 2 === 0 ? page - 1 : page;
    this._renderFaces();
  }

  _renderFaces() {
    const leftFrontData = this.pagesData.get(this.currentIndex);
    const leftBackData = this.pagesData.get(this.currentIndex - 1);
    const rightFrontData = this.pagesData.get(this.currentIndex + 1);
    const rightBackData = this.pagesData.get(this.currentIndex + 2);

    this._loadFace(this._leftBackLeaf.querySelector(".page.front"), this.pagesData.get(this.currentIndex - 2), this.currentIndex - 2);
    this._loadFace(this._rightBackLeaf.querySelector(".page.front"), this.pagesData.get(this.currentIndex + 3), this.currentIndex + 3);

    this._loadFace(this._leftFlipLeaf.querySelector(".page.front"), leftFrontData, this.currentIndex);
    this._loadFace(this._leftFlipLeaf.querySelector(".page.back"), leftBackData, this.currentIndex - 1);
    this._loadFace(this._rightFlipLeaf.querySelector(".page.front"), rightFrontData, this.currentIndex + 1);
    this._loadFace(this._rightFlipLeaf.querySelector(".page.back"), rightBackData, this.currentIndex + 2);
  }

  _loadFace(faceEl, cardData, pageNumber) {
    const pageLabel = faceEl.querySelector(".page-number");
    pageLabel.textContent = pageNumber > 0 ? `Page ${pageNumber}` : "";

    const container = faceEl.querySelector(".cards-container");
    container.innerHTML = "";

    const slots = Array.isArray(cardData) ? cardData : [];
    for (let i = 0; i < 9; i += 1) {
      const slotEl = document.createElement("div");
      slotEl.className = "card-slot";

      const slotCard = slots[i];
      if (slotCard?.imgUrl) {
        const img = document.createElement("img");
        img.src = slotCard.imgUrl || FALLBACK_CARD_IMAGE;
        img.alt = slotCard.name || "Pokemon card";
        img.loading = "lazy";
        img.onerror = () => {
          img.onerror = null;
          img.src = FALLBACK_CARD_IMAGE;
        };
        img.addEventListener("click", () => this.showModal(slotCard));
        slotEl.appendChild(img);
      } else if (pageNumber > 0) {
        slotEl.addEventListener("click", () => showAssignCardModal(pageNumber, i));
      } else {
        slotEl.style.opacity = "0.45";
        slotEl.style.cursor = "default";
      }

      container.appendChild(slotEl);
    }
  }

  flipForward() {
    if (this.flipping) return;

    this.flipping = true;
    this._rightFlipLeaf.style.zIndex = 3;
    this._rightFlipLeaf.classList.add("flip-forward");

    this._rightFlipInner.addEventListener(
      "transitionend",
      () => {
        this._rightFlipInner.classList.add("instant");
        this._rightFlipInner.style.transform = "rotateY(0deg)";
        void this._rightFlipInner.offsetWidth;
        this._rightFlipInner.classList.remove("instant");
        this._rightFlipInner.style.transform = "";
        this._rightFlipLeaf.style.zIndex = 2;
        this.currentIndex += 2;
        this.flipping = false;
        this._rightFlipLeaf.classList.remove("flip-forward");
        this._renderFaces();
      },
      { once: true }
    );
  }

  flipBackward() {
    if (this.currentIndex < 2 || this.flipping) return;

    this.flipping = true;
    this._leftFlipLeaf.style.zIndex = 3;
    this._leftFlipLeaf.classList.add("flip-back");

    this._leftFlipInner.addEventListener(
      "transitionend",
      () => {
        this._leftFlipInner.classList.add("instant");
        this._leftFlipInner.style.transform = "rotateY(0deg)";
        void this._leftFlipInner.offsetWidth;
        this._leftFlipInner.classList.remove("instant");
        this._leftFlipInner.style.transform = "";
        this._leftFlipLeaf.style.zIndex = 2;
        this.currentIndex -= 2;
        this.flipping = false;
        this._leftFlipLeaf.classList.remove("flip-back");
        this._renderFaces();
      },
      { once: true }
    );
  }

  async showModal(slotCard) {
    const oldModal = document.getElementById("global-pokemon-modal");
    if (oldModal) oldModal.remove();

    const modal = document.createElement("div");
    modal.className = "card-modal";
    modal.id = "global-pokemon-modal";

    const price = slotCard.marketPrice ? `$${Number(slotCard.marketPrice).toFixed(2)}` : formatMarketPrice(null);

    modal.innerHTML = `
      <section class="modal-content" role="dialog" aria-modal="true" aria-label="Binder card details">
        <figure class="modal-image">
          <img class="modal-card" src="${slotCard.imgUrl || FALLBACK_CARD_IMAGE}" alt="Pokemon Card">
        </figure>
        <article class="modal-info">
          <h2 class="modal-name">${slotCard.name || "Unknown"}</h2>
          <ul class="modal-details">
            <li>Set: ${slotCard.setName || "--"}</li>
            <li>Number: ${slotCard.number || "-"}</li>
            <li>Rarity: ${slotCard.rarity || "Unknown"}</li>
            <li>Price: ${price}</li>
          </ul>
          <button id="removeBinderBtn" type="button">Remove from Binder</button>
        </article>
      </section>
    `;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.remove();
    });

    const removeBtn = modal.querySelector("#removeBinderBtn");
    if (!slotCard.userCardId) {
      removeBtn.disabled = true;
      removeBtn.textContent = "Unavailable";
    } else {
      removeBtn.addEventListener("click", async () => {
        removeBtn.disabled = true;
        removeBtn.textContent = "Removing...";

        try {
          await unassignBinderCard(slotCard.userCardId);
          document.dispatchEvent(new CustomEvent("collection:changed"));
          modal.remove();
        } catch (err) {
          removeBtn.disabled = false;
          removeBtn.textContent = "Remove from Binder";
          console.error("Failed to remove from binder", err);
        }
      });
    }

    document.body.appendChild(modal);
  }
}

customElements.define("pokemon-binder", PokemonBinder);
