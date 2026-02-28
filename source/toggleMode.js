const THEME_STORAGE_KEY = "pokemonDarkMode";
const darkModeToggleBtn = document.getElementById("darkModeToggle");
const bodyElement = document.body;
const prefersDarkQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
const hasExplicitTheme = savedTheme === "true" || savedTheme === "false";
const shouldUseDarkMode = hasExplicitTheme ? savedTheme === "true" : Boolean(prefersDarkQuery?.matches);

bodyElement.classList.toggle("dark-mode", shouldUseDarkMode);

function syncWithSystemTheme(event) {
  if (localStorage.getItem(THEME_STORAGE_KEY) !== null) return;
  bodyElement.classList.toggle("dark-mode", event.matches);
}

if (prefersDarkQuery) {
  if (typeof prefersDarkQuery.addEventListener === "function") {
    prefersDarkQuery.addEventListener("change", syncWithSystemTheme);
  } else if (typeof prefersDarkQuery.addListener === "function") {
    prefersDarkQuery.addListener(syncWithSystemTheme);
  }
}

if (darkModeToggleBtn) {
  darkModeToggleBtn.addEventListener("click", () => {
    bodyElement.classList.toggle("dark-mode");
    localStorage.setItem(THEME_STORAGE_KEY, String(bodyElement.classList.contains("dark-mode")));
  });
}
