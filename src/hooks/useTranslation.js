import { useEffect, useState } from "react";
import { t, getLang, setLang } from "../utils/i18n";

export default function useTranslation() {
  const [currentLanguage, setCurrentLanguage] = useState(getLang());

  useEffect(() => {
    const rerender = () => {
      setCurrentLanguage(getLang());
    };
    window.addEventListener("lang-change", rerender);
    return () => window.removeEventListener("lang-change", rerender);
  }, []);

  const changeLanguage = (newLang) => {
    setLang(newLang);
    setCurrentLanguage(newLang);
  };

  return {
    t,
    lang: currentLanguage,
    currentLanguage,
    changeLanguage,
  };
}