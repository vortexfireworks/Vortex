// Moon Fireworks: setup, the scene (sky, ground, Earth, flag), Chuck, his van and his whippet.

const TAU = Math.PI * 2;
const SCORES_API = 'https://script.google.com/macros/s/AKfycbxHGsAnuVvfdr5O0-lC7U01tCclhAVIrrGEwLfVoaa142YYGU0OyX1tBCiK1nGOqf_n8A/exec';
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
const cv = $('c');
const ctx = cv.getContext('2d');
const bg = document.createElement('canvas');
const fg = document.createElement('canvas');

// The "back to tools" link only makes sense inside the Vortex app.
if (!/moon-fireworks\.html$/.test(location.pathname)) document.querySelectorAll('.back').forEach(a => a.remove());

let W, H, dpr, groundY, skyTop, stars = [];

// ---------- scene ----------
function horizon(x) {
  return groundY + Math.sin(x * 0.004 + 1) * 12 + Math.sin(x * 0.013) * 5;
}

// innerWidth/innerHeight can read 0 when the page loads in a background tab,
// an in-app browser or the home-screen app before layout, so fall back to
// other viewport measurements.
function viewportSize() {
  const de = document.documentElement, vv = window.visualViewport;
  const w = innerWidth || de.clientWidth || (vv && Math.round(vv.width)) || 0;
  const h = innerHeight || de.clientHeight || (vv && Math.round(vv.height)) || 0;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = viewportSize();
  W = vw.w; H = vw.h;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  groundY = H * 0.86;
  // rockets top out below the score bar and buttons so they never hide behind them
  const hudR = $('hud').getBoundingClientRect(), multR = $('mult').getBoundingClientRect();
  skyTop = Math.min(groundY * 0.4, Math.max(H * 0.1, hudR.bottom + 24, multR.top + 40));
  stars = [];
  const n = Math.floor(W * H / 2200);
  for (let i = 0; i < n; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * groundY, r: Math.random() * 1.4 + 0.3,
      speed: 0.5 + Math.random() * 2, phase: Math.random() * TAU });
  }
  if (van) {
    van.parkX = vanParkX();
    if (van.parked) van.x = van.parkX;
  }
  drawBackground();
  drawForeground();
}

function drawBackground() {
  bg.width = W * dpr; bg.height = H * dpr;
  const b = bg.getContext('2d');
  b.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = b.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#02010a');
  sky.addColorStop(0.7, '#0a0b26');
  sky.addColorStop(1, '#161838');
  b.fillStyle = sky; b.fillRect(0, 0, W, H);

  // faint galaxy band
  b.save();
  b.translate(W * 0.3, H * 0.35); b.rotate(-0.5);
  const band = b.createRadialGradient(0, 0, 0, 0, 0, W * 0.6);
  band.addColorStop(0, 'rgba(140,120,255,.10)');
  band.addColorStop(1, 'rgba(140,120,255,0)');
  b.scale(1, 0.18);
  b.fillStyle = band; b.beginPath(); b.arc(0, 0, W * 0.6, 0, TAU); b.fill();
  b.restore();

  // Earth hanging in the sky
  const { er, ex, ey } = earthGeom();
  const glow = b.createRadialGradient(ex, ey, er * 0.95, ex, ey, er * 1.4);
  glow.addColorStop(0, 'rgba(120,190,255,.45)');
  glow.addColorStop(1, 'rgba(120,190,255,0)');
  b.fillStyle = glow; b.beginPath(); b.arc(ex, ey, er * 1.4, 0, TAU); b.fill();

  b.save();
  b.beginPath(); b.arc(ex, ey, er, 0, TAU);
  const ocean = b.createRadialGradient(ex - er * .3, ey - er * .3, er * .1, ex, ey, er);
  ocean.addColorStop(0, '#86ccff'); ocean.addColorStop(0.6, '#2a6fd6'); ocean.addColorStop(1, '#0b2a66');
  b.fillStyle = ocean; b.fill(); b.clip();
  b.fillStyle = '#3f9f52';
  const land = [[-.35,-.2,.35,.22,.4],[.25,.1,.3,.4,-.3],[-.1,.45,.25,.12,.2],[.3,-.45,.2,.12,0],[-.55,.3,.15,.25,.6]];
  for (const [dx, dy, rx, ry, rot] of land) {
    b.beginPath(); b.ellipse(ex + dx * er, ey + dy * er, rx * er, ry * er, rot, 0, TAU); b.fill();
  }
  b.fillStyle = 'rgba(255,255,255,.55)';
  const clouds = [[-.1,-.55,.45,.07,.1],[.1,.25,.5,.06,-.2],[-.5,-.05,.25,.05,.3]];
  for (const [dx, dy, rx, ry, rot] of clouds) {
    b.beginPath(); b.ellipse(ex + dx * er, ey + dy * er, rx * er, ry * er, rot, 0, TAU); b.fill();
  }
  b.fillStyle = 'rgba(0,0,12,.7)';
  b.beginPath(); b.arc(ex + er * .6, ey + er * .3, er * 1.05, 0, TAU); b.fill();
  b.restore();
}

function earthGeom() {
  return { er: Math.max(26, Math.min(W, H) * 0.075), ex: W * 0.82, ey: H * 0.17 };
}

