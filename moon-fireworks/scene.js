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

// Chuck's van is a pixel-art sprite of a cargo van. The picture faces left, so it's drawn flipped to face
// right, the way the van drives in. Positions on the van (door, placard, wheels) are given in the
// original picture's pixel coordinates, inside VAN_BOX, and mapped to the screen. The van is VAN_LEN of
// Chuck's pixel units long, with (0,0) at its back bottom corner on the ground.
const VAN_LEN = 80, VAN_BOX = [65, 246, 989, 673], VAN_K = VAN_LEN / (VAN_BOX[2] - VAN_BOX[0]);
const VAN_DOOR = { rear: 641, front: 503 };  // the driver's door edges, in picture x
const VAN_DOOR_SHAPE = [[503, 268], [622, 262], [638, 272], [641, 556], [523, 561], [506, 498]];
const VAN_WINDOW = [[512, 276], [612, 270], [619, 378], [510, 381]];
const VAN_DOOR_X = (VAN_BOX[2] - 572) * VAN_K;  // where Chuck and the dog step out, in units from the back
const VAN_WHEELS = [[450, 590, 52], [855, 562, 40]]; // centre and hubcap size of each wheel, in picture pixels
const vanImg = new Image(); vanImg.src = VAN_SRC;
function drawVan() {
  if (!van) return;
  const p = pixelSize();
  const moving = !van.parked && arriveT < 2.6;
  const gx = van.x, gy = horizon(van.x + VAN_LEN / 2 * p) + 3 + (moving ? Math.sin(time * 30) * 0.6 : 0);
  const s = VAN_K * p;
  const X = px => gx + (VAN_BOX[2] - px) * s, Y = py => gy - (VAN_BOX[3] - py) * s;
  const poly = pts => { ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b))); ctx.closePath(); };

  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(X(560), gy - p, VAN_LEN / 2 * p + 2 * p, 2.2 * p, 0, 0, TAU); ctx.fill();
  if (vanImg.complete && vanImg.naturalWidth) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(X(VAN_BOX[0]), Y(VAN_BOX[1])); ctx.scale(-1, 1);
    ctx.drawImage(vanImg, 0, 0, (VAN_BOX[2] - VAN_BOX[0]) * s, (VAN_BOX[3] - VAN_BOX[1]) * s);
    ctx.restore();
  }

  // the wheels' lug nuts turn while it drives
  if (moving) {
    ctx.fillStyle = 'rgba(40,42,50,.75)';
    for (const [wx, wy, r] of VAN_WHEELS) {
      for (let k = 0; k < 5; k++) {
        const a = van.spin + k * TAU / 5;
        ctx.beginPath(); ctx.arc(X(wx) + Math.cos(a) * r * 0.45 * s * 0.75, Y(wy) + Math.sin(a) * r * 0.45 * s, Math.max(0.8, r * 0.08 * s), 0, TAU); ctx.fill();
      }
    }
  }

  // the 1.3G placard on the cargo side
  if (placard.complete && placard.naturalWidth) {
    const ps = 12 * p, cx = X(790), cy = Y(405);
    // clip to the diamond so the image's white corners don't cover the van
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx, cy - ps / 2); ctx.lineTo(cx + ps / 2, cy); ctx.lineTo(cx, cy + ps / 2); ctx.lineTo(cx - ps / 2, cy); ctx.closePath();
    ctx.clip();
    ctx.drawImage(placard, cx - ps / 2, cy - ps / 2, ps, ps);
    ctx.restore();
  }

  // the driver's door swung open toward us on its front hinge
  const d = van.door;
  if (d > 0) {
    ctx.fillStyle = '#23232b'; poly(VAN_DOOR_SHAPE); ctx.fill();
    ctx.fillStyle = '#3d3d47'; poly([[630, 400], [560, 404], [560, 470], [630, 466]]); ctx.fill(); // seat
    // squeezed toward the hinge as it opens; the swinging edge grows a little as it comes toward us
    const c = Math.cos(d * 1.3), grow = 0.1 * (1 - c);
    const swing = pts => pts.map(([x, y]) => {
      const k = (x - VAN_DOOR.front) / (VAN_DOOR.rear - VAN_DOOR.front);
      return [VAN_DOOR.front + (x - VAN_DOOR.front) * c, 415 + (y - 415) * (1 + grow * k)];
    });
    ctx.fillStyle = '#dfe2e8'; ctx.strokeStyle = '#6e727c'; ctx.lineWidth = Math.max(1, p * 0.6);
    poly(swing(VAN_DOOR_SHAPE)); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b3442'; poly(swing(VAN_WINDOW)); ctx.fill();
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
    m.hidden = false; m.x = v.x + VAN_DOOR_X * p; m.dir = -1;
  }
  // his whippet leaps out right behind him
  if (arriveT >= 3.9 && dog.hidden) releaseDog(v.x + VAN_DOOR_X * p);
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

