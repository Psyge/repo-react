/* Kp 0-9 palkkina. Pelkkä desimaaliluku ei kerro maallikolle mitään —
   palkki näyttää heti missä kohtaa asteikkoa ollaan. */
const SEGMENTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function KpMeter({ kp, loading = false }) {
  const value = typeof kp === "number" ? kp : null;

  return (
    <div
      className={"kp-meter" + (loading ? " is-loading" : "")}
      role="img"
      aria-label={value == null ? "Kp ei saatavilla" : `Kp ${value.toFixed(1)}`}
    >
      <span className="kp-label">Kp</span>

      <span className="kp-bars">
        {SEGMENTS.map((step) => (
          <span
            key={step}
            data-kp={step}
            /* Puolikas segmentti riittää sytyttämään: Kp 4.5 on
               lähempänä viittä kuin neljää. */
            className={"kp-bar" + (value != null && value >= step - 0.5 ? " is-on" : "")}
          />
        ))}
      </span>

      <span className="kp-value">{value == null ? "–" : value.toFixed(1)}</span>
    </div>
  );
}
