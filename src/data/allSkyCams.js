/* ========================================================================
   allSkyCams — julkiset all-sky-kamerat, joista voidaan tarjota lähin kuva.

   Osoitteet ovat pysyviä eivätkä vaadi ylläpitoa: sama tiedosto päivittyy
   uudella kuvalla. Ei omia kameroita, ei laitteistoa, ei huoltoa.

   enabled-lippu ohjaa käyttöä. Ota kamera käyttöön vasta kun sen ylläpitäjän
   lupa on varmistettu — kuvien lisenssiä ei ole ilmoitettu yhtä selkeästi
   kuin FMI:n R-indeksidatan (CC BY 4.0), ja kaupallinen tuote on eri asia
   kuin harrastesivu.

   Yhteydenotot:
     FMI (KEV/KIL/MUO) ...... image_team (at) fmi.fi
     Sirius ry (NYR/HAN) .... Jyväskylän Sirius ry
     Aalto (HOV) ............ Metsähovin radiotutkimusasema
     SGO (SOD) .............. Sodankylän geofysiikan observatorio

   Lähde: https://rwc-finland.fmi.fi/index.php/all-sky-camera-images/
======================================================================= */

const allSkyCams = [
  /* --- Ilmatieteen laitos: samat asemat kuin R-indeksin lähimmät --- */
  {
    id: "KEV",
    name: "Kevo",
    lat: 69.76,
    lon: 27.01,
    url: "https://space.fmi.fi/MIRACLE/RWC/latest_KEV.jpg",
    operator: "Ilmatieteen laitos",
    enabled: true,
  },
  {
    id: "KIL",
    name: "Kilpisjärvi",
    lat: 69.05,
    lon: 20.79,
    url: "https://space.fmi.fi/MIRACLE/RWC/latest_KIL.jpg",
    operator: "Ilmatieteen laitos",
    enabled: true,
  },
  {
    id: "MUO",
    name: "Muonio",
    lat: 68.02,
    lon: 23.53,
    url: "https://space.fmi.fi/MIRACLE/RWC/latest_MUO.jpg",
    operator: "Ilmatieteen laitos",
    enabled: true,
  },

  /* --- Etelä-Suomi: laajentaisi kattavuuden 60°N asti, mutta eri
         ylläpitäjät → oma lupa kullekin. Kytke päälle vasta luvan jälkeen. --- */
  {
    id: "NYR",
    name: "Nyrölä",
    lat: 62.34,
    lon: 25.51,
    url: "https://space.fmi.fi/MIRACLE/RWC/latest_SIR.jpg",
    operator: "Jyväskylän Sirius ry",
    enabled: false,
  },
  {
    id: "HAN",
    name: "Hankasalmi",
    lat: 62.25,
    lon: 26.60,
    url: "https://space.fmi.fi/MIRACLE/RWC/latest_SIR_AllSky.jpg",
    operator: "Jyväskylän Sirius ry",
    enabled: false,
  },
  {
    id: "HOV",
    name: "Metsähovi",
    lat: 60.22,
    lon: 24.39,
    url: "https://space.fmi.fi/MIRACLE/RWC/latest_HOV.jpg",
    operator: "Aalto-yliopisto",
    enabled: false,
  },
];

/* Kamerat kuvaavat kun aurinko on tämän alapuolella */
export const CAM_DARK_MAX_DEG = -6;

/* Kuinka usein kuva haetaan uudelleen */
export const CAM_REFRESH_MS = 60 * 1000;

/* Tätä kauempaa kameraa ei tarjota — eri taivas, ei kerro käyttäjälle mitään */
export const CAM_MAX_KM = 400;

export default allSkyCams;