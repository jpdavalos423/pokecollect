import { apiGet, apiPost, setAuthToken } from "./api-client.js";

let currentUser = null;

function emitAuthChange() {
  document.dispatchEvent(
    new CustomEvent("auth:changed", {
      detail: { user: currentUser },
    })
  );
}

export function getCurrentUser() {
  return currentUser;
}

export async function register(email, password) {
  const response = await apiPost("/auth/register", { email, password });
  setAuthToken(response.token);
  currentUser = response.user;
  emitAuthChange();
  return response.user;
}

export async function login(email, password) {
  const response = await apiPost("/auth/login", { email, password });
  setAuthToken(response.token);
  currentUser = response.user;
  emitAuthChange();
  return response.user;
}

export async function logout() {
  try {
    await apiPost("/auth/logout", {});
  } catch {
    // Ignore logout API failures in client.
  }
  setAuthToken(null);
  currentUser = null;
  emitAuthChange();
}

export async function bootstrapSession() {
  try {
    const response = await apiGet("/auth/me");
    currentUser = response.user;
  } catch {
    setAuthToken(null);
    currentUser = null;
  }
  emitAuthChange();
  return currentUser;
}

export function initAuthPanel() {
  const panel = document.getElementById("authPanel");
  if (!panel) return;

  const emailInput = panel.querySelector("#authEmail");
  const passwordInput = panel.querySelector("#authPassword");
  const loginBtn = panel.querySelector("#authLogin");
  const registerBtn = panel.querySelector("#authRegister");
  const logoutBtn = panel.querySelector("#authLogout");
  const statusEl = panel.querySelector("#authStatus");
  const quickSignOutBtn = document.getElementById("quickSignOut");

  const setStatus = (message, isError = false) => {
    statusEl.textContent = message;
    statusEl.dataset.error = isError ? "true" : "false";
  };

  const render = () => {
    const isAuthed = Boolean(currentUser);

    panel.classList.toggle("is-authed", isAuthed);
    panel.classList.toggle("hidden", isAuthed);
    quickSignOutBtn?.classList.toggle("hidden", !isAuthed);

    logoutBtn.style.display = "none";
    loginBtn.style.display = isAuthed ? "none" : "inline-flex";
    registerBtn.style.display = isAuthed ? "none" : "inline-flex";
    emailInput.style.display = isAuthed ? "none" : "inline-flex";
    passwordInput.style.display = isAuthed ? "none" : "inline-flex";

    if (isAuthed) {
      setStatus(`Signed in as ${currentUser.email}`);
      passwordInput.value = "";
    } else {
      setStatus("Sign in to sync your collection.");
    }
  };

  const readCreds = () => ({
    email: emailInput.value.trim(),
    password: passwordInput.value,
  });

  loginBtn?.addEventListener("click", async () => {
    const { email, password } = readCreds();
    if (!email || !password) {
      setStatus("Email and password are required.", true);
      return;
    }

    try {
      setStatus("Signing in...");
      await login(email, password);
      render();
    } catch (err) {
      setStatus(err.message || "Login failed", true);
    }
  });

  registerBtn?.addEventListener("click", async () => {
    const { email, password } = readCreds();
    if (!email || !password) {
      setStatus("Email and password are required.", true);
      return;
    }

    try {
      setStatus("Creating account...");
      await register(email, password);
      render();
    } catch (err) {
      setStatus(err.message || "Registration failed", true);
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    await logout();
    render();
  });

  quickSignOutBtn?.addEventListener("click", async () => {
    await logout();
    render();
  });

  document.addEventListener("auth:changed", () => {
    render();
  });

  render();
}
