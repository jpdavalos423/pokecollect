import { assignBinderSlot } from "./binder-store.js";
import { fetchCollection } from "./collection-store.js";

export async function showAssignCardModal(pageIndex, slotIndex) {
  if (!Number.isInteger(pageIndex) || pageIndex < 1) return;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) return;

  const oldModal = document.getElementById("assign-card-modal");
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.className = "card-modal";
  modal.id = "assign-card-modal";
  modal.innerHTML = `
    <section class="modal-content" role="dialog" aria-modal="true" aria-label="Assign card to binder slot">
      <article class="modal-info" style="flex:1; min-width: min(680px, 90vw);">
        <h2 class="modal-name">Assign Card to Page ${pageIndex}, Slot ${slotIndex + 1}</h2>
        <div id="assignCardResult" class="search-results-grid"></div>
        <button id="confirmAssignCardBtn" type="button" style="display:none; margin-top:10px;">Assign to Slot</button>
      </article>
    </section>
  `;

  document.body.appendChild(modal);

  const resultBox = modal.querySelector("#assignCardResult");
  const confirmBtn = modal.querySelector("#confirmAssignCardBtn");

  let selectedCard = null;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });

  const response = await fetchCollection({
    assigned: false,
    page: 1,
    pageSize: 500,
    sortBy: "addedAt",
    sortDir: "desc",
  });

  if (!response.items.length) {
    resultBox.innerHTML = "<p>No unassigned cards available. Add cards first or unassign one from binder.</p>";
    return;
  }

  response.items.forEach((card) => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "search-result-card";

    const img = document.createElement("img");
    img.className = "search-result-img";
    img.src = card.imageUrl;
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

  confirmBtn.addEventListener("click", async () => {
    if (!selectedCard?.userCardId) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Assigning...";

    try {
      await assignBinderSlot(selectedCard.userCardId, pageIndex, slotIndex);
      document.dispatchEvent(new CustomEvent("collection:changed"));
      modal.remove();
    } catch (err) {
      resultBox.innerHTML = `<p>Error: ${err.message}</p>`;
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Assign to Slot";
    }
  });
}
