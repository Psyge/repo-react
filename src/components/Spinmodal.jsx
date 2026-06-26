import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import useTranslation from "../hooks/useTranslation";

const BASE =
  import.meta.env.VITE_API_BASE ||
  "https://report.masto84.workers.dev";

// Pyörän sektorit (8 kpl). 'no_win' toistuu, jotta "Try again" tuntuu yleiseltä.
const SECTORS = [
  { id: "1d",     labelKey: "spin.days.1d", labelDef: "1 Day",     color: "#00ffcc", textColor: "#0b0d12" },
  { id: "no_win", labelKey: "spin.tryShort", labelDef: "Try again", color: "#1a2035", textColor: "#6a7a8a" },
  { id: "3d",     labelKey: "spin.days.3d", labelDef: "3 Days",    color: "#7b5fff", textColor: "#fff"    },
  { id: "no_win", labelKey: "spin.tryShort", labelDef: "Try again", color: "#1a2035", textColor: "#6a7a8a" },
  { id: "1d",     labelKey: "spin.days.1d", labelDef: "1 Day",     color: "#00ffcc", textColor: "#0b0d12" },
  { id: "no_win", labelKey: "spin.tryShort", labelDef: "Try again", color: "#1a2035", textColor: "#6a7a8a" },
  { id: "7d",     labelKey: "spin.days.7d", labelDef: "7 Days",    color: "#ff3b7f", textColor: "#fff"    },
  { id: "no_win", labelKey: "spin.tryShort", labelDef: "Try again", color: "#1a2035", textColor: "#6a7a8a" },
];

const SECTOR_COUNT = SECTORS.length;
const SECTOR_DEG   = 360 / SECTOR_COUNT;

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

