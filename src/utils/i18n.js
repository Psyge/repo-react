import en from "../lang/en.json";
import fi from "../lang/fi.json";

const translations = { en, fi };
const validLanguage = (lang) => lang === "en" || lang === "fi";
function initialLanguage() {
  if (typeof document !== "undefined") {
    const routeLanguage = document.documentElement.dataset.routeLanguage;
    if (validLanguage(routeLanguage)) return routeLanguage;
  }
  try {
    const saved = localStorage.getItem("lang");
    if (validLanguage(saved)) return saved;
  } catch { /* Storage may be unavailable, including during prerendering. */ }
  return "en";
}
let currentLang = initialLanguage();
export const setLang = (lang) => {
  if (!validLanguage(lang)) return;
  currentLang = lang;
  if (typeof window !== "undefined") {
    try { localStorage.setItem("lang", lang); } catch { /* Keep in-memory choice. */ }
    window.dispatchEvent(new Event("lang-change"));
  }
};
export const t = (key) => translations[currentLang]?.[key] || key;
export const getLang = () => currentLang;
