export default function AuroraPopup({ lat, lng, prob }) {
  const color =
    prob > 70 ? "#22c55e" :
    prob > 40 ? "#facc15" :
    "#ef4444";

  return (
    <div className="aurora-popup">
      <div className="ap-coords">
        {lat.toFixed(2)}, {lng.toFixed(2)}
      </div>

      <div className="ap-prob" style={{ color }}>
        {prob}% chance
      </div>
    </div>
  );
}