// ---------- Chuck, the showman, strolling the moon ----------
// Chuck is a cut-out photo, flipped when he faces left. His moods (walking,
// cheering, slumping, dancing, holding the Roman candle) are shown by how he moves rather than by
// separate drawings.
const CHUCK_COAT = '#ce4c42';
const CHUCK_W = 29.81, CHUCK_H = 80, CHUCK_TALL = 36;   // the box he's drawn in (arm positions use these units), and his height in game units
const chuckImg = new Image(); chuckImg.src = CHUCK_SRC;
const POSES = { walk0: 'walk0', walk1: 'walk1', cheer: 'cheer', slump: 'slump', candle: 'candle' };
const showman = { x: 0, dir: 1, anim: 0, pause: 0, walk: 3 + Math.random() * 4, t: 0, cue: null, moving: false, drawnX: 0,
  mood: 'walk', moodT: 0, pose: POSES.walk0, lift: 0, sink: 0, tappedShow: -1 };

// ---------- Chuck's arms: he conducts the show like an orchestra ----------
// His arms are cut from the same photo as the rest of him: an upper arm hinged at the shoulder and a
// forearm (with the hand) hinged at the elbow. Angles are measured from how they hang in the photo:
// the first swings the whole arm out to its side and up, the second bends the elbow further.
// The "front" arm holds the baton. His arms ease toward each pose rather than jumping to it.
const BATON = 10;
for (const arm of Object.values(CHUCK_ARMS)) for (const part of [arm.upper, arm.lower]) { part.img = new Image(); part.img.src = part.src; }

// The pose his arms are heading for: [shoulder, elbow] angles for each arm.
function chuckArmTargets() {
  const m = showman, t = m.t || 0, s = Math.sin;
  const beat = TAU * 0.9; // tempo for conducting, in radians a second
  let front, back, baton = true;
  if (m.mood === 'candle' && candle) {
    // holding the Roman candle out along the aim, the other hand up by his chest
    front = [localAngle(candle.aim), 0]; back = [0.3, 1.2 + 0.2 * s(t * 4)]; baton = false;
  } else if (m.pose === POSES.slump) {
    front = [0, 0]; back = [0, 0]; baton = false;
  } else if (m.mood === 'dance') {
    // the grand finale: big alternating sweeps
    front = [1.6 + 0.5 * s(t * 5), 0.5 + 0.3 * s(t * 5 + 1)];
    back = [1.6 - 0.5 * s(t * 5), 0.5 - 0.3 * s(t * 5 + 1)];
  } else if (m.pose === POSES.cheer) {
    front = [2.5 + 0.12 * s(t * 8), 0.2]; back = [2.5 - 0.12 * s(t * 8), 0.2];
  } else if (m.say) {
    // talking with his hands, held in front of him
    front = [0.4 + 0.12 * s(t * 3), 1.1 + 0.2 * s(t * 3 + 1)];
    back = [0.3, 0.9 + 0.15 * s(t * 3 + 2)];
  } else if (m.moving) {
    const sw = s(m.anim * TAU * 1.5);
    front = [0.12 * sw, 0.15]; back = [-0.12 * sw, 0.15];
  } else {
    // conducting toward the fireworks: the baton hand beats a small pattern, raised higher for bursts
    // overhead; the other hand rides along gently
    const f = m.focus ? localTarget(m.focus.x, m.focus.y) : 1.6;
    const up = Math.max(0, Math.min(1, (f - 1.2) / 1.5));   // 0 = out to the side, 1 = high overhead
    front = [0.55 + 0.5 * up + 0.18 * s(t * beat), 1.2 - 0.3 * up + 0.3 * s(t * beat * 2)];
    back = [0.35 + 0.25 * up + 0.12 * s(t * beat / 2 + 1), 1.0 + 0.2 * s(t * beat + 0.5)];
  }
  // a cue: a point of the baton at a burst the player just popped
  if (m.cue && m.mood !== 'candle') front = [localTarget(m.cue.x, m.cue.y), 0.1];
  return { front, back, baton };
}
// Ease his arms toward their target pose (quicker for a cue or the candle, which have to keep up).
function updateChuckArms(dt) {
  const m = showman, tg = chuckArmTargets();
  if (!m.arm) m.arm = { front: [0, 0], back: [0, 0] };
  const rate = (m.cue || m.mood === 'candle') ? 16 : 7, k = 1 - Math.exp(-rate * dt);
  for (const side of ['front', 'back']) for (const i of [0, 1]) m.arm[side][i] += (tg[side][i] - m.arm[side][i]) * k;
  m.arm.baton = tg.baton;
}
function chuckArms() {
  const m = showman;
  if (!m.arm) updateChuckArms(1);
  return m.arm;
}

