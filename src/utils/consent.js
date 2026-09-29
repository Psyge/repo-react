import { useEffect, useState } from "react";

/* ========================================================================
   Evästesuostumus — yksi totuuden lähde.

   CookieBanner kirjoittaa valinnan, muut komponentit (esim. AdRotator)
   lukevat sen. Muutoksesta lähtee "cookie-consent-change"-tapahtuma, jotta
   jo näkyvissä olevat komponentit päivittyvät ilman sivun latausta.

   Arvot: "accepted" | "declined" | null (ei vielä valittu)
======================================================================= */

const KEY = "cookie-consent";
const CHANGE_EVENT = "cookie-consent-change";
const OPEN_EVENT = "cookie-settings-open";

export function getConsent() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

function updateGtag(granted) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const state = granted ? "granted" : "denied";
  window.gtag("consent", "update", {
    analytics_storage: state,
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
  });
}

export function setConsent(value) {
  try { localStorage.setItem(KEY, value); } catch { /* muistissa riittää */ }
  updateGtag(value === "accepted");
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/* Palauttaa aiemmin tallennetun suostumuksen gtagille sivun latautuessa. */
export function applyStoredConsent() {
  if (getConsent() === "accepted") updateGtag(true);
}

/* Avaa evästebannerin uudelleen (esim. footerin "Evästeasetukset"-linkki).
   GDPR edellyttää, että suostumuksen voi perua yhtä helposti kuin antaa. */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onCookieSettingsOpen(handler) {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}

export function useConsent() {
  const [consent, setState] = useState(null);
  useEffect(() => {
    const sync = () => setState(getConsent());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);
  return consent;
}
