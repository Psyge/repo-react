/* ========================================================================
   fmiCams — Ilmatieteen laitoksen all-sky-kamerat.

   Nämä osoitteet ovat pysyviä eivätkä vaadi ylläpitoa: FMI päivittää saman
   tiedoston uudella kuvalla, joten mitään ei tarvitse lisätä käsin. Kamerat
   EIVÄT kuvaa valoisaan aikaan — LiveCamSpotlight piilottaa paneelin silloin
   automaattisesti auringon korkeuden perusteella.

   Sama kolmikko kuin R-indeksin lähimmät asemat (KEV/KIL/MUO), joten
   kameravalinta ja mittaus osuvat samoihin paikkoihin.

   Lähde: https://rwc-finland.fmi.fi/index.php/all-sky-camera-images/
   HUOM: kuvien lisenssiä ei ole ilmoitettu yhtä selkeästi kuin R-indeksin
   JSON-datan (CC BY 4.0). Varmista käyttöoikeus image_team (at) fmi.fi.
======================================================================= */

const fmiCams = [
  {
    id: "KEV",
    name: "Kevo",
    lat: 69.76,
    lon: 27.01,
    url: "https://space.fmi.fi/MIRACLE/RWC/latest_KEV.jpg",
  },
  {
    id: "KIL",
    name: "Kilpisjärvi",
    lat: 69.05,
    lon: 20.79,
    url: "https://space.fmi.fi/MIRACLE/RWC/latest_KIL.jpg",
  },
  {
    id: "MUO",
    name: "Muonio",
    lat: 68.02,
    lon: 23.53,
    url: "https://space.fmi.fi/MIRACLE/RWC/latest_MUO.jpg",
  },
];

/* Kamerat kuvaavat kun aurinko on tämän alapuolella. */
export const CAM_DARK_MAX_DEG = -6;

/* Kuinka usein kuva haetaan uudelleen (FMI päivittää muutaman minuutin välein) */
export const CAM_REFRESH_MS = 60 * 1000;

export default fmiCams;
