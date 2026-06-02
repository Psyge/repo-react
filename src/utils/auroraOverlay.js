import L from "leaflet";

const SOURCE =
  "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";

const AURORA_CACHE_KEY = "aurora_session_cache:ovation:v1";
const AURORA_TTL_MS = 60 * 60 * 1000; // 1h

let latestData = null;
let sprites = { r: 0, green: null, yellow: null, red: null };

function readSessionCache(key, ttlMs) {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const cached = JSON.parse(raw);

    if (!cached || typeof cached.savedAt !== "number") {
      return null;
    }

    if (ttlMs && Date.now() - cached.savedAt > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }

    return cached.data ?? null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function writeSessionCache(key, data) {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      })
    );
  } catch {
    // Älä kaada sovellusta, jos sessionStorage ei ole käytössä tai se on täynnä.
  }
}

// 🔥 sprite builder
function buildSprites(radius) {
  if (radius === sprites.r) return;

  sprites.r = radius;

  const make = (rgb) => {
    const s = document.createElement("canvas");
    s.width = s.height = radius * 4;

    const c = s.getContext("2d");
    const cx = s.width / 2;

    const g = c.createRadialGradient(cx, cx, 0, cx, cx, radius);
    g.addColorStop(0, `rgba(${rgb}, 0.9)`);
    g.addColorStop(0.4, `rgba(${rgb}, 0.22)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);

    c.fillStyle = g;
    c.fillRect(0, 0, s.width, s.height);

    return s;
  };

  sprites.green = make("60, 255, 170");
  sprites.yellow = make("200, 255, 0");
  sprites.red = make("255, 60, 130");
}

function pickSprite(intensity) {
  if (intensity > 70) return sprites.red;
  if (intensity > 35) return sprites.yellow;
  return sprites.green;
}

// 🔥 LAYER
function createLayer() {
  const Layer = L.Layer.extend({
    onAdd(map) {
      this._map = map;

      this._container = L.DomUtil.create(
        "div",
        "leaflet-aurora-layer"
      );

      this._canvas = L.DomUtil.create(
        "canvas",
        "aurora-canvas",
        this._container
      );

      this._canvas.style.pointerEvents = "none";
      this._canvas.style.transform = "translateZ(0)";
      this._canvas.style.willChange = "transform";

      map.getPanes().overlayPane.appendChild(this._container);

      this._ctx = this._canvas.getContext("2d");

      // Kevyempi kuin "move zoom moveend zoomend resize".
      // Ei resetoi jatkuvasti karttaa raahatessa/zoomatessa.
      map.on("moveend zoomend resize", this._reset, this);

      this._reset();
      this._startAnim();
    },

    onRemove(map) {
      cancelAnimationFrame(this._raf);
      map.off("moveend zoomend resize", this._reset, this);

      if (this._container) {
        L.DomUtil.remove(this._container);
      }
    },

    setData(data) {
      latestData = data;
      this._draw();
    },

    _reset() {
      if (!this._canvas || !this._map) return;

      const size = this._map.getSize();
      const tl = this._map.containerPointToLayerPoint([0, 0]);

      L.DomUtil.setPosition(this._canvas, tl);

      this._canvas.width = size.x;
      this._canvas.height = size.y;

      const z = this._map.getZoom();
      const blur = z > 8 ? 22 : Math.max(12, z * 3.2);

      this._canvas.style.filter = `blur(${blur}px)`;

      this._draw();
    },

    _startAnim() {
      // 10 FPS riittää kevyeksi "eläväksi" efektiksi.
      // Tämä ei vaikuta datan päivitystiheyteen.
      const fps = 10;
      const interval = 1000 / fps;
      let last = 0;

      const loop = (now) => {
        if (now - last > interval) {
          this._draw();
          last = now;
        }

        this._raf = requestAnimationFrame(loop);
      };

      this._raf = requestAnimationFrame(loop);
    },

    _draw() {
      const ctx = this._ctx;
      const cv = this._canvas;

      if (
        !ctx ||
        !cv ||
        cv.width === 0 ||
        cv.height === 0
      ) {
        return;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);

      if (!latestData || !Array.isArray(latestData.coordinates)) {
        return;
      }

      const map = this._map;
      const zoom = map.getZoom();
      const t = Date.now() * 0.001;

      const latShift = 1.4;

      let radius = zoom * 10;
      if (zoom > 7) radius = zoom * 50;
      if (zoom > 10) radius = zoom * 100;

      buildSprites(Math.round(radius));

      ctx.globalCompositeOperation = "screen";

      const bounds = map.getBounds().pad(0.4);

      latestData.coordinates.forEach((p, i) => {
        const lat = p[1];
        const intensity = p[2];

        if (lat < 45 || intensity < 4) return;

        let lon = p[0];
        if (lon > 180) lon -= 360;

        const oLat = Math.sin(t + i) * 0.18;
        const oLon = Math.cos(t * 0.8 + i) * 0.18;

        const ll = L.latLng(lat + oLat + latShift, lon + oLon);

        if (!bounds.contains(ll)) return;

        const pos = map.latLngToContainerPoint(ll);
        const sprite = pickSprite(intensity);

        if (
          !sprite ||
          sprite.width === 0 ||
          sprite.height === 0
        ) {
          return;
        }

        const baseAlpha = zoom > 8 ? 0.6 : 0.45;

        ctx.globalAlpha = Math.min(baseAlpha, intensity / 100);

        ctx.drawImage(
          sprite,
          pos.x - sprite.width / 2,
          pos.y - sprite.height / 2
        );

        if (zoom > 8) {
          ctx.globalAlpha *= 0.4;

          const pulse = Math.sin(t * 2 + i) * 0.1 + 1;

          ctx.drawImage(
            sprite,
            pos.x - (sprite.width * 1.8 * pulse) / 2,
            pos.y - (sprite.height * 1.8 * pulse) / 2,
            sprite.width * 1.8 * pulse,
            sprite.height * 1.8 * pulse
          );
        }
      });

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
  });

  return new Layer();
}

// 🔥 FETCH
export async function fetchAuroraData({ force = false } = {}) {
  if (!force) {
    const cached = readSessionCache(AURORA_CACHE_KEY, AURORA_TTL_MS);

    if (cached) {
      latestData = cached;
      return cached;
    }
  }

  if (force && typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(AURORA_CACHE_KEY);
    } catch {
      // ignore
    }
  }

  const res = await fetch(SOURCE, {
    cache: "default",
  });

  if (!res.ok) {
    throw new Error("Aurora fetch failed");
  }

  const data = await res.json();

  latestData = data;
  writeSessionCache(AURORA_CACHE_KEY, data);

  return data;
}

// 🔥 CREATE
export function createAuroraOverlay() {
  return createLayer();
}

export function getAuroraIntensity(lat, lon) {
  if (!latestData || !Array.isArray(latestData.coordinates)) return 0;

  let best = 0;
  let minD = Infinity;

  const targetLon = lon < 0 ? lon + 360 : lon;

  for (const p of latestData.coordinates) {
    const pLon = p[0];
    const pLat = p[1];

    const d = Math.hypot(
      pLat - lat,
      Math.abs(pLon - targetLon)
    );

    if (d < minD) {
      minD = d;
      best = p[2];

      if (d < 0.5) break; // nopeutus
    }
  }

  return best || 0;
}