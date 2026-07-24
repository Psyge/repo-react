import { useEffect, useMemo, useRef, useState } from "react";
import useTranslation from "../hooks/useTranslation";
import adRotator from "../data/adRotator";

/* ========================================================================
   AdRotator — kiertää mainos-/kumppanibannereita samalla logiikalla kuin
   vanhassa vanilla-JS-versiossa (yksi näkyvissä kerrallaan, "aktiivinen"
   -luokka, setInterval vaihtaa seuraavaan).

   Bannerit itse tulevat src/data/adRotator.js:stä valmiina HTML-
   merkkijonoina + kielimerkintänä ({ html, lang }) — lisää/poista niitä
   sieltä, ei tästä tiedostosta. Komponentti suodattaa listan aktiivisen
   sivukielen mukaan ennen rotaatiota, jottei esim. englanninkielisellä
   sivulla näytetä suomenkielistä bannerikuvaa.

   Käyttö:  <AdRotator />                    (oletusväli 6 s)
            <AdRotator intervalMs={8000} />  (oma väli)
======================================================================= */

export default function AdRotator({ intervalMs = 6000 }) {
  // Eri komponenteissa on käytetty sekä "lang" että "currentLanguage"
  // -nimeä hookin palautusarvolle — tuetaan molempia, fallback "fi".
  const { lang, currentLanguage } = useTranslation();
  const activeLang = lang || currentLanguage || "fi";

  const visibleAds = useMemo(
    () => adRotator.filter((ad) => ad.lang === "all" || ad.lang === activeLang),
    [activeLang]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef(null);

  // Jos kieli vaihtuu ja suodatettu lista lyhenee, varmistetaan ettei
  // activeIndex jää osoittamaan listan ulkopuolelle.
  useEffect(() => {
    setActiveIndex(0);
  }, [activeLang]);

  useEffect(() => {
    if (visibleAds.length <= 1) return; // ei mitään kierrätettävää
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % visibleAds.length);
    }, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [intervalMs, visibleAds.length]);

  if (!visibleAds.length) return null;

  return (
    <div className="ad-rotator-top-spacer">
      <div id="mainos-kontti">
        {visibleAds.map((ad, i) => (
          <div
            key={i}
            className={"mainos-elementti" + (i === activeIndex ? " aktiivinen" : "")}
            // HUOM: sisältö tulee omasta data/adRotator.js-listastasi (ei
            // käyttäjän syötettä) — sama malli kuin vanhassa versiossa,
            // jossa affiliate-koodit injektoitiin innerHTML:llä.
            dangerouslySetInnerHTML={{ __html: ad.html }}
          />
        ))}
      </div>
    </div>
  );
}