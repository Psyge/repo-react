import { useEffect, useRef } from "react";

/* ============================================================
 * usePolling — taustapäivitys joka kunnioittaa välilehden tilaa
 * ============================================================
 * ONGELMA: setInterval jatkaa pyörimistä niin kauan kuin välilehti on
 * auki, myös taustalla. Hyvänä revontuliyönä ihmiset jättävät sivun
 * auki tunneiksi ja vilkaisevat sitä välillä — yksi käyttäjä ehti
 * tehdä noin sata pyyntöä istunnossa, ja Cloudflaren päiväkiintiö
 * paukkui juuri aktiivisimpina öinä.
 *
 * RATKAISU:
 *   1. Kun välilehti ei ole näkyvissä, ei haeta mitään. Kukaan ei
 *      katso sivua, joten data ei ehdi vanhentua kenenkään silmissä.
 *   2. Kun välilehti palaa näkyviin, haetaan heti JOS edellisestä
 *      hausta on kulunut vähintään intervalin verran. Käyttäjälle
 *      tämä näyttää samalta kuin jatkuva päivitys — data on tuoretta
 *      silloin kun sitä katsotaan.
 *
 * Näin pyyntöjen määrä seuraa katseluaikaa eikä välilehden ikää.
 *
 * KÄYTTÖ:
 *   usePolling(loadData, 30 * 60 * 1000, [lat, lon]);
 *
 * Kutsuu callbackin heti kerran ja sen jälkeen välein. Riippuvuudet
 * toimivat kuten useEffectissä: niiden muuttuessa haku tehdään heti
 * uudelleen.
 * ============================================================ */
export default function usePolling(callback, intervalMs, deps = []) {
  /* Callback refiin, jotta ajastinta ei tarvitse rakentaa uudelleen
     joka renderillä vaikka funktio olisi uusi instanssi. */
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const lastRunRef = useRef(0);

  useEffect(() => {
    let timer = null;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      lastRunRef.current = Date.now();
      savedCallback.current();
    };

    /* Ajastin käy vain kun välilehti on näkyvissä. Taustalla se
       pysäytetään kokonaan sen sijaan että kutsu ohitettaisiin —
       näin selain saa nukkua eikä turhia herätyksiä tule. */
    const start = () => {
      if (timer != null) return;
      timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer == null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        /* Haetaan heti vain jos data ehti vanhentua piilossa ollessa.
           Ilman tätä välilehden vaihtelu edestakaisin aiheuttaisi
           pyynnön joka kerta. */
        if (Date.now() - lastRunRef.current >= intervalMs) run();
        start();
      } else {
        stop();
      }
    };

    // Ensimmäinen haku heti, myös jos välilehti sattuu olemaan piilossa:
    // komponentti tarvitsee dataa voidakseen renderöidä jotain.
    run();

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}