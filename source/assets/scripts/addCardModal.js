import { addCardToCollection } from "./collection-store.js";
import { getCardsByName, getCardsByNameAndNumber } from "../../api/pokemonAPI.js";

const FALLBACK_CARD_IMAGE = "assets/images/card-back.png";

export function showAddCardModal(context = "collection") {
  const oldModal = document.getElementById("global-pokemon-modal");
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.className = "card-modal";
  modal.id = "global-pokemon-modal";
  modal.innerHTML = `
    <section class="modal-content" role="dialog" aria-modal="true" aria-label="Add Pokemon card">
      <article class="modal-info" style="flex: 1; min-width: min(680px, 90vw);">
        <h2 class="modal-name">Add a Pokemon Card</h2>
        <input id="cardSearchInputName" type="text" placeholder="Pokemon name" />
        <input id="cardSearchInputNum" type="text" placeholder="Optional local number (e.g. 17; 17/102)" />
        <button id="cardSearchSubmit" type="button">Search</button>
        <div id="cardSearchResult" class="search-results-grid" style="margin-top: 16px;"></div>
        <button id="confirmAddCardBtn" type="button" style="display:none; margin-top:12px;">Add to Collection</button>
      </article>
    </section>
  `;

  document.body.appendChild(modal);

  const resultBox = modal.querySelector("#cardSearchResult");
  const confirmBtn = modal.querySelector("#confirmAddCardBtn");
  const inputName = modal.querySelector("#cardSearchInputName");
  const inputNum = modal.querySelector("#cardSearchInputNum");
  const searchBtn = modal.querySelector("#cardSearchSubmit");

  let selectedCard = null;

  const close = () => modal.remove();

  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  const renderCards = (cards) => {
    resultBox.innerHTML = "";
    cards.forEach((card) => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "search-result-card";

      const img = document.createElement("img");
      img.className = "search-result-img";
      img.src = card.images?.small || card.image || FALLBACK_CARD_IMAGE;
      img.alt = card.name || "Pokemon card";
      img.loading = "lazy";

      const label = document.createElement("div");
      label.className = "card-name";
      label.textContent = card.name || "Unknown";

      cardDiv.append(img, label);
      cardDiv.addEventListener("click", () => {
        resultBox.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
        cardDiv.classList.add("selected");
        selectedCard = card;
        confirmBtn.style.display = "inline-flex";
      });

      resultBox.appendChild(cardDiv);
    });
  };

  searchBtn.addEventListener("click", async () => {
    const name = inputName.value.trim();
    const number = inputNum.value.trim();

    if (!name) {
      resultBox.innerHTML = "<p>Please enter a Pokemon name.</p>";
      return;
    }

    selectedCard = null;
    confirmBtn.style.display = "none";
    resultBox.innerHTML = "<p>Loading...</p>";

    try {
      const cards = number
        ? await getCardsByNameAndNumber(name, number)
        : await getCardsByName(name);

      if (!cards.length) {
        resultBox.innerHTML = "<p>No cards found.</p>";
        return;
      }

      renderCards(cards);
    } catch (err) {
      resultBox.innerHTML = `<p>Error: ${err.message}</p>`;
    }
  });

  confirmBtn.addEventListener("click", async () => {
    if (!selectedCard?.id) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Adding...";

    try {
      await addCardToCollection(selectedCard.id);
      document.dispatchEvent(
        new CustomEvent("collection:changed", {
          detail: { context },
        })
      );
      close();
    } catch (err) {
      resultBox.innerHTML = `<p>Error: ${err.message}</p>`;
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Add to Collection";
    }
  });
}
