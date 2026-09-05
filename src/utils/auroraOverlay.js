import L from "leaflet";

const BASE = process.env.REACT_APP_API_BASE || "";

const SOURCE = `${BASE}/api/aurora/ovation`;

const AURORA_CACHE_KEY = "aurora_session_cache:ovation:v1";
const AURORA_TTL_MS = 60 * 60 * 1000; // 1h

let latestData = null;
let sprites = { green: null, yellow: null, red: null };

/* Hehkun säde asteina. Revontuliovaali on maantieteellinen ilmiö, joten
   sen koon pitää seurata kartan mittakaavaa — pikselisäde lasketaan tästä
   ja nykyisestä zoomista, ei zoomin numerosta suoraan. */
const BLOB_DEG = 1.6;

/* OVATION-ruudukko on 1° × 1°. */
const GRID_DEG = 1;

/* Datan leveysasteet siirretään pohjoisemmaksi piirrettäessä. Sama vakio
   tarvitaan myös näytteenotossa, jotta ruudulta luettu arvo vastaa sitä
   mitä samassa kohdassa näytetään. */
const LAT_SHIFT = 1.4;

/* Sprite on kiinteän kokoinen tekstuuri, jota skaalataan piirtovaiheessa.
   Aiemmin sprite luotiin kokoon radius*4 ja radius oli zoom*100 yli zoomin
   10 — zoomilla 16 se tarkoitti 6400 × 6400 pikselin canvasia, yli 160 Mt
   per sprite ja kolme spriteä. Selain lakkasi varaamasta niitä ja kerros
   jäi tyhjäksi. */
const SPRITE_R = 256;

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

// 🔥 sprite builder — luodaan kerran, koko ei riipu zoomista
function buildSprites() {
  if (sprites.green) return;

  const make = (rgb) => {
    const s = document.createElement("canvas");
    s.width = s.height = SPRITE_R * 2;

    const c = s.getContext("2d");
    const cx = s.width / 2;

    const g = c.createRadialGradient(cx, cx, 0, cx, cx, SPRITE_R);
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
      this._sampleCenter();
      this._draw();
    },

    /* Näkymän keskipisteen intensiteetti lähimmästä ruudukkopisteestä.
       Haku on lineaarinen 65 000 pisteen yli, joten se ei kuulu 10 kertaa
       sekunnissa pyörivään piirtosilmukkaan — arvo muuttuu vasta kun kartta
       liikkuu tai data päivittyy, ja se päivitetään niissä kohdissa. */
    _sampleCenter() {
      if (!this._map || !latestData) {
        this._sample = 0;
        return;
      }
      const c = this._map.getCenter();
      this._sample = getAuroraIntensity(c.lat - LAT_SHIFT, c.lng);
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

      this._sampleCenter();
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

      buildSprites();
      ctx.globalCompositeOperation = "screen";

      // Pikseliä per pituusaste nykyisellä zoomilla.
      const pxPerDeg = (256 * Math.pow(2, zoom)) / 360;

      /* Kun yksi ruudukkoaste vie yli puolet ruudun leveydestä, koko näkymä
         on yhden 1° × 1° solun sisällä eikä yhdenkään pisteen keskus osu
         enää lähellekään ruutua. Vanha rajaus (getBounds().pad(0.4)) pudotti
         silloin kaikki pisteet ja kerros katosi kokonaan — juuri tämä näkyi
         käyttäjälle revontulien häviämisenä lähemmäksi zoomatessa.

         Solun sisällä ei ole mielekästä piirtää erillisiä pisteitä: oikea
         esitys on yksi tasainen hehku, jonka voimakkuus luetaan näkymän
         keskipisteestä. Kustannus on samalla vakio zoomista riippumatta. */
      if (pxPerDeg * GRID_DEG > cv.width / 2) {
        const intensity = this._sample || 0;
        if (intensity < 4) {
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
          return;
        }

        const sprite = pickSprite(intensity);
        if (!sprite) return;

        const r = Math.max(cv.width, cv.height) * 1.4;
        const pulse = 0.9 + Math.sin(t) * 0.1;

        ctx.globalAlpha = Math.min(0.6, intensity / 100) * pulse;
        ctx.drawImage(
          sprite,
          cv.width / 2 - r,
          cv.height / 2 - r,
          r * 2,
          r * 2
        );

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        return;
      }

      /* Hehkun säde pikseleinä. Kasvaa mittakaavan mukana, joten piste
         näkyy yhtä isona alueena riippumatta siitä miten lähelle on
         zoomattu. Sprite on kiinteä tekstuuri, joka venytetään tähän
         kokoon — muistinkulutus ei riipu zoomista. */
      const drawR = Math.max(24, BLOB_DEG * pxPerDeg);

      /* Rajaus padataan hehkun säteellä, ei näkymän suhteellisella osuudella.
         Ruudun ulkopuolella oleva piste hehkuu yhä sisään, jos sen säde
         yltää ruudulle — se on koko syy siihen että kerros pysyy näkyvissä
         kun näkymä kaventuu. */
      const b = map.getBounds();
      const pad = BLOB_DEG + 0.5;
      const bounds = L.latLngBounds(
        [b.getSouth() - pad, b.getWest() - pad],
        [b.getNorth() + pad, b.getEast() + pad]
      );

      latestData.coordinates.forEach((p, i) => {
        const lat = p[1];
        const intensity = p[2];

        if (lat < 45 || intensity < 4) return;

        let lon = p[0];
        if (lon > 180) lon -= 360;

        const oLat = Math.sin(t + i) * 0.18;
        const oLon = Math.cos(t * 0.8 + i) * 0.18;

        const ll = L.latLng(lat + oLat + LAT_SHIFT, lon + oLon);

        if (!bounds.contains(ll)) return;

        const pos = map.latLngToContainerPoint(ll);
        const sprite = pickSprite(intensity);

        if (!sprite) return;

        const baseAlpha = zoom > 8 ? 0.6 : 0.45;

        ctx.globalAlpha = Math.min(baseAlpha, intensity / 100);

        ctx.drawImage(
          sprite,
          pos.x - drawR,
          pos.y - drawR,
          drawR * 2,
          drawR * 2
        );

        if (zoom > 8) {
          ctx.globalAlpha *= 0.4;

          const pulse = Math.sin(t * 2 + i) * 0.1 + 1;
          const wide = drawR * 1.8 * pulse;

          ctx.drawImage(sprite, pos.x - wide, pos.y - wide, wide * 2, wide * 2);
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
  cache: "no-store",
});

if (!res.ok) {
  throw new Error(`Aurora API ${res.status}`);
}

const data = await res.json();

if (!data?.coordinates) {
  throw new Error("Invalid aurora data");
}

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
