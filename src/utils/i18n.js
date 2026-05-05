import en from "../lang/en.json";
import fi from "../lang/fi.json";

const translations = {
  en,
  fi,
};

let currentLang = localStorage.getItem("lang") || "en";

export const setLang = (lang) => {
  currentLang = lang;
  localStorage.setItem("lang", lang);
  window.dispatchEvent(new Event("lang-change"));
};

export const t = (key) => {
  return translations[currentLang]?.[key] || key;
};

export const getLang = () => currentLang;