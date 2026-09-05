import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createRoot } from "react-dom/client";
import AuroraPopup from "./components/AuroraPopup";
import KpMeter from "./components/KpMeter";

const BASE = "https://report.masto84.workers.dev";

const START_CENTER = [67.5, 26];
const START_ZOOM = 5;

/* Worker päivittää välimuistinsa cronilla 10 min välein, joten tätä
   tiheämpi kysely ei tuota uutta tietoa — pelkkää kuormaa. Vanha
   60 s intervalli haki lisäksi päätepistettä jota ei ole olemassa. */
const HEADER_REFRESH_MS = 5 * 60 * 1000;

/* Ainoa datalähde. /api/solar ei ole koskaan ollut olemassa workerin
   reitityksessä: se palautti 404:n, jonka virherunko meni läpi
   "onnistuneena" datana ja näkyi käyttäjälle Kp-arvona 0. Siksi
   res.ok tarkistetaan täällä eikä kutsupaikoissa. */
async function fetchCalc(lat, lon, signal) {
  const res = await fetch(`${BASE}/api/aurora/calc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
    signal,
  });
  if (!res.ok) throw new Error(`calc ${res.status}`);
  return res.json();
}

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  /* Yksi React-root koko popupille, ei yhtä per klikkaus. Leaflet
     tuhoaa popupin DOM:n sulkiessaan, joten per-klikkaus luodut rootit
     jäivät elämään irrotettuihin solmuihin — 50 klikkausta, 50 rootia. */
  const popupRootRef = useRef(null);
  const popupReqRef = useRef(0);
  const popupAbortRef = useRef(null);
  const headerAbortRef = useRef(null);

  const [header, setHeader] = useState({ status: "loading", data: null });

  const refreshHeader = useCallback(async () => {
    const map = mapInstance.current;
    if (!map || document.visibilityState === "hidden") return;

    headerAbortRef.current?.abort();
    const ac = new AbortController();
    headerAbortRef.current = ac;

    const { lat, lng } = map.getCenter();
    try {
      const data = await fetchCalc(lat, lng, ac.signal);
      setHeader({ status: "ok", data });
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error(err);
      setHeader({ status: "error", data: null });
    }
  }, []);

  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: START_CENTER,
      zoom: START_ZOOM,
      zoomControl: true,
    });
    mapInstance.current = map;

    /* Attribuutio ei ole valinnainen: CARTOn ja OSM:n käyttöehdot
       vaativat sen. maxZoom estää tyhjät ruudut — laattoja ei ole
       tasoa 20 pidemmälle. */
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
        'contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    const getPopupRoot = () => {
      if (!popupRootRef.current) {
        const container = document.createElement("div");
        popupRootRef.current = { container, root: createRoot(container) };
      }
      return popupRootRef.current;
    };

    const onMapClick = async (e) => {
      const { lat, lng } = e.latlng;

      /* Peruutus ennen popupin avausta, ei popupclose-tapahtumassa:
         uuden popupin avaaminen sulkee vanhan, joten popupcloseen
         kytketty peruutus ampuisi juuri aloitetun haun alas. */
      popupAbortRef.current?.abort();
      const ac = new AbortController();
      popupAbortRef.current = ac;
      const reqId = ++popupReqRef.current;

      const { container, root } = getPopupRoot();
      const popup = L.popup({ minWidth: 190, maxWidth: 260 })
        .setLatLng(e.latlng)
        .setContent(container)
        .openOn(map);

      const draw = (state) => {
        /* Nopeasti peräkkäiset klikkaukset: vanhentunut vastaus ei saa
           kirjoittaa uuden popupin päälle. */
        if (reqId !== popupReqRef.current) return;
        root.render(
          <AuroraPopup
            lat={lat}
            lng={lng}
            onRender={() => popup.update()}
            {...state}
          />
        );
      };

      draw({ status: "loading" });

      try {
        const data = await fetchCalc(lat, lng, ac.signal);
        draw({ status: "ok", data });
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        draw({ status: "error" });
      }
    };

    map.on("click", onMapClick);

    refreshHeader();
    const interval = setInterval(refreshHeader, HEADER_REFRESH_MS);

    /* Piilotettu välilehti ei tarvitse päivityksiä, mutta esiin
       palatessa näkyvä luku voi olla vanha — haetaan heti. */
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshHeader();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      popupAbortRef.current?.abort();
      headerAbortRef.current?.abort();

      /* Root puretaan ennen kartan poistoa. queueMicrotask siksi, että
         synkroninen unmount kesken Reactin oman renderöinnin on virhe. */
      const pending = popupRootRef.current;
      popupRootRef.current = null;
      if (pending) queueMicrotask(() => pending.root.unmount());

      map.off("click", onMapClick);
      map.remove();
      mapInstance.current = null;
    };
  }, [refreshHeader]);

  const d = header.data;

  return (
    <div className="app">
      <div className="map-wrap">
        <div ref={mapRef} className="map" />

        <div className="hud">
          <h1 className="hud-title">Live Aurora Map</h1>

          {header.status === "error" ? (
            <p className="hud-error">Tietoja ei saatu haettua</p>
          ) : (
            <>
              <KpMeter kp={d?.kp ?? null} loading={header.status === "loading"} />
              <p className="hud-meta">
                {d?.clouds != null
                  ? `Pilvisyys ${Math.round(d.clouds)} %`
                  : "Pilvisyys –"}
                {d?.measured && <span className="hud-badge">mitattu</span>}
              </p>
            </>
          )}

          <p className="hud-hint">Klikkaa karttaa nähdäksesi ennusteen</p>
        </div>
      </div>
    </div>
  );
}