// Turn a screen angle (0 = right, clockwise) into an arm angle for his front arm.
function localAngle(a) {
  let vx = Math.cos(a), vy = Math.sin(a);
  if (showman.dir < 0) vx = -vx;
  return Math.atan2(vx, vy);
}
// The front-arm angle that points from his shoulder at a spot on screen.
function localTarget(wx, wy) {
  const { left, top, k } = showmanBox(), [sx, sy] = CHUCK_ARMS.front.S;
  let lx = (wx - left) / k;
  if (showman.dir < 0) lx = CHUCK_W - lx;
  return Math.max(0.3, Math.min(3, Math.atan2(lx - sx, (wy - top) / k - sy)));
}

// Where an arm's elbow and hand are for the given angles, and how far each piece is turned.
function armJoints(side, [a1, a2]) {
  const arm = CHUCK_ARMS[side], out = side === 'front' ? 1 : -1;
  const r1 = -out * a1, r2 = -out * (a1 + a2);
  const turn = (vx, vy, r) => [vx * Math.cos(r) - vy * Math.sin(r), vx * Math.sin(r) + vy * Math.cos(r)];
  const [ux, uy] = turn(arm.E[0] - arm.S[0], arm.E[1] - arm.S[1], r1);
  const ex = arm.S[0] + ux, ey = arm.S[1] + uy;
  const [fx, fy] = turn(arm.Hd[0] - arm.E[0], arm.Hd[1] - arm.E[1], r2);
  return { arm, r1, r2, ex, ey, hx: ex + fx, hy: ey + fy, out };
}

// Where his front hand is on screen (the Roman candle sits in it).
function chuckHand() {
  const { left, top, k } = showmanBox(), j = armJoints('front', chuckArms().front);
  return { x: left + (showman.dir > 0 ? j.hx : CHUCK_W - j.hx) * k, y: top + j.hy * k };
}