// ---------- the Earth catches fire from Show 4 on ----------
let earthFire = 0, flames = [];
function updateEarthFire(dt) {
  const target = showIdx >= 3 && state !== 'menu' ? 1 : 0;
  earthFire += Math.sign(target - earthFire) * Math.min(Math.abs(target - earthFire), dt / 3);
  const { er, ex, ey } = earthGeom();
  let n = earthFire * 160 * dt;
  while (n > 0) {
    if (Math.random() < n) {
      // mostly from the top and sides, since flames rise
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
      const smoke = Math.random() < 0.15;
      flames.push({ x: ex + Math.cos(a) * er * 0.92, y: ey + Math.sin(a) * er * 0.92,
        vx: Math.cos(a) * er * 0.25 + (Math.random() - 0.5) * er * 0.2, vy: -er * (0.6 + Math.random() * 0.8),
        life: 1, decay: smoke ? 0.5 : 1 + Math.random() * 0.8, size: er * (0.16 + Math.random() * 0.14), smoke });
    }
    n -= 1;
  }
  for (const f of flames) {
    f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.97;
    f.life -= f.decay * dt;
  }
  flames = flames.filter(f => f.life > 0);
}

function drawEarthFire() {
  if (earthFire <= 0 && !flames.length) return;
  const { er, ex, ey } = earthGeom();
  // scorched tint and a hot glow around the planet
  ctx.fillStyle = `rgba(255,80,20,${0.3 * earthFire})`;
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
  const glow = ctx.createRadialGradient(ex, ey, er * 0.9, ex, ey, er * 2);
  glow.addColorStop(0, `rgba(255,120,30,${0.45 * earthFire})`);
  glow.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ex, ey, er * 2, 0, TAU); ctx.fill();

  for (const f of flames) {
    if (!f.smoke) continue;
    ctx.fillStyle = `rgba(50,40,45,${f.life * 0.35})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (2 - f.life), 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flames) {
    if (f.smoke) continue;
    ctx.fillStyle = `hsla(${10 + f.life * 40},100%,${45 + f.life * 20}%,${f.life * 0.55})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (0.4 + f.life * 0.6), 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawForeground() {
  fg.width = W * dpr; fg.height = H * dpr;
  const f = fg.getContext('2d');
  f.setTransform(dpr, 0, 0, dpr, 0, 0);

  // lunar surface
  f.beginPath(); f.moveTo(0, H);
  for (let x = 0; x <= W + 8; x += 8) f.lineTo(x, horizon(x));
  f.lineTo(W, H); f.closePath();
  const dirt = f.createLinearGradient(0, groundY - 20, 0, H);
  dirt.addColorStop(0, '#a3a3ae'); dirt.addColorStop(1, '#45454f');
  f.fillStyle = dirt; f.fill();
  f.strokeStyle = 'rgba(255,255,255,.3)'; f.lineWidth = 1.5;
  f.beginPath();
  for (let x = 0; x <= W + 8; x += 8) x ? f.lineTo(x, horizon(x)) : f.moveTo(x, horizon(x));
  f.stroke();

  // craters
  const count = Math.max(6, Math.floor(W / 70));
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const t = Math.random();
    const y = groundY + 22 + t * (H - groundY - 30);
    const r = (6 + Math.random() * 24) * (0.6 + t * 0.8);
    f.fillStyle = 'rgba(40,40,52,.55)';
    f.beginPath(); f.ellipse(x, y, r, r * 0.32, 0, 0, TAU); f.fill();
    f.strokeStyle = 'rgba(220,220,235,.35)'; f.lineWidth = 1.5;
    f.beginPath(); f.ellipse(x, y + 1, r, r * 0.32, 0, 0.15, Math.PI - 0.15); f.stroke();
  }
}

// ---------- the Vortex Fireworks flag ----------
const flagFace = document.createElement('canvas');
flagFace.width = 400; flagFace.height = 320;
(function paintFlagFace(logo) {
  const f = flagFace.getContext('2d');
  f.fillStyle = '#fff'; f.fillRect(0, 0, 400, 320);
  if (logo) f.drawImage(logo, 40, 0, 320, 320);
  if (!logo) {
    const img = new Image();
    img.onload = () => paintFlagFace(img);
    img.src = LOGO_SRC;
  }
})();

// ---------- interlocking U burst shape, sampled from the logo's red pixels ----------
let UTAH_POINTS = [];
(function () {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 96, 96);
    const d = g.getImageData(0, 0, 96, 96).data;
    const pts = [];
    for (let y = 0; y < 96; y += 3) {
      for (let x = 0; x < 96; x += 3) {
        const i = (y * 96 + x) * 4;
        const [r, gg, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
        if (a > 128 && r > 120 && gg < 90 && b < 90) pts.push([(x - 48) / 48, (y - 48) / 48]);
      }
    }
    UTAH_POINTS = pts;
  };
  img.src = UTAH_SRC;
})();

// ---------- Chuck's white van, with the 1.3G placard on the side ----------
const placard = new Image();
placard.src = PLACARD_SRC;
let van = null, arriveT = 0;

