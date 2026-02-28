const API_BASE = window.POKECOLLECT_API_BASE || "http://localhost:3001/api/v1";

let authToken = sessionStorage.getItem("pokecollect_auth_token") || null;

export function setAuthToken(token) {
  authToken = token || null;
  if (authToken) {
    sessionStorage.setItem("pokecollect_auth_token", authToken);
  } else {
    sessionStorage.removeItem("pokecollect_auth_token");
  }
}

export function getAuthToken() {
  return authToken;
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function apiGet(path) {
  return request(path, { method: "GET" });
}

export function apiPost(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
}

export function apiPut(path, body) {
  return request(path, {
    method: "PUT",
    body: JSON.stringify(body || {}),
  });
}

export function apiDelete(path) {
  return request(path, { method: "DELETE" });
}

export { API_BASE };
