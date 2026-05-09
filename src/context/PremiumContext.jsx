import { createContext, useContext, useEffect, useState } from "react";
import { isActive, read, refresh } from "../lib/premium";

const PremiumContext = createContext();

export function PremiumProvider({ children }) {
  const [premium, setPremium] = useState({
    active: false,
    data: null,
    loading: true,
  });

  async function loadPremium() {
    const active = isActive();
    const data = read();

    setPremium({
      active,
      data,
      loading: false,
    });

    // sync backendiin
    if (active) {
      try {
        const result = await refresh();

        setPremium({
          active: result.active,
          data: result.active
            ? {
                ...data,
                expiresAt: result.expiresAt,
                tier: result.tier,
              }
            : null,
          loading: false,
        });
      } catch (e) {
        console.warn(e);
      }
    }
  }

  useEffect(() => {
    loadPremium();

    // kuuntelee localStorage muutoksia
    function onStorage() {
      loadPremium();
    }

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <PremiumContext.Provider
      value={{
        premium,
        refreshPremium: loadPremium,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  return useContext(PremiumContext);
}