// Draw one arm (already in Chuck's own coordinates): the two photo pieces turned about their joints.
function drawArm(side, angles, baton) {
  const j = armJoints(side, angles), arm = j.arm;
  if (!arm.upper.img.complete || !arm.lower.img.complete) return;
  const piece = (part, px, py, ox, oy, r) => {
    ctx.save(); ctx.translate(px, py); ctx.rotate(r); ctx.translate(-ox, -oy);
    ctx.drawImage(part.img, part.x, part.y, part.w, part.h);
    ctx.restore();
  };
  if (baton) {
    // the baton, held in his hand and carrying on from the forearm
    const a = Math.atan2(j.hy - j.ey, j.hx - j.ex) - 0.25 * j.out;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#f6f6f6'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(j.hx, j.hy); ctx.lineTo(j.hx + Math.cos(a) * BATON, j.hy + Math.sin(a) * BATON); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // a patch of sleeve at the elbow so no gap opens when it bends
  ctx.fillStyle = CHUCK_COAT; ctx.beginPath(); ctx.arc(j.ex, j.ey, 2.5, 0, TAU); ctx.fill();
  // and one at the shoulder, so a raised arm stays joined to his coat
  ctx.beginPath(); ctx.arc(arm.S[0] - j.out * 0.8, arm.S[1] + 0.6, 3.1, 0, TAU); ctx.fill();
  piece(arm.upper, arm.S[0], arm.S[1], arm.S[0], arm.S[1], j.r1);
  piece(arm.lower, j.ex, j.ey, arm.E[0], arm.E[1], j.r2);
}


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
  m.t += dt;
  if (m.cue && (m.cue.t -= dt) <= 0) m.cue = null;
  updateChuckArms(dt);
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
    faceTheShow(m);
    return;
  }
  m.x += m.dir * 14 * p * dt;
  if (m.x > W * 0.94) { m.x = W * 0.94; m.dir = -1; }
  if (m.x < W * 0.06) { m.x = W * 0.06; m.dir = 1; }
  m.anim += dt;
  m.pose = Math.floor(m.anim * 6) % 2 ? POSES.walk1 : POSES.walk0;
  m.walk -= dt;
  if (m.walk <= 0) {
    // during a show he spends most of his time standing and conducting
    const show = state === 'play' || state === 'intro' || state === 'finale';
    m.pause = show ? 2 + Math.random() * 3 : 0.6 + Math.random() * 1.4;
    m.walk = show ? 1 + Math.random() * 2.5 : 2 + Math.random() * 5;
    if (Math.random() < 0.4) m.dir *= -1;
  }
}

// Where the fireworks are: the middle of the rockets in the air, or else the latest burst for a
// couple of seconds after it goes off.
function fireworksFocus() {
  let n = 0, x = 0, y = 0;
  for (const r of rockets) if (!r.dead && r.kind !== 'salute') { x += r.x; y += r.y; n++; }
  if (n) return { x: x / n, y: y / n };
  const b = showman.lastBurst;
  return b && time - b.at < 2.5 ? b : null;
}
// While he stands and conducts, he turns to face the fireworks (only once they're clearly on his
// other side, so he doesn't flicker back and forth).
function faceTheShow(m) {
  m.focus = fireworksFocus();
  if (m.focus && (m.focus.x - m.x) * m.dir < -W * 0.06) m.dir *= -1;
}

function showmanBox() {
  const m = showman, p = pixelSize(), k = CHUCK_TALL * p / CHUCK_H;
  const w = CHUCK_W * k, h = CHUCK_H * k;
  const left = Math.round(m.x - w / 2);
  const bob = m.pose === POSES.walk1 ? -p : 0;
  const top = Math.round(horizon(m.x) + 4 - h + bob - m.lift + m.sink);
  return { left, top, w, h, p, k };
}

function drawShowman() {
  if (showman.hidden) return;
  const m = showman, { left, top, w, h, p, k } = showmanBox();
  m.moving = Math.abs(m.x - m.drawnX) > 0.01; m.drawnX = m.x;
  const arms = chuckArms();
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(m.x, horizon(m.x) + 4, w * 0.5, 1.5 * p, 0, 0, TAU); ctx.fill();
  if (chuckImg.complete && chuckImg.naturalWidth) {
    ctx.save();
    // slumped: leaning forward a little from his feet
    if (m.pose === POSES.slump) { ctx.translate(m.x, top + h); ctx.rotate(0.12 * m.dir); ctx.translate(-m.x, -(top + h)); }
    // swaying a little to the beat while he conducts
    if (!m.moving && !m.say && m.mood === 'walk') { ctx.translate(m.x, top + h); ctx.rotate(0.03 * Math.sin(m.t * TAU * 0.8)); ctx.translate(-m.x, -(top + h)); }
    if (m.dir < 0) { ctx.translate(left + w, top); ctx.scale(-1, 1); } else ctx.translate(left, top);
    ctx.scale(k, k);
    ctx.drawImage(chuckImg, 0, 0, CHUCK_W, CHUCK_H);
    drawArm('back', arms.back, false);
    drawArm('front', arms.front, arms.baton);
    ctx.restore();
  }
  // a bead of sweat when he's slumped
  if (m.pose === POSES.slump) {
    ctx.fillStyle = '#8fd4ff';
    const sx = m.x + m.dir * w * 0.42, sy = top + h * 0.12 + (time * 30 % 8);
    ctx.beginPath(); ctx.arc(sx, sy, p * 0.9, 0, TAU); ctx.fill();
  }
  if (m.say) drawSpeech(m.say.text, m.x, top - 8);
}