// A white full-size cargo van, traced from a side-on photo (front on the right). Shapes are given
// in the photo's pixel coordinates and mapped into Chuck's pixel units: the van is VAN_LEN units
// long and VAN_TALL units tall, with (0,0) at its back bottom corner on the ground.
const VAN_LEN = 72, VAN_TALL = 32, VAN_KX = VAN_LEN / 910, VAN_KY = VAN_TALL / 335;
const VAN_DOOR = { rear: 470, front: 300 }; // driver's door edges in photo x
// the driver's door outline in photo coordinates
const VAN_DOOR_SHAPE = [[470, 822], [390, 822], [300, 914], [300, 1040], [324, 1088], [470, 1088]];
function drawVan() {
  if (!van) return;
  const p = pixelSize();
  const moving = !van.parked && arriveT < 2.6;
  const gx = van.x, gy = horizon(van.x + VAN_LEN / 2 * p) + 3 + (moving ? Math.sin(time * 30) * 0.6 : 0);
  const X = px => gx + (1028 - px) * VAN_KX * p, Y = py => gy - (1150 - py) * VAN_KY * p;
  const poly = pts => { ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b))); ctx.closePath(); };
  const arch = (cx, cy, r) => ctx.ellipse(X(cx), Y(cy), r * VAN_KX * p, r * VAN_KY * p, 0, 0, Math.PI, true);
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); };
  const lw = Math.max(1, p * 0.6);

  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(X(573), gy, VAN_LEN / 2 * p + 2 * p, 2 * p, 0, 0, TAU); ctx.fill();

  // body: flat roof, raked windshield, short hood, with arches cut for the wheels
  ctx.fillStyle = '#f4f4f6'; ctx.strokeStyle = '#8c8c98'; ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(X(1005), Y(1098));
  ctx.lineTo(X(1005), Y(842)); ctx.quadraticCurveTo(X(1005), Y(818), X(982), Y(818));
  ctx.lineTo(X(392), Y(818)); ctx.quadraticCurveTo(X(372), Y(818), X(362), Y(828));
  ctx.lineTo(X(270), Y(918)); ctx.quadraticCurveTo(X(262), Y(925), X(240), Y(927));
  ctx.lineTo(X(160), Y(935)); ctx.quadraticCurveTo(X(128), Y(940), X(126), Y(965));
  ctx.lineTo(X(124), Y(1060)); ctx.lineTo(X(160), Y(1060));
  arch(240, 1088, 84);
  ctx.lineTo(X(735), Y(1094));
  arch(820, 1094, 88);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // panel lines: driver's door, sliding door, a body crease and the fuel door
  ctx.strokeStyle = '#b4b4be'; ctx.lineWidth = lw * 0.8;
  line(VAN_DOOR.rear, 824, VAN_DOOR.rear, 1088);
  line(712, 826, 712, 930);
  line(488, 932, 960, 932);
  ctx.beginPath(); ctx.ellipse(X(596), Y(1034), 12 * VAN_KX * p, 12 * VAN_KY * p, 0, 0, TAU); ctx.stroke();

  // windshield edge and the driver's window
  ctx.fillStyle = '#2b3442';
  poly([[384, 822], [366, 822], [270, 918], [288, 918]]); ctx.fill();
  poly([[455, 838], [392, 838], [314, 916], [322, 925], [455, 925]]); ctx.fill();
  ctx.fillStyle = 'rgba(160,190,220,.35)';
  poly([[440, 845], [410, 845], [360, 900], [380, 900]]); ctx.fill();

  // rear: black pillar trim and the tall red tail light; front marker light
  ctx.fillStyle = '#1e1e24';
  poly([[958, 822], [985, 822], [1003, 846], [1003, 872], [975, 872], [962, 845]]); ctx.fill();
  ctx.fillStyle = '#d4252b'; poly([[975, 876], [1003, 876], [1003, 935], [975, 935]]); ctx.fill();
  ctx.fillStyle = '#f2f2f4'; poly([[978, 908], [1000, 908], [1000, 915], [978, 915]]); ctx.fill();
  ctx.fillStyle = '#ffb347'; poly([[128, 965], [146, 965], [146, 1012], [128, 1012]]); ctx.fill();

  // bumpers and side mirror
  ctx.fillStyle = '#3a3b42';
  poly([[992, 1056], [1030, 1058], [1030, 1100], [992, 1100]]); ctx.fill();
  poly([[118, 1018], [178, 1018], [182, 1072], [170, 1100], [126, 1100], [118, 1080]]); ctx.fill();
  ctx.fillStyle = '#1e1e24'; poly([[305, 880], [326, 878], [326, 922], [305, 924]]); ctx.fill();

  // the 1.3G placard on the cargo side, between the driver's door and the rear wheel
  if (placard.complete && placard.naturalWidth) {
    const s = 13 * p;
    const cx = X(600), cy = Y(950); // clear of the rear wheel arch
    // clip to the diamond so the image's white corners don't cover the van's panel lines
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx, cy - s / 2); ctx.lineTo(cx + s / 2, cy); ctx.lineTo(cx, cy + s / 2); ctx.lineTo(cx - s / 2, cy); ctx.closePath();
    ctx.clip();
    ctx.drawImage(placard, cx - s / 2, cy - s / 2, s, s);
    ctx.restore();
  }

  // driver's door: closed, or swung open toward us on its front hinge
  const d = van.door;
  ctx.fillStyle = '#6a6a74';
  if (d <= 0) {
    poly([[466, 955], [452, 955], [452, 972], [466, 972]]); ctx.fill();
  } else {
    // the doorway, in the door's real shape: slanted along the windshield, cut around the wheel arch
    ctx.fillStyle = '#2a2a33'; poly(VAN_DOOR_SHAPE); ctx.fill();
    ctx.fillStyle = '#44444e'; poly([[460, 960], [400, 960], [400, 1000], [460, 1000]]); ctx.fill(); // seat
    // the door turns on its front hinge: everything is squeezed toward the hinge as it opens, and
    // the swinging edge grows a little as it comes toward us
    const c = Math.cos(d * 1.3), grow = 0.1 * (1 - c);
    const swing = pts => pts.map(([x, y]) => {
      const k = (x - VAN_DOOR.front) / (VAN_DOOR.rear - VAN_DOOR.front);
      return [VAN_DOOR.front + (x - VAN_DOOR.front) * c, 955 + (y - 955) * (1 + grow * k)];
    });
    ctx.fillStyle = '#e6e6ea'; ctx.strokeStyle = '#8c8c98'; ctx.lineWidth = lw;
    poly(swing(VAN_DOOR_SHAPE)); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b3442'; poly(swing([[455, 838], [392, 838], [314, 916], [322, 925], [455, 925]])); ctx.fill();
    ctx.fillStyle = '#6a6a74'; poly(swing([[466, 955], [452, 955], [452, 972], [466, 972]])); ctx.fill();
  }

  // steel wheels with silver hubcaps
  for (const wx of [240, 820]) {
    const cx = X(wx), cy = gy - 63 * VAN_KY * p, R = 60 * VAN_KY * p;
    ctx.fillStyle = '#141416'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c9cad2'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8e8f99'; ctx.lineWidth = Math.max(1, p * 0.5);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.45, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#7a7b85';
    for (let k = 0; k < 5; k++) {
      const a = van.spin + k * TAU / 5;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 0.32, cy + Math.sin(a) * R * 0.32, Math.max(0.8, R * 0.06), 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#e4e4ea'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.18, 0, TAU); ctx.fill();
  }
}

