import { createContext, useContext, useEffect, useRef, useState } from "react";
import { isActive, read, refresh } from "../lib/premium";

const PremiumContext = createContext();

// Älä kutsu backendiä (/api/premium/status) useammin kuin tämän verran.
const REFRESH_THROTTLE_MS = 30 * 1000;

export function PremiumProvider({ children }) {
  const [premium, setPremium] = useState({
    active: false,
    data: null,
    loading: true,
  });

  const lastRefreshRef = useRef(0);

  /* Näytetään kerran per istunto, ei joka sivulatauksella */
  const [justExpired, setJustExpired] = useState(() => {
    try { return sessionStorage.getItem("aurora_premium_just_expired") === "1"; }
    catch { return false; }
  });

  function dismissExpired() {
    try { sessionStorage.removeItem("aurora_premium_just_expired"); } catch {}
    setJustExpired(false);
  }

  async function loadPremium({ force = false } = {}) {
    const active = isActive();
    const data = read();

    // Paikallinen tila päivittyy aina (halpa, ei verkkoa)
    setPremium({ active, data, loading: false });

    if (!active) return;

    // Backend-synkka vain harvakseltaan → estää KV-rate-limitin (429) ryppäissä
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
    lastRefreshRef.current = now;

    try {
      const result = await refresh();

      /* Premium oli äsken voimassa mutta backend sanoo että se päättyi.
         Merkitään kertaluontoinen lippu, jotta käyttöliittymä voi kertoa
         asian — aiemmin päättyminen oli täysin hiljainen ja maksanut
         asiakas huomasi vain että luvut vähenivät. */
      if (active && !result.active) {
        try { sessionStorage.setItem("aurora_premium_just_expired", "1"); } catch {}
        setJustExpired(true);
      }

      setPremium({
        active: result.active,
        data: result.active
          ? { ...data, expiresAt: result.expiresAt, tier: result.tier }
          : null,
        loading: false,
      });
    } catch (e) {
      console.warn(e);
    }
  }

  useEffect(() => {
    loadPremium({ force: true });

    // Storage-tapahtuma laukeaa muista välilehdistä; reagoi vain premium-avaimeen
    function onStorage(e) {
      if (e && e.key && e.key !== "aurora_premium") return;
      loadPremium();
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <PremiumContext.Provider
      value={{
        premium,
        justExpired,
        dismissExpired,
        // Pakotettu päivitys (esim. aktivoinnin jälkeen) ohittaa throttlen
        refreshPremium: () => loadPremium({ force: true }),
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  return useContext(PremiumContext);
}