// ---------- Chuck's whippet: rides along in the van, does zoomies and leaves little surprises ----------
// The whippet is a pixel-art sprite facing right (flipped when she runs left). Her gait and moods are
// shown by movement: a stretching, bobbing gallop, leaning back to squat, dipping her head to sniff.
const DOG_W = 45, DOG_H = 40, DOG_TALL = 16;   // sprite size in pixels, and her height in units
const dogImg = new Image(); dogImg.src = DOG_SRC;
const DOG_POSES = { stand: 'stand', stretch: 'stretch', gather: 'gather', squat: 'squat' };
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
    const tx = d.peek < 0 ? van.x + 5 * p : van.x + VAN_LEN / 2 * p;
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
  if (playing()) gs.poops++;
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
  const d = dog, p = pixelSize(), k = DOG_TALL * p / DOG_H;
  const w = DOG_W * k, h = DOG_H * k;
  const bob = d.pose === DOG_POSES.stretch ? -p : 0;
  return { left: Math.round(d.x - w / 2), top: Math.round(horizon(d.x) + 4 - h + bob), w, h, p };
}

function tapDog() {
  dogMode('zoom', 2);
  gs.pets++;
  addStat('pets', 1);
  texts.push({ x: dog.x, y: dogBox().top - 6, txt: 'Woof!', color: '#ffd86b', life: 1 });
}

function drawPoops() {
  const p = pixelSize();
  for (const s of poops) {
    const top = Math.round(horizon(s.x) + 4 - 3 * p), gy = top + 3 * p;
    // a little coiled pile: three rounded tiers, shaded, with a highlight
    for (const [w, y, col] of [[2.6, 0.55, '#3e2612'], [1.8, 1.45, '#5a3a1e'], [1.0, 2.3, '#6b4726']]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(s.x, gy - y * p, w * p, 0.7 * p, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#6b4726'; ctx.beginPath(); ctx.arc(s.x + 0.2 * p, gy - 2.9 * p, 0.45 * p, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(190,150,100,.55)'; ctx.beginPath(); ctx.ellipse(s.x - 0.8 * p, gy - 1.6 * p, 0.5 * p, 0.2 * p, -0.3, 0, TAU); ctx.fill();
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
  if (dog.hidden || !dogImg.complete || !dogImg.naturalWidth) return;
  const d = dog, { left, top, w, h, p } = dogBox();
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(d.x, horizon(d.x) + 4, w * 0.45, 1.2 * p, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // work facing right: x runs from her tail (0) to her nose (w), y from her ears (0) to her paws (h)
  if (d.dir < 0) { ctx.translate(left + w, top); ctx.scale(-1, 1); } else ctx.translate(left, top);
  const pivot = (px, py, ang) => { ctx.translate(px, py); ctx.rotate(ang); ctx.translate(-px, -py); };
  if (d.pose === DOG_POSES.stretch) { pivot(w / 2, h, -0.05); ctx.translate(-w * 0.03, h * 0.06); ctx.scale(1.06, 0.94); }
  else if (d.pose === DOG_POSES.gather) { pivot(w / 2, h, 0.05); ctx.translate(w * 0.025, -h * 0.04); ctx.scale(0.95, 1.04); }
  else if (d.pose === DOG_POSES.squat) { pivot(w * 0.8, h, -0.22); ctx.translate(0, h * 0.06); }
  else if (d.mode === 'sniff') pivot(w * 0.15, h, Math.floor(d.anim * 4) % 2 ? 0.12 : 0.04);
  ctx.drawImage(dogImg, 0, 0, w, h);
  ctx.restore();
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
