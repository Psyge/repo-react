/* ========================================================================
   auroraOrb.js  —  three.js-revontuliorbi (LAZY-LADATTAVA)

   Tätä EI importata staattisesti missään. AuroraHero kutsuu
   dynaamisesti: const { createAuroraOrb } = await import("./auroraOrb");
   → Vite pilkkoo tämän + three:n omaan chunkkiin, joka ladataan
     vain tehokkailla laitteilla/yhteyksillä.

   Vain core "three" -import → ei postprocessing-riippuvuuksia.
   Hehku tehdään additiivisella "atmosfääri"-pallolla + CSS-taustahehkulla.

   API:
     const orb = createAuroraOrb(canvas, { intensity: 0.22 });
     orb.setIntensity(0.6);   // 0..1, esim. aurora.probability/100
     orb.destroy();           // siivoaa kaiken (WebGL, RAF, listenerit)
======================================================================== */

import * as THREE from "three";

/* ---- jaettu 3D simplex noise (Ashima/Stefan Gustavson, julkinen) ---- */
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

export function createAuroraOrb(canvas, opts = {}) {
  const initialIntensity = clamp01(opts.intensity ?? 0.25);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,            // läpinäkyvä → komposiitti CSS-taustan päälle
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 3.1;

  const uTime = { value: 0 };
  const uIntensity = { value: initialIntensity };

  /* ---- pää-orbi: noise-vääristetty hehkuva pinta ---- */
  const coreMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime, uIntensity },
    vertexShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying float vNoise;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        float n = snoise(normal * 1.8 + vec3(0.0, uTime * 0.25, 0.0));
        vNoise = n;
        float disp = (0.06 + 0.10 * uIntensity) * n;
        vec3 pos = position + normal * disp;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying vec3 vNormal;
      varying float vNoise;
      void main() {
        // värit: syvä violetti → cyan → vihreä, noise + aktiivisuus ohjaa
        vec3 cLow  = vec3(0.18, 0.10, 0.45);   // violetti
        vec3 cMid  = vec3(0.05, 0.85, 1.00);   // cyan
        vec3 cHigh = vec3(0.20, 1.00, 0.65);   // revontulivihreä
        float t = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(cLow, cMid, smoothstep(0.0, 0.6, t));
        col = mix(col, cHigh, smoothstep(0.5, 1.0, t) * (0.4 + 0.6 * uIntensity));
        // korkea aktiivisuus → koko pallo vihertää (revontulia näkyvissä)
        col = mix(col, cHigh, uIntensity * 0.7);
        // fresnel-reuna kirkastaa siluetin
        float fres = pow(1.0 - abs(vNormal.z), 2.5);
        col += fres * (0.3 + 0.5 * uIntensity);
        gl_FragColor = vec4(col, 0.92);
      }
    `,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 24), coreMat);
  scene.add(core);

  /* ---- atmosfääri: additiivinen ulkohehku (korvaa bloomin) ---- */
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uIntensity },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 1.35, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying vec3 vNormal;
      void main() {
        float glow = pow(1.0 - abs(vNormal.z), 3.0);
        vec3 col = mix(vec3(0.0, 0.9, 0.7), vec3(0.45, 0.35, 1.0), 0.4);
        gl_FragColor = vec4(col, glow * (0.5 + 0.5 * uIntensity));
      }
    `,
  });
  const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 12), glowMat);
  scene.add(glow);

  /* ---- koko ---- */
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

  /* ---- animaatiosilmukka (pysähtyy kun välilehti piilossa) ---- */
  const clock = new THREE.Clock();
  let rafId = null;
  let running = true;

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    uTime.value = clock.getElapsedTime();
    core.rotation.y += 0.0016;
    glow.rotation.y = core.rotation.y;
    renderer.render(scene, camera);
  }

  function onVisibility() {
    if (document.hidden) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    } else if (!running) {
      running = true;
      clock.getDelta(); // nollaa hyppy
      loop();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  loop();

  /* ---- julkinen API ---- */
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
      core.geometry.dispose();
      coreMat.dispose();
      glow.geometry.dispose();
      glowMat.dispose();
      renderer.dispose();
    },
  };
}

function clamp01(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}