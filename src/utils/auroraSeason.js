/* ========================================================================
   auroraSeason — onko revontulikausi käynnissä, ja milloin se alkaa.

   Kausi määritellään valon eikä kalenterin mukaan: kausi on käynnissä kun
   aurinko käy vuorokauden aikana alle -6° (siviilihämärän raja). Tämä
   hoitaa sekä vuodenajan että leveysasteen samalla laskennalla — elokuussa
   Kevossa pimenee aiemmin kuin Muoniossa, eikä kuukausilista osaa ilmaista
   sitä. Sama raja kuin all-sky-kameroilla (CAM_DARK_MAX_DEG).

   Ei verkkokutsuja — kaikki lasketaan Globemath.sunAltitudeAt-funktiolla.
======================================================================= */

import { sunAltitudeAt } from "./Globemath";

export const SEASON_DARK_DEG = -6;

/* Vuorokauden pimein hetki asteina. Näytteistys 30 min välein riittää:
   auringon korkeus muuttuu hitaasti minimin ympärillä. */
export function darkestAltitudeOfDay(lat, lon, date = new Date()) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  let min = 90;
  for (let m = 0; m < 24 * 60; m += 30) {
    const alt = sunAltitudeAt(lat, lon, new Date(base.getTime() + m * 60000));
    if (alt < min) min = alt;
  }
  return min;
}

export function isAuroraSeason(lat, lon, date = new Date()) {
  return darkestAltitudeOfDay(lat, lon, date) < SEASON_DARK_DEG;
}

/* Ensimmäinen päivä jolloin kausi alkaa.
   null jos kausi on jo käynnissä tai ei ala 250 vrk sisällä. */
export function seasonStartDate(lat, lon, from = new Date()) {
  if (isAuroraSeason(lat, lon, from)) return null;
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  for (let i = 1; i <= 250; i++) {
    d.setDate(d.getDate() + 1);
    if (isAuroraSeason(lat, lon, d)) return new Date(d);
  }
  return null;
}

/* "14. elokuuta" / "14 August" — kuukauden tarkkuus riittää, koska
   raja on liukuva eikä päivälleen tarkka lupaus ole rehellinen. */
export function formatSeasonStart(date, lang = "fi") {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fi-FI", {
      day: "numeric",
      month: "long",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}