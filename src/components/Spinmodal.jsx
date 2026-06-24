import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const BASE =
  import.meta.env.VITE_API_BASE ||
  "https://report.masto84.workers.dev";

// Pyörän sektorit (8 kpl). 'no_win' toistuu, jotta "Try again" tuntuu yleiseltä.
const SECTORS = [
  { id: "1d",     label: "1 Day",     color: "#00ffcc", textColor: "#0b0d12" },
  { id: "no_win", label: "Try again", color: "#1a2035", textColor: "#6a7a8a" },
  { id: "3d",     label: "3 Days",    color: "#7b5fff", textColor: "#fff"    },
  { id: "no_win", label: "Try again", color: "#1a2035", textColor: "#6a7a8a" },
  { id: "1d",     label: "1 Day",     color: "#00ffcc", textColor: "#0b0d12" },
  { id: "no_win", label: "Try again", color: "#1a2035", textColor: "#6a7a8a" },
  { id: "7d",     label: "7 Days",    color: "#ff3b7f", textColor: "#fff"    },
  { id: "no_win", label: "Try again", color: "#1a2035", textColor: "#6a7a8a" },
];

const SECTOR_COUNT = SECTORS.length;
const SECTOR_DEG   = 360 / SECTOR_COUNT;

/* Pysyvä laite-id (sama idea kuin maksavan premiumin aktivoinnissa) */
function getInstallId() {
  try {
    let id = localStorage.getItem("aurora_install_id");
    if (!id || id.length < 16) {
      id = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      localStorage.setItem("aurora_install_id", id);
    }
    return id;
  } catch {
    return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  }
}

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function drawWheel(canvas, rotation) {
  const ctx  = canvas.getContext("2d");
  const size = canvas.width;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  ctx.clearRect(0, 0, size, size);

  SECTORS.forEach((sector, i) => {
    const startAngle = ((i * SECTOR_DEG - 90 + rotation) * Math.PI) / 180;
    const endAngle   = (((i + 1) * SECTOR_DEG - 90 + rotation) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = sector.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((startAngle + endAngle) / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = sector.textColor;
    ctx.font = `bold ${size * 0.048}px Arial`;
    ctx.fillText(sector.label, r * 0.88, size * 0.018);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0d12";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

export default function SpinModal({
  spinId,
  prize,
  results,        // ['no_win','no_win', <id>] backendiltä
  alreadySpun,
  spinLoading,
  onSpin,
  onClose,
}) {
  const navigate  = useNavigate();
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const rotRef    = useRef(0);
  const spinningRef = useRef(false);
  const startedRef  = useRef(false);

  const totalRounds = Array.isArray(results) ? results.length : 3;

  const [phase, setPhase]       = useState("intro"); // intro | spinning | between | win | lose | done
  const [round, setRound]       = useState(-1);      // viimeksi valmistunut kierros
  const [rotation, setRotation] = useState(0);
  const [email, setEmail]       = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState("");

  // Piirrä pyörä aina kun rotaatio muuttuu
  useEffect(() => {
    const c = canvasRef.current;
    if (c) drawWheel(c, rotation);
  }, [rotation, phase]);

  // Animoi yksi kierros annettuun sektoriin
  const animateRound = useCallback((idx) => {
    if (!Array.isArray(results) || idx >= results.length) return;
    if (spinningRef.current) return;
    spinningRef.current = true;
    setPhase("spinning");

    const targetId  = results[idx];
    const sectorIdx = Math.max(0, SECTORS.findIndex((s) => s.id === targetId));
    const restMod   = (((360 - (sectorIdx * SECTOR_DEG + SECTOR_DEG / 2)) % 360) + 360) % 360;

    const startRot = rotRef.current;
    const curMod   = ((startRot % 360) + 360) % 360;
    const delta    = (restMod - curMod + 360) % 360;
    const target   = startRot + 3 * 360 + delta;

    const finish = () => {
      rotRef.current = target;
      setRotation(target);
      spinningRef.current = false;
      setRound(idx);
      if (idx >= results.length - 1) setPhase(prize ? "win" : "lose");
      else setPhase("between");
    };

    // Reduced motion → ohita animaatio
    if (prefersReducedMotion()) { finish(); return; }

    const duration = 3200;
    const easeOut = (t) => 1 - Math.pow(1 - t, 4);
    let start = null;

    const step = (ts) => {
      if (start == null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const cur = startRot + (target - startRot) * easeOut(p);
      rotRef.current = cur;
      setRotation(cur);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else finish();
    };
    rafRef.current = requestAnimationFrame(step);
  }, [results, prize]);

  // Käynnistä 1. kierros kun backend-tulos saapuu
  useEffect(() => {
    if (spinId && Array.isArray(results) && results.length && !startedRef.current) {
      startedRef.current = true;
      animateRound(0);
    }
  }, [spinId, results, animateRound]);

  // Siivoa RAF
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const handleClaim = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClaimErr("Please enter a valid email address.");
      return;
    }
    setClaiming(true);
    setClaimErr("");
    try {
      const res  = await fetch(`${BASE}/api/sightings/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spinId, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimErr(data.message || data.error || "Something went wrong.");
        return;
      }

      // Aktivoi heti tällä laitteella (kuten maksava premium). Email on varakeino.
      if (data.token) {
        try {
          const installId = getInstallId();
          const act = await fetch(
            `${BASE}/api/premium/activate?token=${encodeURIComponent(data.token)}&installId=${encodeURIComponent(installId)}`
          );
          const actData = await act.json();
          if (act.ok && actData.deviceKey) {
            localStorage.setItem("aurora_premium", JSON.stringify({
              deviceKey: actData.deviceKey,
              expiresAt: actData.expiresAt,
              tier: actData.tier,
            }));
          }
        } catch {
          // laiteaktivointi epäonnistui — sähköpostilinkki toimii silti
        }
      }

      setPhase("done");
    } catch {
      setClaimErr("Network error. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  const Wheel = () => (
    <div className="spin-wheel-wrap">
      <div className="spin-pointer">▼</div>
      <canvas ref={canvasRef} width={260} height={260} className="spin-canvas" />
    </div>
  );

  const spinsLeft = totalRounds - (round + 1);

  return (
    <div className="spin-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="spin-modal">
        <button className="spin-close" onClick={onClose}>✕</button>

        {/* INTRO */}
        {phase === "intro" && !alreadySpun && (
          <>
            <div className="spin-title">🌌 You reported a sighting!</div>
            <div className="spin-sub">Spin {totalRounds}× for a chance to win free Premium.</div>
            <Wheel />
            <div className="spin-prizes-info"><span>1 day · 3 days · 7 days</span></div>
            <button className="spin-btn" onClick={onSpin} disabled={spinLoading}>
              {spinLoading ? "Getting ready…" : "🎰 Spin the wheel!"}
            </button>
            <button className="spin-skip" onClick={onClose}>No thanks</button>
          </>
        )}

        {/* JO PELATTU TÄNÄÄN */}
        {alreadySpun && (
          <>
            <div className="spin-title">Already spun today</div>
            <div className="spin-sub">You can spin once per day. Come back after reporting tomorrow!</div>
            <button className="spin-btn" onClick={onClose}>OK</button>
          </>
        )}

        {/* PYÖRII */}
        {phase === "spinning" && (
          <>
            <div className="spin-title">Spinning…</div>
            <Wheel />
            <div className="spin-prizes-info"><span>Spin {round + 2} of {totalRounds}</span></div>
          </>
        )}

        {/* KIERROSTEN VÄLISSÄ — Try again, pyöräytyksiä jäljellä */}
        {phase === "between" && (
          <>
            <div className="spin-title">Try again!</div>
            <div className="spin-sub">
              {spinsLeft === 1 ? "1 spin left." : `${spinsLeft} spins left.`}
            </div>
            <Wheel />
            <button
              className="spin-btn"
              onClick={() => animateRound(round + 1)}
              disabled={spinningRef.current}
            >
              🎰 Spin again
            </button>
          </>
        )}

        {/* VOITTO */}
        {phase === "win" && prize && (
          <>
            <div className="spin-title">🎉 You won!</div>
            <Wheel />
            <div className="spin-prize-label">{prize.label} of Aurora Premium</div>
            <div className="spin-sub">
              It activates instantly on this device. Add your email so you can re-open it later if needed.
            </div>
            <input
              type="email"
              className="spin-email-input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleClaim()}
            />
            {claimErr && <div className="spin-error">{claimErr}</div>}
            <button className="spin-btn" onClick={handleClaim} disabled={claiming}>
              {claiming ? "Activating…" : "Activate & email me the link"}
            </button>
          </>
        )}

        {/* HÄVIÖ */}
        {phase === "lose" && (
          <>
            <div className="spin-title">Not this time!</div>
            <Wheel />
            <div className="spin-sub">Better luck next time. Report another sighting tomorrow to try again!</div>
            <button className="spin-btn" onClick={onClose}>OK</button>
          </>
        )}

        {/* VALMIS */}
        {phase === "done" && (
          <>
            <div className="spin-title">✅ Premium activated!</div>
            <div className="spin-sub">
              Your {prize?.label} of Premium is now active on this device.
              We also emailed an activation link to <strong>{email}</strong> as a backup.
            </div>
            <button className="spin-btn" onClick={() => { onClose(); navigate("/"); }}>
              Start exploring
            </button>
          </>
        )}
      </div>
    </div>
  );
}