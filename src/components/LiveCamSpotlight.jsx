import { useEffect, useMemo, useState } from "react";
import useTranslation from "../hooks/useTranslation";
import { sunAltitudeAt, haversineKm } from "../utils/Globemath";
import { readUserLocation } from "../utils/userLocation";
import allSkyCams, {
  CAM_DARK_MAX_DEG,
  CAM_REFRESH_MS,
  CAM_MAX_KM,
} from "../data/allSkyCams";
import liveCams from "../data/liveCams";

/* ========================================================================
   LiveCamSpotlight — näyttää lähimmän pimeän all-sky-kameran.

   Valintajärjestys:
   1. Jos data/liveCams.js sisältää active:true -striimin → näytetään se.
   2. Muuten kameroista ne joissa on pimeää JUURI NYT, ja niistä lähin
      käyttäjän sijaintiin. Sijainti luetaan sessionStoragesta, jonne
      AuroraHero on sen jo tallentanut — ei toista lupakyselyä.
   3. Ilman sijaintia valitaan pimein asema.
   4. Jos yksikään ei ole pimeä → ei renderöidä mitään.

   Ei omia kameroita eikä laitteistoa: pelkkiä julkisia, pysyviä osoitteita.
======================================================================= */

export default function LiveCamSpotlight() {
  const { currentLanguage, t } = useTranslation();

  const trh = (key, fi, en) => {
    const s = t(key);
    if (s != null && s !== key) return s;
    return currentLanguage === "en" ? en : fi;
  };

  /* Minuutin tikitys: päivittää kuvan, pimeystilanteen ja poimii samalla
     sijainnin heti kun heron asynkroninen lupakysely on ratkennut. */
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), CAM_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  /* Striimi arvotaan kerran mountissa — ei saa vaihtua minuutin välein */
  const pickedStream = useMemo(() => {
    const active = liveCams.filter((c) => c.active && c.videoId);
    if (!active.length) return null;
    return active[Math.floor(Math.random() * active.length)];
  }, []);

  /* Striimikin näytetään vain kun on pimeää. Jos rivillä on lat/lon,
     tarkistetaan sen oma sijainti; muuten riittää että jossain
     kameraverkon asemalla on pimeää (karkea "onko Lapissa yö"). */
  const stream = useMemo(() => {
    if (!pickedStream) return null;
    const now = new Date(tick);
    const dark =
      Number.isFinite(pickedStream.lat) && Number.isFinite(pickedStream.lon)
        ? sunAltitudeAt(pickedStream.lat, pickedStream.lon, now) < CAM_DARK_MAX_DEG
        : allSkyCams.some((c) => sunAltitudeAt(c.lat, c.lon, now) < CAM_DARK_MAX_DEG);
    return dark ? pickedStream : null;
  }, [pickedStream, tick]);

  const [failed, setFailed] = useState(() => new Set());

  const cam = useMemo(() => {
    if (stream) return null;

    const userLoc = readUserLocation();
    const now = new Date(tick);

    const dark = allSkyCams
      .filter((c) => c.enabled && !failed.has(c.id))
      .map((c) => ({ ...c, alt: sunAltitudeAt(c.lat, c.lon, now) }))
      .filter((c) => c.alt < CAM_DARK_MAX_DEG);

    if (!dark.length) return null;

    if (userLoc) {
      const byDistance = dark
        .map((c) => ({ ...c, km: Math.round(haversineKm(userLoc.lat, userLoc.lon, c.lat, c.lon)) }))
        .filter((c) => c.km <= CAM_MAX_KM)
        .sort((a, b) => a.km - b.km);
      if (byDistance.length) return byDistance[0];
      /* Kaikki liian kaukana → näytetään silti pimein, mutta ilman
         etäisyyslupausta (km jätetään pois). */
    }

    return dark.sort((a, b) => a.alt - b.alt)[0];
  }, [stream, tick, failed]);

  if (stream) {
    return (
      <div className="ah-livecam-panel">
        <div className="ah-livecam-head">
          <span className="ah-livecam-dot" />
          <span className="ah-livecam-label">
            {trh("hero.livecam", "Live nyt", "Live now")}
          </span>
          <span className="ah-livecam-name">{stream.name}</span>
        </div>
        <div className="ah-livecam-frame">
          <iframe
            src={`https://www.youtube.com/embed/${stream.videoId}?autoplay=1&mute=1`}
            title={stream.name}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (!cam) return null;

  const src = `${cam.url}?t=${Math.floor(tick / CAM_REFRESH_MS)}`;

  return (
    <div className="ah-livecam-panel">
      <div className="ah-livecam-head">
        <span className="ah-livecam-dot" />
        <span className="ah-livecam-label">
          {trh("hero.livecam", "Live nyt", "Live now")}
        </span>
        <span className="ah-livecam-name">
          {cam.name}
          {cam.km != null && (
            <span className="ah-livecam-dist"> · {cam.km} km</span>
          )}
        </span>
      </div>

      <div className="ah-livecam-frame ah-livecam-frame--img">
        <img
          src={src}
          alt={trh(
            "hero.livecam.alt",
            `All-sky-kamera, ${cam.name}`,
            `All-sky camera, ${cam.name}`
          )}
          loading="lazy"
          onError={() => setFailed((prev) => new Set(prev).add(cam.id))}
        />
      </div>

      <div className="ah-livecam-credit">
        <a
          href="https://rwc-finland.fmi.fi/index.php/all-sky-camera-images/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {trh("hero.livecam.source", "Kuva", "Image")}: {cam.operator}
        </a>
      </div>
    </div>
  );
}