function honk() {
  if (!actx) return;
  const shaper = actx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3); }
  shaper.curve = curve;
  const tone = actx.createBiquadFilter(); tone.type = 'bandpass'; tone.frequency.value = 900; tone.Q.value = 0.7;
  shaper.connect(tone).connect(master);
  for (const [off, dur] of [[0, 0.15], [0.24, 0.42]]) {
    const t = actx.currentTime + off;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.012);
    g.gain.setValueAtTime(0.09, t + dur - 0.03); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    g.connect(shaper);
    for (const f of [370, 466]) {
      const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(g); o.start(t); o.stop(t + dur + 0.02);
    }
  }
}

// The van's engine: a low, lumpy diesel rumble whose pitch follows its speed.
let engine = null, engineNoise = null;
function startEngine() {
  stopEngine();
  if (!actx) return;
  const t = actx.currentTime;
  const out = actx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.12, t + 0.3);
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
  const a = actx.createOscillator(); a.type = 'sawtooth';
  const b = actx.createOscillator(); b.type = 'square'; b.detune.value = 12;
  const bg = actx.createGain(); bg.gain.value = 0.5;
  a.connect(lp); b.connect(bg).connect(lp);
  // cylinder "chug": wobble the volume at the firing rate
  const chug = actx.createGain(); chug.gain.value = 0.6;
  const lfo = actx.createOscillator(); lfo.type = 'sine';
  const lfoAmt = actx.createGain(); lfoAmt.gain.value = 0.4;
  lfo.connect(lfoAmt).connect(chug.gain);
  lp.connect(out).connect(chug).connect(master);
  // a bit of road/exhaust noise underneath
  if (!engineNoise) {
    engineNoise = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = engineNoise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const n = actx.createBufferSource(); n.buffer = engineNoise; n.loop = true;
  const nf = actx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 180;
  const ng = actx.createGain(); ng.gain.value = 0.35;
  n.connect(nf).connect(ng).connect(lp);
  for (const src of [a, b, lfo, n]) src.start(t);
  engine = { out, lp, a, b, lfo, n, ng };
  setEngine(1);
}
function setEngine(rpm) {
  if (!engine) return;
  const t = actx.currentTime, f = 30 + 34 * rpm;
  engine.a.frequency.setTargetAtTime(f, t, 0.08);
  engine.b.frequency.setTargetAtTime(f * 2, t, 0.08);
  engine.lfo.frequency.setTargetAtTime(f / 4, t, 0.08);
  engine.lp.frequency.setTargetAtTime(260 + 700 * rpm, t, 0.08);
  engine.ng.gain.setTargetAtTime(0.1 + 0.4 * rpm, t, 0.1);
}
function stopEngine(fade = 0.05) {
  if (!engine) return;
  const e = engine, t = actx.currentTime;
  engine = null;
  e.out.gain.cancelScheduledValues(t);
  e.out.gain.setValueAtTime(e.out.gain.value, t);
  e.out.gain.linearRampToValueAtTime(0.0001, t + fade);
  for (const src of [e.a, e.b, e.lfo, e.n]) src.stop(t + fade + 0.05);
}
function muteEngine(off) {
  if (engine) engine.out.gain.setTargetAtTime(off ? 0.0001 : 0.12, actx.currentTime, 0.05);
}

function vanParkX() { return Math.max(8, Math.min(W * 0.56, W - (VAN_LEN + 4) * pixelSize() - 8)); }

// Start of every game: the van drives in, Chuck hops out and asks if anyone needs fireworks.
function startArrival() {
  const p = pixelSize();
  van = { startX: -(VAN_LEN + 8) * p, x: -(VAN_LEN + 8) * p, parkX: vanParkX(), door: 0, spin: 0, parked: false };
  state = 'arrive'; arriveT = 0;
  startEngine();
  showman.hidden = true; showman.say = null; showman.mood = 'walk';
  dog.hidden = true; dog.hide = false; poops = [];
}

