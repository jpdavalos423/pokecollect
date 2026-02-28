import { apiDelete, apiGet, apiPut } from "./api-client.js";

export async function fetchBinder(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}` !== "") {
      params.set(key, `${value}`);
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiGet(`/binder${suffix}`);
}

export async function assignBinderSlot(userCardId, page, slot) {
  return apiPut("/binder/slots", { userCardId, page, slot });
}

export async function unassignBinderCard(userCardId) {
  return apiDelete(`/binder/slots/${encodeURIComponent(userCardId)}`);
}
