import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import PremiumModal from "./PremiumModal";
import { isActive } from "../lib/premium";
/* ========================================================================
   PremiumModalManager — näyttää premium-modaalin millä tahansa sivulla.
   Säännöt:
   - Ei koskaan premium-käyttäjälle
   - Ei koskaan jos käyttäjä on pysyvästi kieltänyt (pm_dismissed_forever)
   - Kerran per sessio (sessionStorage)
   - Uudelleen vasta COOLDOWN_MS:n jälkeen paluukäynnillä (localStorage)
   - Vasta kun 30 s täynnä JA käyttäjä on scrollannut/klikannut
   - Ei ostoflow'ssa eikä laki-/yhteyssivuilla — jos ajastin laukeaa
     siellä, modaali odottaa seuraavaa sopivaa sivua
   Käyttö: mount kerran App.js:ään Routerin sisälle: <PremiumModalManager />
======================================================================= */
const EXCLUDED_PREFIXES = ["/premium", "/contact", "/privacy", "/terms"];
const SESSION_KEY = "pm_shown_session";
const LAST_KEY = "pm_last_shown";
const DISMISSED_KEY = "pm_dismissed_forever";
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // paluukäynnillä aikaisintaan 3 vrk
const DELAY_MS = 30 * 1000;
export default function PremiumModalManager() {
  const [show, setShow] = useState(false);
  const location = useLocation();
  /* Poissuljettujen sivujen tila refiin, jotta ajastin näkee sen tuoreena */
  const excludedRef = useRef(false);
  useEffect(() => {
    excludedRef.current = EXCLUDED_PREFIXES.some((p) =>
      location.pathname.startsWith(p)
    );
  }, [location.pathname]);
  /* Jos laukeaminen osui kiellettyyn sivuun, odotetaan sivunvaihtoa */
  const pendingRef = useRef(false);
  useEffect(() => {
    if (pendingRef.current && !excludedRef.current) {
      pendingRef.current = false;
      openNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const openNow = () => {
    setShow(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(LAST_KEY, String(Date.now()));
    } catch {}
  };
  /* permanent = true kun käyttäjä rastitti "älä näytä uudelleen" -täpän
     modaalissa ennen sulkemista. Tallennetaan pysyvästi eikä kysytä enää. */
  const handleClose = (permanent) => {
    setShow(false);
    if (permanent) {
      try {
        localStorage.setItem(DISMISSED_KEY, "1");
      } catch {}
    }
  };
  useEffect(() => {
    if (isActive()) return; // premium-käyttäjälle ei koskaan
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return; // pysyvästi kielletty
      if (sessionStorage.getItem(SESSION_KEY)) return; // jo näytetty tässä sessiossa
      const last = Number(localStorage.getItem(LAST_KEY) || 0);
      if (Date.now() - last < COOLDOWN_MS) return; // paluu liian pian
    } catch {}
    let interacted = false;
    let armed = false;
    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      cleanup();
      if (excludedRef.current) {
        pendingRef.current = true; // avataan kun poistutaan kielletyltä sivulta
      } else {
        openNow();
      }
    };
    const onInteract = () => {
      interacted = true;
      if (armed) fire();
    };
    const timer = setTimeout(() => {
      armed = true;
      if (interacted) fire();
    }, DELAY_MS);
    window.addEventListener("scroll", onInteract, { passive: true });
    window.addEventListener("pointerdown", onInteract);
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("scroll", onInteract);
      window.removeEventListener("pointerdown", onInteract);
    }
    return cleanup;
  }, []);
  return <PremiumModal open={show} onClose={handleClose} />;
}