function updateArrival(dt) {
  const p = pixelSize(), v = van, m = showman;
  const prev = arriveT;
  arriveT += dt;
  const DRIVE = 2.6;
  if (arriveT < DRIVE) {
    const e = 1 - Math.pow(1 - arriveT / DRIVE, 3);
    const nx = v.startX + (v.parkX - v.startX) * e;
    v.spin += (nx - v.x) / (5 * p);
    v.x = nx;
    // revs as it rolls in, easing off as it slows to park
    setEngine(0.2 + 0.8 * Math.pow(1 - arriveT / DRIVE, 2));
  } else v.x = v.parkX;
  if (prev < DRIVE && arriveT >= DRIVE) setEngine(0);
  if (prev < 3.3 && arriveT >= 3.3) stopEngine(0.5);
  if (prev < 2.7 && arriveT >= 2.7) honk();
  const clamp = k => Math.max(0, Math.min(1, k));
  v.door = clamp((arriveT - 3.0) / 0.4) - clamp((arriveT - 5.2) / 0.4);
  if (arriveT >= 3.4 && m.hidden) {
    m.hidden = false; m.x = v.x + 51 * p; m.dir = -1;
  }
  // his whippet leaps out right behind him
  if (arriveT >= 3.9 && dog.hidden) releaseDog(v.x + 51 * p);
  // he walks along the van until he's clear of it, then turns to the crowd
  if (!m.hidden && arriveT < 5.0) {
    m.x -= 34 * p * dt;
    m.pose = Math.floor(arriveT * 7) % 2 ? POSES.walk1 : POSES.walk0;
  } else if (!m.hidden) {
    if (!m.say) m.say = { text: 'Anyone need some fireworks?', t: 0 };
    m.pose = arriveT < 6.2 ? POSES.cheer : POSES.walk0;
  }
  if (arriveT >= 7.8) endArrival();
}

function endArrival() {
  const p = pixelSize();
  if (showman.hidden || arriveT < 5) { showman.x = van.parkX - 8 * p; showman.dir = -1; }
  showman.hidden = false; showman.say = null;
  stopEngine(0.3);
  if (dog.hidden) releaseDog(van.parkX - 22 * p);
  van.x = van.parkX; van.door = 0; van.parked = true;
  // shortcuts for checking things quickly (see "shortcuts" below)
  const flags = hashFlags();
  if (flags.has('drones')) {
    shortcutUsed = true;
    showIdx = SWARM_AFTER_SHOW;
    return startSwarm();
  }
  beginShow();
  if (flags.has('candle')) { shortcutUsed = true; candleAt = 0; }
}
let shortcutUsed = false;

function drawFlag() {
  const s = Math.max(0.6, Math.min(1.6, H / 550, W / 560));
  const px = W * 0.12, py = horizon(px);
  const poleH = 135 * s, fw = 80 * s, fh = 64 * s, top = py - poleH + 4 * s;

  ctx.strokeStyle = '#d4d4dc'; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.moveTo(px, py + 2); ctx.lineTo(px, py - poleH); ctx.stroke();
  ctx.fillStyle = '#ffd86b';
  ctx.beginPath(); ctx.arc(px, py - poleH, 3.5 * s, 0, TAU); ctx.fill();

  // draw the flag in thin vertical strips, each bobbing on a travelling wave
  const strips = Math.ceil(fw / 2);
  const sw = flagFace.width / strips, dw = fw / strips;
  for (let i = 0; i < strips; i++) {
    const u = i / strips;
    const phase = time * 4 - u * 7;
    const dy = Math.sin(phase) * 6 * s * u;
    const x = px + 1 + u * fw;
    ctx.drawImage(flagFace, i * sw, 0, sw, flagFace.height, x, top + dy, dw + 0.7, fh);
    const light = Math.cos(phase) * u;
    ctx.fillStyle = light > 0 ? `rgba(255,255,255,${light * 0.18})` : `rgba(0,0,30,${-light * 0.3})`;
    ctx.fillRect(x, top + dy, dw + 0.7, fh);
  }
}

