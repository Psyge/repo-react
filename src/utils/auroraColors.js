/* ========================================================================
   Revontulien väriasteikko — yksi lähde koko sivustolle.

   Aiemmin kartan hehku ja popupin tasoväri kertoivat eri tarinaa:
   kartalla vihreä oli HEIKOIN hehku, popupissa vihreä oli "High" ja
   keltainen "Medium". Nyt molemmat kulkevat samaan suuntaan:

     heikko → vihreä → kelta-lime → pinkki → voimakkain

   Järjestys seuraa oikeita revontulia: tavallinen hehku on vihreää,
   voimakkaissa myrskyissä mukaan tulee keltaista ja punaista/pinkkiä.
======================================================================= */

export const AURORA_RGB = {
  green: "60, 255, 170",
  yellow: "200, 255, 0",
  pink: "255, 60, 130",
};

/* Tasot: workerin level-kenttä (low/medium/high/veryhigh).
   Heksamuodossa, koska popup lisää perään alfan (esim. color + "66").
   Samat sävyt kuin AURORA_RGB yllä. */
export const LEVEL_COLORS = {
  low: "#888888",
  medium: "#3cffaa",
  high: "#c8ff00",
  veryhigh: "#ff3c82",
};

export function levelColor(level) {
  return LEVEL_COLORS[level] || LEVEL_COLORS.low;
}
