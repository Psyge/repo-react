import { useEffect, useState } from "react";
import { t, getLang } from "../utils/i18n";

export default function useTranslation() {
  const [, setUpdate] = useState(0);

  useEffect(() => {
    const rerender = () => setUpdate((x) => x + 1);
    window.addEventListener("lang-change", rerender);
    return () => window.removeEventListener("lang-change", rerender);
  }, []);

  return {
    t,
    lang: getLang(),
  };
}