// ---------- Chuck, the showman: a little pixel guy strolling the moon ----------
const PAL = {
  H: '#d4252b', h: '#951519', L: '#ff6060',            // bowler hat
  W: '#f4f4f4', w: '#c4c4cc',                          // white hair & beard
  S: '#f0c09c', s: '#cf9673', E: '#2a1a14', M: '#8a3a30', // face & hands
  R: '#ea3d2c', r: '#a8221a', l: '#ff6e52',            // tailcoat
  V: '#cf2c1d', B: '#ff2216', K: '#16161a',            // vest, bow tie, shirt
  T: '#0a0a0a', Y: '#b8b8c0',                          // belt & buckle
  J: '#26272e', j: '#3c3e4a', O: '#0b0b0d',            // jeans & shoes
  D: '#8fd4ff',                                        // sweat drop
};
const BODY = [
  '.........LHHHHH.........',
  '........LHHHHHHH........',
  '........LHHHHHHHh.......',
  '........HHHHHHHHh.......',
  '........hhhhhhhhh.......',
  '......HHHHHHHHHHHHH.....',
  '.......hhhhhhhhhhh......',
  '........WWSSSSSSS.......',
  '.......WWWSSSSSSSS......',
  '.......WWsSSSSESSS......',
  '.......WWsSSSSSSSSS.....',
  '.......WWSSSWWWWWW......',
  '........WSWWWWMWWW......',
  '........WWWWWWWWW.......',
  '.........WWWWWWw........',
  '........RRBBKBBRR.......',
  '.......RRRlKKKlRRRR.....',
  '......RRRRlKKKlRRRRR....',
  '......rRRRlVKVlRRRrR....',
  '......rRRRRlVVVlRRrR....',
  '......rRRRRlVrVlRRrR....',
  '......rRRRRRVVVRRRrR....',
  '......rRRRRRVrVRRRrR....',
  '......rRRRRRVVVRRRrR....',
  '......rRRRRRTYTRRRrR....',
  '.....rRRRRRRJJJRRRrSS...',
  '....rrRRRRRRJJJJRRRss...',
  '...rrRRRRR.JJJJ.RR......',
  '..rrRRRR...JJJJ.........',
  '.rrRRR.....JJJJ.........',
];
const LEGS = [
  ['rrR........JJ.JJ........',
   '...........JJ.JJ........',
   '...........jJ.jJ........',
   '...........JJ.JJ........',
   '...........JJ.JJ........',
   '..........OOO.OOOO......'],
  ['rrR.......JJ...JJ.......',
   '.........JJ.....JJ......',
   '.........jJ.....jJ......',
   '........JJ.......JJ.....',
   '........JJ.......JJ.....',
   '.......OOO.......OOOO...'],
];
// Both arms thrown up in the air (and the hanging hand removed).
const CHEER_ARMS = [
  [18,15,'R'],[19,15,'R'],[19,14,'R'],[20,14,'R'],[20,13,'R'],[21,13,'R'],[21,12,'R'],[21,11,'S'],[22,11,'S'],[21,10,'S'],
  [6,16,'R'],[5,15,'R'],[5,14,'R'],[4,14,'R'],[4,13,'R'],[3,13,'R'],[3,12,'R'],[3,11,'S'],[2,11,'S'],[3,10,'S'],
  [19,25,'.'],[20,25,'.'],[19,26,'.'],[20,26,'.'],
];
const SWEAT = [[20,7,'D'],[20,8,'D'],[21,8,'D']];
// Front arm held straight out to grip the Roman candle.
const CANDLE_ARM = [
  [19,15,'R'],[20,15,'R'],[21,15,'R'],[19,16,'R'],[20,16,'R'],[21,16,'r'],
  [22,14,'S'],[23,14,'S'],[22,15,'S'],[23,15,'S'],
  [19,25,'.'],[20,25,'.'],[19,26,'.'],[20,26,'.'],
];
function buildPose(legs, extra) {
  const g = BODY.concat(legs).map(r => r.split(''));
  for (const [x, y, c] of extra || []) g[y][x] = c;
  return g;
}
const POSES = {
  walk0: buildPose(LEGS[0]), walk1: buildPose(LEGS[1]),
  cheer: buildPose(LEGS[0], CHEER_ARMS), slump: buildPose(LEGS[0], SWEAT),
  candle: buildPose(LEGS[0], CANDLE_ARM),
};
const showman = { x: 0, dir: 1, anim: 0, pause: 0, walk: 3 + Math.random() * 4,
  mood: 'walk', moodT: 0, pose: POSES.walk0, lift: 0, sink: 0, tappedShow: -1 };

// Chuck, the van and the dog share one pixel grid; it follows the narrower of height and width
// so they don't crowd a phone screen in portrait.
function pixelSize() { return Math.max(2, Math.round(Math.min(H / 250, W / 200))); }

function react(mood, dur) {
  const m = showman;
  if (m.mood === 'candle') return;
  if (m.mood === 'dance' && mood !== 'dance' && m.moodT > 0) return;
  m.mood = mood; m.moodT = dur;
}

function updateShowman(dt) {
  const m = showman, p = pixelSize();
  if (!m.x) m.x = W * 0.25;
  m.lift = 0; m.sink = 0;
  if (state === 'arrive') return; // updateArrival moves him
  if (m.mood === 'candle') { m.pose = POSES.candle; return; }
  if (m.say) {
    // stands still facing the crowd while he talks, arms up for the first moment
    m.say.t += dt;
    m.pose = m.say.t < 1.6 ? POSES.cheer : POSES.walk0;
    return;
  }
  if (m.mood !== 'walk') {
    m.moodT -= dt;
    if (m.moodT <= 0) m.mood = 'walk';
  }
  if (m.mood === 'cheer') {
    m.pose = POSES.cheer;
    m.lift = Math.abs(Math.sin(m.moodT * 9)) * 6 * p;
    return;
  }
  if (m.mood === 'dance') {
    const beat = Math.floor(m.moodT / 0.16);
    m.pose = beat % 2 ? POSES.cheer : POSES.walk1;
    m.dir = Math.floor(m.moodT / 0.32) % 2 ? 1 : -1;
    m.lift = Math.abs(Math.sin(m.moodT * 12)) * 4 * p;
    return;
  }
  if (m.mood === 'slump') {
    m.pose = POSES.slump;
    m.sink = p;
    return;
  }
  if (m.pause > 0) {
    m.pause -= dt; m.pose = POSES.walk0;
    return;
  }
  m.x += m.dir * 14 * p * dt;
  if (m.x > W * 0.94) { m.x = W * 0.94; m.dir = -1; }
  if (m.x < W * 0.06) { m.x = W * 0.06; m.dir = 1; }
  m.anim += dt;
  m.pose = Math.floor(m.anim * 6) % 2 ? POSES.walk1 : POSES.walk0;
  m.walk -= dt;
  if (m.walk <= 0) {
    m.pause = 0.6 + Math.random() * 1.4;
    m.walk = 2 + Math.random() * 5;
    if (Math.random() < 0.4) m.dir *= -1;
  }
}

