import "../../components/binder/pokemon-binder.js";
import { fetchBinder } from "./binder-store.js";
import { getCurrentUser } from "./auth-store.js";

function getBinderElement() {
  return document.querySelector("pokemon-binder");
}

function mapBinderItemsToPages(items) {
  return items.map((item) => ({
    userCardId: item.userCardId,
    page: item.page,
    slot: item.slot,
    imgUrl: item.card?.imageUrl,
    name: item.card?.name,
    cardId: item.card?.cardId,
    rarity: item.card?.rarity,
    setName: item.card?.setName,
    number: item.card?.number,
    marketPrice: item.card?.marketPrice,
  }));
}

export async function refreshBinder() {
  const binder = getBinderElement();
  if (!binder) return;

  if (!getCurrentUser()) {
    binder.setPages([]);
    return;
  }

  try {
    const response = await fetchBinder({ page: 1, pageSize: 500 });
    binder.setPages(mapBinderItemsToPages(response.items || []));
  } catch (err) {
    console.error("Failed to refresh binder", err);
    binder.setPages([]);
  }
}

function turnPageRight() {
  getBinderElement()?.flipForward();
}

function turnPageLeft() {
  getBinderElement()?.flipBackward();
}

function jumpToPage() {
  const input = document.getElementById("binderPageJump");
  const page = Number(input?.value);
  if (!Number.isInteger(page) || page < 1) return;
  getBinderElement()?.jumpToPage(page);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("turnPageRight")?.addEventListener("click", turnPageRight);
  document.getElementById("turnPageLeft")?.addEventListener("click", turnPageLeft);
  document.getElementById("jumpToPageBtn")?.addEventListener("click", jumpToPage);

  document.getElementById("binderPageJump")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") jumpToPage();
  });

  document.addEventListener("auth:changed", () => {
    refreshBinder();
  });

  document.addEventListener("collection:changed", () => {
    refreshBinder();
  });
});
