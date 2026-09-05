import { useEffect } from "react";

const LEVELS = {
  low:      { label: "Low",       color: "#94a3b8" },
  medium:   { label: "Medium",    color: "#facc15" },
  high:     { label: "High",      color: "#22c55e" },
  veryhigh: { label: "Very high", color: "#e879f9" },
};

export default function AuroraPopup({ lat, lng, status, data, onRender }) {
  /* Leaflet mitoittaa popupin sen sisällön mukaan, mutta openOn ajetaan
     ennen kuin React on renderöinyt mitään. Ilman tätä popup jää
     ensimmäisen (tyhjän) sisällön kokoiseksi ja teksti valuu yli.
     Efekti ajetaan joka renderin jälkeen — juuri silloin kun uusi
     sisältö on DOM:ssa ja mitat ovat oikeat. */
  useEffect(() => {
    onRender?.();
  });

  return (
    <div className="aurora-popup">
      <div className="ap-coords">
        {lat.toFixed(2)}, {lng.toFixed(2)}
      </div>

      {status === "loading" && <PopupSkeleton />}
      {status === "error" && (
        <div className="ap-error">Tietoja ei saatu haettua</div>
      )}
      {status === "ok" && <PopupResult data={data} />}
    </div>
  );
}

function PopupSkeleton() {
  return (
    <div className="ap-skeleton" aria-label="Ladataan">
      <span className="ap-sk-line ap-sk-lg" />
      <span className="ap-sk-line ap-sk-sm" />
    </div>
  );
}

function PopupResult({ data }) {
  const level = LEVELS[data?.level] || LEVELS.low;

  /* probability on workerissa premium-kenttä, ei puuttuva arvo.
     Vanha versio luki sen `data?.probability ?? 0` ja näytti lukitun
     kentän mitattuna nollana: käyttäjä luki punaisen "0 % chance" ja
     jäi sisälle vaikka taivaalla roihuaisi. Lukittu tieto näytetään
     lukkona, ei nollana. */
  const hasProbability =
    data?.tier === "premium" && typeof data.probability === "number";

  return (
    <>
      <div className="ap-level" style={{ color: level.color }}>
        <span className="ap-level-label">{level.label}</span>
        {hasProbability ? (
          <span className="ap-prob">{Math.round(data.probability)} %</span>
        ) : (
          <span
            className="ap-prob ap-locked"
            title="Tarkka todennäköisyys kuuluu Premiumiin"
          >
            🔒
          </span>
        )}
      </div>

      <dl className="ap-facts">
        {data?.clouds != null && (
          <>
            <dt>Pilvisyys</dt>
            <dd>
              {Math.round(data.clouds)} %
              {data.cloudSource === "fmi" && (
                <span className="ap-src">FMI</span>
              )}
            </dd>
          </>
        )}
        {data?.kp != null && (
          <>
            <dt>Kp</dt>
            <dd>{Number(data.kp).toFixed(1)}</dd>
          </>
        )}
      </dl>

      {data?.measured && (
        <div className="ap-badge">Mitattu magnetometrilla</div>
      )}

      {/* Worker laskee chaseAvailablen erikseen juuri tähän hetkeen:
          käyttäjä on pilven alla ja muualla olisi selkeää. */}
      {data?.chaseAvailable && (
        <div className="ap-chase">Selkeämpää taivasta lähellä 🔒</div>
      )}
    </>
  );
}