function showmanBox() {
  const m = showman, p = pixelSize();
  const w = 24 * p, h = m.pose.length * p;
  const left = Math.round(m.x - w / 2);
  const bob = m.pose === POSES.walk1 ? -p : 0;
  const top = Math.round(horizon(m.x) + 4 - h + bob - m.lift + m.sink);
  return { left, top, w, h, p };
}

function drawShowman() {
  if (showman.hidden) return;
  const m = showman, { left, top, p } = showmanBox();
  const cols = m.pose[0].length;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(m.x, horizon(m.x) + 4, 9 * p, 1.5 * p, 0, 0, TAU); ctx.fill();
  for (let y = 0; y < m.pose.length; y++) {
    const row = m.pose[y];
    for (let x = 0; x < cols; x++) {
      const c = row[m.dir > 0 ? x : cols - 1 - x];
      if (c === '.') continue;
      ctx.fillStyle = PAL[c];
      ctx.fillRect(left + x * p, top + y * p, p, p);
    }
  }
  if (m.say) drawSpeech(m.say.text, m.x, top - 8);
}

// ---------- Chuck's whippet: rides along in the van, does zoomies and leaves little surprises ----------
const DOG_PAL = {
  F: '#c99460', f: '#9a6a3e', w: '#f2ece2', E: '#1a1210', N: '#1a1210', C: '#d4252b',
  P: '#5a3a1e', p: '#3e2612', q: '#7a5430',
};
// Facing right, drawn in Chuck's pixel units; the last row is the paws on the ground.
const DOG_BODY = [
  '...................ff.....',
  '..................fFFFF...',
  '..................FFEFFFFN',
  '.................CCFFFww..',
  '.................CCF......',
  '................FFF.......',
  '...FFFFFFFFFFFFFFFw.......',
  '..fFFFFFFFFFFFFFFww.......',
  '.f.FFFF.....FFFFww........',
  'f...FFf.....FFFw..........',
];
const DOG_LEGS = {
  stand: ['f....Ff......Fw...........',
          '.....F.......F............',
          '....F........F............',
          '...ff........ww...........'],
  stretch: ['...F.........FF...........',
            '..F............F..........',
            '.F...............F........',
            'ff................ww......'],
  gather: ['.....F......F.............',
           '......F....F..............',
           '.......F..F...............',
           '.......ffww...............'],
};
const DOG_SQUAT = [
  '...................ff.....',
  '..................fFFFF...',
  '..................FFEFFFFN',
  '.................CCFFFww..',
  '.........FFFF....CCF......',
  '......FFFFFFFFFFFFF.......',
  '.....FFFFFFFFFFFFFw.......',
  'ff..FFFFFFFFFFFFww........',
  '..ffFFFFF....FFww.........',
  '....FFFF.....Fw...........',
  '....FFF......F............',
  '....FFF......F............',
  '...FFFF......F............',
  '..fff........ww...........',
];
const DOG_POSES = {
  stand: DOG_BODY.concat(DOG_LEGS.stand),
  stretch: DOG_BODY.concat(DOG_LEGS.stretch),
  gather: DOG_BODY.concat(DOG_LEGS.gather),
  squat: DOG_SQUAT,
};
const POOP = ['..p..', '.pPq.', 'pPPPp'];
const CHUCK_POOP_LINES = ['Aw, not there!', 'Good girl… I guess', "Who's cleaning that up?", 'Moon dust and dog poop'];
const dog = { x: 0, dir: -1, mode: 'trot', t: 2, anim: 0, poopIn: 8, hidden: false, pose: DOG_POSES.stand };
let poops = [];

function dogMode(mode, t) { dog.mode = mode; dog.t = t; }

function updateDog(dt) {
  const d = dog, p = pixelSize();
  if (!d.x) d.x = W * 0.4;
  for (const s of poops) s.age += dt;
  if (d.hidden) return;
  if (d.hide && van) {
    // scared of the Roman candle: hides behind the van, and now and then peeks out the back
    d.peek -= dt; d.anim += dt;
    if (d.peek < -0.9) d.peek = 1.5 + Math.random() * 1.5;
    const tx = d.peek < 0 ? van.x + 9 * p : van.x + VAN_LEN / 2 * p;
    if (Math.abs(tx - d.x) > 2) {
      d.dir = tx > d.x ? 1 : -1;
      d.x += d.dir * Math.min(Math.abs(tx - d.x), 75 * p * dt);
      d.pose = Math.floor(d.anim / 0.08) % 2 ? DOG_POSES.stretch : DOG_POSES.gather;
    } else {
      d.dir = -1;
      d.pose = DOG_POSES.stand;
    }
    return;
  }
  d.t -= dt; d.anim += dt;
  const speed = d.mode === 'zoom' ? 75 : d.mode === 'trot' ? 24 : 0;
  if (speed) {
    d.x += d.dir * speed * p * dt;
    const lo = W * 0.04, hi = W * 0.96;
    if (d.x < lo) { d.x = lo; d.dir = 1; }
    if (d.x > hi) { d.x = hi; d.dir = -1; }
    if (d.mode === 'zoom' && Math.random() < dt * 0.8) d.dir *= -1;
    d.pose = Math.floor(d.anim / (d.mode === 'zoom' ? 0.08 : 0.16)) % 2 ? DOG_POSES.stretch : DOG_POSES.gather;
  } else d.pose = d.mode === 'squat' ? DOG_POSES.squat : DOG_POSES.stand;

  if (d.mode !== 'squat' && d.mode !== 'zoom') d.poopIn -= dt;
  if (d.t > 0) return;
  if (d.mode === 'squat') {
    dropPoop();
    dogMode('zoom', 1.2 + Math.random() * 1.2); // the post-poop zoomies
  } else if (d.poopIn <= 0 && state !== 'arrive') {
    d.poopIn = 14 + Math.random() * 16;
    dogMode('squat', 1.8);
  } else {
    const r = Math.random();
    if (r < 0.2) dogMode('zoom', 1.2 + Math.random() * 1.8);
    else if (r < 0.6) { dogMode('trot', 1.5 + Math.random() * 3); if (Math.random() < 0.4) d.dir *= -1; }
    else dogMode('sniff', 0.8 + Math.random() * 1.8);
  }
}

