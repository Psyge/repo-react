/* ========================================================================
   auroraSky.js  —  three.js-revontulitaivas (HORISONTATIVIERITYS)

   Tätä EI importata staattisesti missään. AuroraHero kutsuu
   dynaamisesti: const { createAuroraSky } = await import("./auroraSky");
   → Vite pilkkoo tämän + three:n omaan chunkkiin, joka ladataan
     vain tehokkailla laitteilla/yhteyksillä.

   API:
     const sky = createAuroraSky(canvas, { intensity: 0.22 });
     sky.setIntensity(0.6);   // 0..1, ohjaa valoverhojen rajutta ja väriä
     sky.destroy();           // siivoaa WebGL:n, RAF:n ja kuuntelijat
======================================================================== */

import * as THREE from "three";

/* ---- jaettu 3D simplex noise (Ashima/Stefan Gustavson) ---- */
const NOISE_GLSL = /* glsl */ `
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;  
vec3 x2 = x0 - i2 + 2.0 * C.xxx;   
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

export function createAuroraSky(canvas, opts = {}) {
  const initialIntensity = clamp01(opts.intensity ?? 0.25);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,            // Läpinäkyvä pohja, jotta sulautuu täydellisesti mustaan taustaan[cite: 9]
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  
  // Kamera asetetaan matalalle katsomaan yläviistoon kohti horisonttia[cite: 9]
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, -0.8, 2.0);
  camera.rotation.set(0.3, 0, 0); // Kevyt kallistus ylöspäin[cite: 9]

  const uTime = { value: 0 };
  const uIntensity = { value: initialIntensity };

  /* ---- Päätaivas: Verhomaiset, poimuilevat revontulinauhat ---- */
  const skyMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending, // Valomainen sekoitus luo neonhohdon[cite: 9]
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime, uIntensity },
    vertexShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      varying float vNoise;

      void main() {
        vUv = uv;
        
        // Lasketaan poimuileva liike. Tehdään pystysuoria "verhoja" vääristämällä Z-akselia (syvyys).[cite: 9]
        // x-akselin kerroin määrää kuinka monta "aaltoa" taivaalla näkyy rinnakkain.[cite: 9]
        vec3 noisePos = vec3(position.x * 0.7, position.y * 0.3, uTime * 0.12);
        float n1 = snoise(noisePos);
        float n2 = snoise(noisePos * 2.3 - vec3(uTime * 0.05, 0.0, 0.0));
        float combinedNoise = n1 * 0.7 + n2 * 0.3;
        vNoise = combinedNoise;

        // Vääristetään pintaa syvyyssuunnassa aktiivisuuden mukaan[cite: 9]
        float disp = (0.15 + 0.35 * uIntensity) * combinedNoise;
        vec3 pos = position + vec3(0.0, 0.0, disp);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying vec2 vUv;
      varying float vNoise;

      void main() {
        // Neonvärit säädetty skandinaavisen revontuliyön mukaisiksi[cite: 9]
        vec3 cBottom = vec3(0.02, 0.45, 0.85); // Sähkönsininen/cyan alareunassa[cite: 9]
        vec3 cMid    = vec3(0.05, 0.95, 0.45); // Klassinen revontulivihreä keskellä[cite: 9]
        vec3 cTop    = vec3(0.40, 0.10, 0.70); // Harvinainen violetti/purppura yläreunassa[cite: 9]

        float t = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);

        // Sekoitetaan värit orgaanisesti kohinan perusteella[cite: 9]
        vec3 auroraColor = mix(cBottom, cMid, smoothstep(0.1, 0.5, t));
        auroraColor = mix(auroraColor, cTop, smoothstep(0.5, 0.9, t) * (0.2 + 0.8 * uIntensity));
        
        // Jos aktiivisuus on korkea, voimistetaan vihreää loistetta[cite: 9]
        auroraColor = mix(auroraColor, cMid, uIntensity * 0.4);

        // Häivytetään revontuliverhon ylä- ja alareunat pehmeästi (Fade)[cite: 9]
        // This prevents the sky cutting off strictly on an edge.
        float verticalFade = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
        
        // Sivuhäivytys, jotta nauha sulautuu reunoilta pimeyteen[cite: 9]
        float horizontalFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
        
        float finalAlpha = verticalFade * horizontalFade * (0.15 + 0.85 * smoothstep(0.2, 0.8, t));

        // Lisätään hienon hieno pystysuuntainen "säiekasvusto" (Ray effect) matkimaan aitoja verhoja[cite: 9]
        float rays = sin(vUv.x * 120.0 + vNoise * 5.0) * 0.08 * verticalFade;
        auroraColor += rays * cMid;

        gl_FragColor = vec4(auroraColor * (0.7 + 0.3 * uIntensity), finalAlpha * (0.4 + 0.6 * uIntensity));
      }
    `,
  });

  // Luodaan laaja taso, joka toimii valkokankaana taivaalla (leveys 5, korkeus 2.5)[cite: 9]
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5, 40, 20), skyMat);
  sky.position.set(0, 0.4, 0); // Nostetaan hieman ylöspäin, jotta alareuna jää tunturien taakse[cite: 9]
  scene.add(sky);

  /* ---- Koko ja Responsiivisuus ---- */
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }

  /* ---- UUSI MODERNISOITU TIMING (Päivitetty THREE.Timeriin) ---- */
  const timer = new THREE.Timer();
  let rafId = null;
  let running = true;

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    
    // Päivitetään uusi ajastinrakenne
    timer.update();
    uTime.value = timer.getElapsed();
    
    // Hienovaraista taivaankannen keinuntaa sivusuunnassa[cite: 9]
    sky.position.x = Math.sin(uTime.value * 0.05) * 0.1;
    
    renderer.render(scene, camera);
  }

  function onVisibility() {
    if (document.hidden) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    } else if (!running) {
      running = true;
      // THREE.Timer ei vaadi kikkailua hyppäysten estoon taustalle menon jälkeen
      loop();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  loop();

  /* ---- Julkinen API (Säilytetty täysin samana) ---- */
  return {
    setIntensity(v) {
      uIntensity.value = clamp01(v);
    },
    destroy() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibility);
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
      sky.geometry.dispose();
      skyMat.dispose();
      renderer.dispose();
    },
  };
}

function clamp01(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}