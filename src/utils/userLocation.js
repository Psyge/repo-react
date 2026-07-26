/* ========================================================================
   userLocation — jaettu sijainti ilman toista lupakyselyä.

   AuroraHero pyytää sijainnin jo kerran (geoRequestedRef-vartija) valitakseen
   lähimmän paikan. Se kirjoittaa tuloksen tänne, ja muut komponentit lukevat
   sen sessionStoragesta. Näin esim. LiveCamSpotlight saa käyttäjän sijainnin
   pyytämättä lupaa uudelleen.

   sessionStorage eikä localStorage: sijainti ei säily istunnon yli.
======================================================================= */

const KEY = "aurora_user_loc:v1";

export function saveUserLocation(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ lat, lon, ts: Date.now() }));
  } catch { /* storage full / privaattitila */ }
}

export function readUserLocation() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!Number.isFinite(o?.lat) || !Number.isFinite(o?.lon)) return null;
    return { lat: o.lat, lon: o.lon };
  } catch {
    return null;
  }
}