export default function SpinModal({
  spinId,
  prize,
  results,        // ['no_win','no_win', <id>] backendiltä
  alreadySpun,
  spinLoading,
  onSpin,
  onClose,
}) {
  const { t } = useTranslation();

  // tr: käännös avaimella, fallback englantiin jos avain puuttuu, + {muuttuja}-täyttö
  const tr = useCallback((key, fallback, vars) => {
    let s = t(key);
    if (s == null || s === key) s = fallback;
    if (vars) for (const k of Object.keys(vars)) s = String(s).replace(`{${k}}`, vars[k]);
    return s;
  }, [t]);

  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const rotRef    = useRef(0);
  const spinningRef = useRef(false);
  const startedRef  = useRef(false);

  const totalRounds = Array.isArray(results) ? results.length : 3;

  const [phase, setPhase]       = useState("intro"); // intro | spinning | between | win | lose | done
  const [round, setRound]       = useState(-1);
  const [rotation, setRotation] = useState(0);
  const [email, setEmail]       = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState("");

  const drawWheel = useCallback((canvas, rot) => {
    const ctx  = canvas.getContext("2d");
    const size = canvas.width;
    const cx = size / 2, cy = size / 2, r = size / 2 - 4;
    ctx.clearRect(0, 0, size, size);

    SECTORS.forEach((sector, i) => {
      const startAngle = ((i * SECTOR_DEG - 90 + rot) * Math.PI) / 180;
      const endAngle   = (((i + 1) * SECTOR_DEG - 90 + rot) * Math.PI) / 180;
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
      ctx.fillText(tr(sector.labelKey, sector.labelDef), r * 0.88, size * 0.018);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = "#0b0d12";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [tr]);

  useEffect(() => {
    const c = canvasRef.current;
    if (c) drawWheel(c, rotation);
  }, [rotation, phase, drawWheel]);

  const animateRound = useCallback((idx) => {
    if (!Array.isArray(results) || idx >= results.length) return;
    if (spinningRef.current) return;
    spinningRef.current = true;
    setPhase("spinning");

    const targetId  = results[idx];
    // Arvo satunnainen osuva sektori (esim. 4× no_win) → pysähtyy eri kohtaan joka kerta
    const matching  = SECTORS.map((s, i) => (s.id === targetId ? i : -1)).filter((i) => i >= 0);
    const sectorIdx = matching.length
      ? matching[Math.floor(Math.random() * matching.length)]
      : 0;
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

    if (prefersReducedMotion()) { finish(); return; }

    const duration = 3200;
    const easeOut = (x) => 1 - Math.pow(1 - x, 4);
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

  useEffect(() => {
    if (spinId && Array.isArray(results) && results.length && !startedRef.current) {
      startedRef.current = true;
      animateRound(0);
    }
  }, [spinId, results, animateRound]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const prizeLabel = prize ? tr(`spin.days.${prize.id}`, prize.label) : "";

  const handleClaim = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClaimErr(tr("spin.emailInvalid", "Please enter a valid email address."));
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
        setClaimErr(data.message || data.error || tr("spin.errGeneric", "Something went wrong."));
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
            if (typeof document !== "undefined") document.body.classList.add("is-premium");
          }
        } catch {
          // laiteaktivointi epäonnistui — sähköpostilinkki toimii silti
        }
      }

      setPhase("done");
    } catch {
      setClaimErr(tr("spin.errNetwork", "Network error. Please try again."));
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

  // Renderöi portaalilla suoraan bodyyn → pakenee transform/filter-ankkurin,
  // jolloin peite kattaa koko ruudun ja modal keskittyy oikein.
  return createPortal(
    <div className="spin-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="spin-modal">
        <button className="spin-close" onClick={onClose}>✕</button>

        {/* INTRO */}
        {phase === "intro" && !alreadySpun && (
          <>
            <div className="spin-title">{tr("spin.reported", "🌌 You reported a sighting!")}</div>
            <div className="spin-sub">
              {tr("spin.intro", "Spin {n}× for a chance to win free Premium.", { n: totalRounds })}
            </div>
            <Wheel />
            <div className="spin-prizes-info"><span>{tr("spin.prizes", "1 day · 3 days · 7 days")}</span></div>
            <button className="spin-btn" onClick={onSpin} disabled={spinLoading}>
              {spinLoading ? tr("spin.preparing", "Getting ready…") : tr("spin.spinBtn", "🎰 Spin the wheel!")}
            </button>
            <button className="spin-skip" onClick={onClose}>{tr("spin.noThanks", "No thanks")}</button>
          </>
        )}

        {/* JO PELATTU TÄNÄÄN */}
        {alreadySpun && (
          <>
            <div className="spin-title">{tr("spin.alreadyTitle", "Already spun today")}</div>
            <div className="spin-sub">
              {tr("spin.alreadySub", "You can spin once per day. Come back after reporting tomorrow!")}
            </div>
            <button className="spin-btn" onClick={onClose}>{tr("common.ok", "OK")}</button>
          </>
        )}

        {/* PYÖRII */}
        {phase === "spinning" && (
          <>
            <div className="spin-title">{tr("spin.spinning", "Spinning…")}</div>
            <Wheel />
            <div className="spin-prizes-info">
              <span>{tr("spin.spinOf", "Spin {n} of {total}", { n: round + 2, total: totalRounds })}</span>
            </div>
          </>
        )}

        {/* KIERROSTEN VÄLISSÄ */}
        {phase === "between" && (
          <>
            <div className="spin-title">{tr("spin.tryAgain", "Try again!")}</div>
            <div className="spin-sub">
              {spinsLeft === 1
                ? tr("spin.spinsLeftOne", "1 spin left.")
                : tr("spin.spinsLeft", "{n} spins left.", { n: spinsLeft })}
            </div>
            <Wheel />
            <button className="spin-btn" onClick={() => animateRound(round + 1)} disabled={spinningRef.current}>
              {tr("spin.spinAgain", "🎰 Spin again")}
            </button>
          </>
        )}

        {/* VOITTO */}
        {phase === "win" && prize && (
          <>
            <div className="spin-title">{tr("spin.wonTitle", "🎉 You won!")}</div>
            <Wheel />
            <div className="spin-prize-label">
              {tr("spin.wonPrize", "{label} of Aurora Premium", { label: prizeLabel })}
            </div>
            <div className="spin-sub">
              {tr("spin.wonSub", "It activates instantly on this device. Add your email so you can re-open it later if needed.")}
            </div>
            <input
              type="email"
              className="spin-email-input"
              placeholder={tr("spin.emailPlaceholder", "your@email.com")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleClaim()}
            />
            {claimErr && <div className="spin-error">{claimErr}</div>}
            <button className="spin-btn" onClick={handleClaim} disabled={claiming}>
              {claiming ? tr("spin.activating", "Activating…") : tr("spin.activateBtn", "Activate & email me the link")}
            </button>
          </>
        )}

        {/* HÄVIÖ */}
        {phase === "lose" && (
          <>
            <div className="spin-title">{tr("spin.loseTitle", "Not this time!")}</div>
            <Wheel />
            <div className="spin-sub">
              {tr("spin.loseSub", "Better luck next time. Report another sighting tomorrow to try again!")}
            </div>
            <button className="spin-btn" onClick={onClose}>{tr("common.ok", "OK")}</button>
          </>
        )}

        {/* VALMIS */}
        {phase === "done" && (
          <>
            <div className="spin-title">{tr("spin.doneTitle", "✅ Premium activated!")}</div>
            <div className="spin-sub">
              {tr(
                "spin.doneSub",
                "Your {label} of Premium is now active on this device. We also emailed an activation link to {email} as a backup.",
                { label: prizeLabel, email }
              )}
            </div>
            <button className="spin-btn" onClick={() => { window.location.assign("/"); }}>
              {tr("spin.startExploring", "Start exploring")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}