function dropPoop() {
  const p = pixelSize();
  poops.push({ x: dog.x - dog.dir * 9 * p, age: 0 });
  if (playing() && ++goals.game.poops >= 5) unlock('dogout');
  if (poops.length > 8) poops.shift();
  plop();
  const m = showman;
  if (!m.hidden && m.mood !== 'candle' && !m.say && Math.random() < 0.5) {
    const line = CHUCK_POOP_LINES[Math.floor(Math.random() * CHUCK_POOP_LINES.length)];
    texts.push({ x: m.x, y: showmanBox().top - 10, txt: line, color: '#fff', life: 1.6 });
  }
}

function plop() {
  if (!actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  const g = actx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.16);
}

function releaseDog(x) {
  dog.hidden = false; dog.x = x; dog.dir = -1; dog.poopIn = 6 + Math.random() * 6;
  dogMode('zoom', 1.5);
}

function dogBox() {
  const d = dog, p = pixelSize();
  const w = d.pose[0].length * p, h = d.pose.length * p;
  const bob = d.pose === DOG_POSES.stretch ? -p : 0;
  return { left: Math.round(d.x - w / 2), top: Math.round(horizon(d.x) + 4 - h + bob), w, h, p };
}

function tapDog() {
  dogMode('zoom', 2);
  addStat('pets', 1);
  texts.push({ x: dog.x, y: dogBox().top - 6, txt: 'Woof!', color: '#ffd86b', life: 1 });
}

function drawPoops() {
  const p = pixelSize();
  for (const s of poops) {
    const left = Math.round(s.x - 2.5 * p), top = Math.round(horizon(s.x) + 4 - 3 * p);
    for (let y = 0; y < POOP.length; y++) for (let x = 0; x < 5; x++) {
      const c = POOP[y][x];
      if (c === '.') continue;
      ctx.fillStyle = DOG_PAL[c];
      ctx.fillRect(left + x * p, top + y * p, p, p);
    }
    // stink lines while it's fresh
    if (s.age < 8) {
      ctx.strokeStyle = `rgba(170,200,110,${0.6 * (1 - s.age / 8)})`;
      ctx.lineWidth = Math.max(1, p * 0.5);
      for (const k of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const yy = top - p - i * p * 1.2, xx = s.x + k * 1.6 * p + Math.sin(i * 1.3 + s.age * 4 + k) * p;
          i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        }
        ctx.stroke();
      }
    }
  }
}

function drawDog() {
  if (dog.hidden) return;
  const d = dog, { left, top, p } = dogBox();
  const cols = d.pose[0].length;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(d.x, horizon(d.x) + 4, 10 * p, 1.2 * p, 0, 0, TAU); ctx.fill();
  for (let y = 0; y < d.pose.length; y++) {
    const row = d.pose[y];
    for (let x = 0; x < cols; x++) {
      const c = row[d.dir > 0 ? x : cols - 1 - x];
      if (!c || c === '.') continue;
      ctx.fillStyle = DOG_PAL[c];
      ctx.fillRect(left + x * p, top + y * p, p, p);
    }
  }
  // sniffing: nose bobs down to the ground
  if (d.mode === 'sniff' && Math.floor(d.anim * 4) % 2) {
    ctx.fillStyle = DOG_PAL.N;
    const nx = d.dir > 0 ? left + 25 * p : left;
    ctx.fillRect(nx, top + 3 * p, p, p);
  }
}

function drawSpeech(text, x, bottom) {
  ctx.font = '700 16px system-ui, sans-serif';
  const padX = 12, h = 34, w = ctx.measureText(text).width + padX * 2;
  const bx = Math.max(8, Math.min(W - w - 8, x - w / 2)), by = bottom - h - 10;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx + 10, by); ctx.arcTo(bx + w, by, bx + w, by + h, 10); ctx.arcTo(bx + w, by + h, bx, by + h, 10);
  ctx.lineTo(x + 8, by + h); ctx.lineTo(x, by + h + 10); ctx.lineTo(x - 4, by + h);
  ctx.arcTo(bx, by + h, bx, by, 10); ctx.arcTo(bx, by, bx + w, by, 10); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a1a2a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, by + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}
