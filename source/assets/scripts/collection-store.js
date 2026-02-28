import { apiDelete, apiGet, apiPost } from "./api-client.js";

export async function fetchCollection(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}` !== "") {
      params.set(key, `${value}`);
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiGet(`/collection${suffix}`);
}

export async function addCardToCollection(cardId) {
  return apiPost("/collection", { cardId });
}

export async function removeCardFromCollection(userCardId) {
  return apiDelete(`/collection/${encodeURIComponent(userCardId)}`);
}
