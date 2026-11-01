// Moon Fireworks: game state, shows, the Roman candle break and rockets.

// ---------- game state ----------
const MAX_LIVES = 5;
const SHOWS = [
  { name: 'Sea of Tranquility', target: 300 },
  { name: 'Copernicus Crater', target: 450 },
  { name: 'Ocean of Storms', target: 650 },
  { name: 'Tycho Crater', target: 900 },
  { name: 'Sea of Serenity', target: 1200 },
  { name: 'Apennine Mountains', target: 1600 },
];
function showInfo(i) {
  if (i < SHOWS.length) return SHOWS[i];
  const n = i - SHOWS.length + 1;
  return { name: 'Encore #' + n, target: Math.round(1600 * Math.pow(1.3, n) / 50) * 50 };
}

let state = 'menu', paused = false;
let rockets = [], particles = [], texts = [], ripples = [];
let score = 0, lives = MAX_LIVES, streak = 0, showIdx = 0, showScore = 0, showTime = 0;
let spawnTimer = 0, introT = 0, finaleT = 0, slowT = 0, banner = null;
let candle = null, candleAt = Infinity;
let flash = 0, shake = 0, time = 0;
let best = +store.get('moonFireworksBest', 0) || 0;
let firstHint = store.get('mfPlayed', '0') !== '1';

const playing = () => ['arrive', 'intro', 'play', 'finale', 'candle', 'swarm'].includes(state);

function showOverlay(id) {
  for (const o of ['menu', 'help', 'board', 'pause', 'over', 'effects', 'ach']) $(o).classList.toggle('hidden', o !== id);
}

// On phones and tablets, go fullscreen so the browser bars don't eat into the sky.
// (iPhone Safari can't do this; adding the page to the Home Screen opens it fullscreen instead.)
function goFullscreen() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  try {
    const req = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    if (req && req.catch) req.catch(() => {});
  } catch (e) {}
}

function startGame() {
  goFullscreen();
  audio();
  rockets = []; particles = []; texts = []; ripples = []; cameo = null; goals.kinds = new Set();
  gazer = null; gazerShow = -1;
  goals.game = { chuckShows: new Set(), poops: 0 };
  clearDrones(); droneIn = 25 + Math.random() * 35;
  score = 0; lives = MAX_LIVES; streak = 0; showIdx = 0; slowT = 0; paused = false;
  candle = null; swarm = null; showman.mood = 'walk'; showman.say = null; showman.tappedShow = -1;
  shortcutUsed = false; goals.newThisGame = [];
  showOverlay(null);
  $('hud').classList.remove('hidden');
  startArrival();
  updateHud();
}

function beginShow() {
  const info = showInfo(showIdx);
  goals.show = { lostHeart: false, dud: false };
  if (showIdx >= 3) unlock('earthfire');
  const hour = new Date().getHours();
  if (hour < 4) unlock('nightowl');
  state = 'intro'; introT = 2.6; showScore = 0; showTime = 0;
  // Most shows (always the first) take a Roman candle break somewhere in the middle.
  candleAt = showIdx === 0 || Math.random() < 0.7 ? info.target * (0.35 + Math.random() * 0.25) : Infinity;
  banner = { title: 'Show ' + (showIdx + 1), sub: info.name, sub2: 'Target: ' + info.target + ' points', t: 2.6, dur: 2.6 };
  react('cheer', 1);
  if (showIdx === 3) texts.push({ x: W / 2, y: H * 0.62, txt: "Uh oh... the Earth's on fire!", color: '#ff9a3a', life: 3, big: true });
  updateHud();
}

function startFinale() {
  if (!goals.show.lostHeart) unlock('flawless');
  if (showIdx >= 1 && !goals.show.dud) unlock('dodger');
  if (lives === 1) unlock('gasp');
  state = 'finale'; finaleT = 7; spawnTimer = 0;
  banner = { title: 'GRAND FINALE!', sub: showInfo(showIdx).name + ' complete', t: 2.6, dur: 2.6 };
  react('dance', 7);
  buzz([30, 50, 30, 50, 60]);
  updateHud();
}

// ---------- Roman candle break ----------
// Chuck stops and holds out a Roman candle. Tap the sky to aim: he swings the candle toward the
// tap and fires a star that flies there. Drones fly across as targets: during the break they're
// fair game, and each one shot down is worth points. Between shots the tube sprays sparks, like a real candle. Each break uses one of a few
// candle types. Candle points go to the score but not toward the show's target.
const CANDLE_TIME = 14, CANDLE_SHOT_POINTS = 10;
const CANDLE_TYPES = [
  { name: 'Classic Candle', shots: 15, cool: 0.22, speed: 1, size: 5, finale: 'crackle',
    hue: i => [0, 120, 220, 45][i % 4] },
  { name: 'Thunder Candle', shots: 8, cool: 0.45, speed: 0.9, size: 7, finale: 'report', burst: true,
    hue: i => i % 2 ? 0 : 50, sat: i => i % 2 ? 100 : 20 },
  { name: 'Rainbow Candle', shots: 25, cool: 0.1, speed: 1.1, size: 4, finale: 'crackle',
    hue: i => i * 25 % 360 },
  { name: 'Comet Candle', shots: 12, cool: 0.3, speed: 0.8, size: 5, finale: 'crackle', comet: true,
    hue: () => 42, sat: () => 60 },
];
const CANDLE_DRONE_POINTS = 100;
const CANDLE_NAGS = ["C'mon, light me up!", 'Tap the sky!', "Don't leave me hanging!"];

function startCandle() {
  state = 'candle';
  const m = showman;
  m.dir = m.x < W / 2 ? 1 : -1;
  m.mood = 'candle';
  const type = CANDLE_TYPES[Math.floor(Math.random() * CANDLE_TYPES.length)];
  candle = { type, shots: 0, cool: 0, timeLeft: CANDLE_TIME, aim: -Math.PI / 2 + m.dir * 0.4, kick: 0, done: 0,
    t: 0, idle: 0, stars: [], targets: [], smoke: [], fountain: 0, downed: 0, hitShots: 0 };
  // a stray drone already in the sky becomes a target too, rather than a 1,000-point trap
  for (const d of drones) if (!d.hit) {
    stopDroneSound(d);
    candle.targets.push({ x: d.x, y: d.y, baseY: d.baseY, dir: d.dir, s: d.s, t: d.t, speed: d.speed, r: 18 * d.s });
  }
  drones = drones.filter(d => d.hit);
  banner = { title: type.name + '!', sub: 'Tap the sky to aim · ' + type.shots + ' shots',
    sub2: 'Shoot down the drones for ' + CANDLE_DRONE_POINTS, t: 2.4, dur: 2.4 };
  updateHud();
}

function candleActive() { return candle && candle.shots < candle.type.shots && candle.timeLeft > 0; }

// Where Chuck's hand is and where the tube's mouth points.
function candleMuzzle() {
  const c = candle, { left, top, p } = showmanBox();
  const hx = left + (showman.dir > 0 ? 23 : 1) * p, hy = top + 15 * p;
  const len = (11 - c.kick * 3) * p;
  return { hx, hy, mx: hx + Math.cos(c.aim) * len, my: hy + Math.sin(c.aim) * len, p };
}

// Tap the sky: Chuck turns toward the tap if he has to, aims and fires a star at it.
function candleShoot(x, y) {
  const c = candle;
  if (!candleActive() || c.cool > 0) return;
  const m = showman;
  if ((x - m.x) * m.dir < 0) m.dir *= -1;
  let { hx, hy } = candleMuzzle();
  let a = Math.atan2(y - hy, x - hx);
  // only upward, at least a little above flat
  if (a > -0.35) a = m.dir > 0 ? -0.35 : -Math.PI + 0.35;
  if (a < -Math.PI + 0.35) a = -Math.PI + 0.35;
  c.aim = a;
  const { mx, my } = candleMuzzle();
  const i = c.shots++, ty = c.type, sp = Math.max(W, H) * 0.95 * ty.speed;
  const dist = Math.max(40, Math.hypot(x - mx, y - my));
  c.stars.push({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, end: dist / sp,
    h: ty.hue(i), sat: ty.sat ? ty.sat(i) : 100, size: ty.size, last: c.shots === ty.shots });
  c.cool = ty.cool; c.kick = 1; c.idle = 0; c.fountain = 0.25;
  for (let k = 0; k < 4; k++) c.smoke.push({ x: mx, y: my, vx: Math.cos(a) * 20 + (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 15,
    r: 4 + Math.random() * 4, life: 1 });
  score += CANDLE_SHOT_POINTS;
  flash = Math.min(1, flash + 0.04);
  candleThump(); buzz(10);
  // the dog has had enough after the first bang
  if (i === 0 && !dog.hidden && van && van.parked) { dog.hide = true; dog.peek = 2; }
  updateHud();
}

// A drone flying across the sky at its own height and speed; some are much quicker than others.
function spawnCandleTarget() {
  const dir = Math.random() < 0.5 ? 1 : -1, s = droneScale();
  const y = skyTop + 20 + Math.random() * Math.max(10, groundY * 0.5 - skyTop);
  return { x: dir > 0 ? -40 * s : W + 40 * s, y, baseY: y, dir, s, t: Math.random() * 10,
    speed: Math.max(50, W / 8) * (0.6 + Math.random() * 0.9), r: 18 * s };
}

function updateCandle(dt) {
  const c = candle, ty = c.type;
  c.t += dt;
  c.kick = Math.max(0, c.kick - dt * 6);
  c.cool -= dt;
  const active = candleActive();
  if (active) {
    c.timeLeft -= dt;
    c.idle += dt;
    if (c.idle > 3 && c.t > 3) {
      c.idle = -2;
      texts.push({ x: showman.x, y: showmanBox().top - 70, txt: CANDLE_NAGS[Math.floor(Math.random() * CANDLE_NAGS.length)], color: '#fff', life: 1.6 });
    }
    // targets: keep a few drifting through once the banner has gone
    const want = ty.shots > 20 ? 4 : 3;
    if (c.t > 1.2 && c.targets.length < want && Math.random() < dt * 2) c.targets.push(spawnCandleTarget());
  }
  for (const g of c.targets) {
    g.t += dt; g.x += g.dir * g.speed * dt;
    g.y = g.baseY + Math.sin(g.t * 1.7) * 8 * g.s;
    if ((g.dir > 0 && g.x > W + 50 * g.s) || (g.dir < 0 && g.x < -50 * g.s)) g.gone = true;
  }
  // between shots the tube sprays a fountain of sparks
  if (active || c.stars.length) {
    c.fountain = Math.max(0, c.fountain - dt);
    const rate = (active ? 30 : 8) + c.fountain * 160;
    const { mx, my } = candleMuzzle();
    for (let k = 0; k < rate * dt; k++) {
      const a = c.aim + (Math.random() - 0.5) * 0.6, s = 60 + Math.random() * 110;
      particles.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(a) * s, vy: Math.sin(a) * s, h: 38, sat: 90,
        life: 0.35 + Math.random() * 0.2, decay: 1.6, size: 1.2, gm: 3, glitter: true });
    }
  }
  for (const s of c.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; s.r += 10 * dt; s.life -= dt * 0.6; }
  c.smoke = c.smoke.filter(s => s.life > 0);
  for (const st of c.stars) {
    st.t += dt;
    st.vy += H * 0.05 * dt;
    st.x += st.vx * dt; st.y += st.vy * dt;
    // tail
    const n = ty.comet ? 3 : 1.5;
    for (let k = 0; k < n; k++) particles.push({ x: st.x, y: st.y, px: st.x, py: st.y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
      h: st.h, sat: st.sat, life: ty.comet ? 0.9 : 0.45, decay: 1.4, size: ty.comet ? 1.8 : 1.4, glitter: !!ty.comet });
    const hit = c.targets.find(g => !g.gone && Math.hypot(g.x - st.x, g.y - st.y) < g.r + st.size + 4);
    if (hit) { popCandleTarget(hit); st.gone = true; candleStarEnd(st, true); continue; }
    if (st.t >= st.end || st.y < 0 || st.x < 0 || st.x > W) { st.gone = true; candleStarEnd(st, false); }
  }
  c.stars = c.stars.filter(s => !s.gone);
  c.targets = c.targets.filter(g => !g.gone);
  if (!active && !c.stars.length) {
    c.done += dt;
    if (c.done > 1.8) endCandle();
  }
}

// What a star does when it's done: thunder stars burst (and take out targets nearby), the last
// shot of every candle ends with a crackle or a big report, the rest just burn out.
function candleStarEnd(st, hit) {
  const ty = candle.type;
  // drones taken out by this star's burst, for Thunderstruck and Bullseye
  let n = 0;
  const blast = r => { for (const g of candle.targets) if (!g.gone && Math.hypot(g.x - st.x, g.y - st.y) < r) { popCandleTarget(g); n++; } };
  const done = () => {
    if (ty.burst && n + (hit ? 1 : 0) >= 2) unlock('thunder');
    if (hit || n > 0) candle.hitShots++;
  };
  if (st.last) {
    if (ty.finale === 'report') candleBurst(st.x, st.y, 1.1);
    else { shell(st.x, st.y, 'crackle', st.h, 0.8); }
    blast(70);
    return done();
  }
  if (ty.burst) {
    candleBurst(st.x, st.y, 0.75);
    blast(55);
    return done();
  }
  done();
  if (!hit) for (let k = 0; k < 8; k++) {
    const a = Math.random() * TAU, v = 20 + Math.random() * 40;
    particles.push({ x: st.x, y: st.y, px: st.x, py: st.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, h: st.h, sat: st.sat,
      life: 0.4, decay: 1.6, size: 1.4, glitter: true });
  }
}

// A drone shot down: sparks, and it spins down and crashes like a tapped stray drone does.
function popCandleTarget(g) {
  if (g.gone) return;
  g.gone = true;
  score += CANDLE_DRONE_POINTS;
  candle.downed++;
  addStat('targets', 1);
  if (candle.downed >= 5) unlock('sweep');
  texts.push({ x: g.x, y: g.y - 10, txt: '+' + CANDLE_DRONE_POINTS + ' DRONE DOWN', color: '#fff', life: 1.3 });
  for (let k = 0; k < 22; k++) {
    const a = Math.random() * TAU, v = 30 + Math.random() * 90;
    particles.push({ x: g.x, y: g.y, px: g.x, py: g.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, h: 25 + Math.random() * 25, sat: 100,
      life: 0.7, decay: 1.2, size: 2, gm: 2, glitter: true });
  }
  drones.push({ x: g.x, y: g.y, baseY: g.y, dir: g.dir, s: g.s, t: g.t, speed: g.speed, hit: true, vy: -60, spin: 0, sound: null });
  crashSound(); buzz(25);
  react('cheer', 0.6);
  updateHud();
}

// A salute-style burst for thunder stars: white flash, bang and a red or white burst.
function candleBurst(x, y, scale) {
  const hue = [0, 355, 0][Math.floor(Math.random() * 3)];
  shell(x, y, ['peony', 'ring', 'chrysanthemum'][Math.floor(Math.random() * 3)], hue, scale);
  particles.push({ x, y, px: x, py: y, vx: 0, vy: 0, h: 50, sat: 10, lit: 95, life: 0.3, decay: 3, size: 14, glow: true, glitter: false });
  flash = Math.min(1, flash + 0.18); shake = Math.max(shake, 3);
  reportSound();
}

function endCandle() {
  if (candle.hitShots >= candle.type.shots) unlock('bullseye');
  candle = null;
  showman.mood = 'walk';
  react('cheer', 1.2);
  if (dog.hide) { dog.hide = false; dogMode('zoom', 1.5); }
  if (showScore >= showInfo(showIdx).target) return startFinale();
  state = 'play'; spawnTimer = 0.6;
  updateHud();
}

function drawCandle() {
  if (!candle) return;
  const c = candle;
  // targets
  for (const g of c.targets) drawDrone(g);
  // smoke drifts up from the tube
  for (const s of c.smoke) {
    ctx.fillStyle = `rgba(190,190,200,${s.life * 0.28})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  // the stars: glowing balls
  for (const st of c.stars) {
    const r = st.size * 2.2, g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.3, `hsla(${st.h},${st.sat}%,65%,1)`); g.addColorStop(1, `hsla(${st.h},${st.sat}%,55%,0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(st.x, st.y, r, 0, TAU); ctx.fill();
  }
  // the tube
  const { hx, hy, mx, my, p } = candleMuzzle();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3 * p;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mx, my); ctx.stroke();
  ctx.strokeStyle = '#2f6fe0'; ctx.lineWidth = 2 * p;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mx, my); ctx.stroke();
  ctx.strokeStyle = '#ffd86b';
  for (const t of [0.35, 0.7]) {
    const x = hx + (mx - hx) * t, y = hy + (my - hy) * t, dx = (mx - hx) * 0.06, dy = (my - hy) * 0.06;
    ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  }
  if (c.kick > 0) {
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 10 * p * c.kick);
    g.addColorStop(0, 'rgba(255,240,180,.95)'); g.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 10 * p * c.kick, 0, TAU); ctx.fill();
  }
  // prompt with the shots left as glowing dots
  if (candleActive() && !paused) {
    const b = showmanBox(), cx = b.left + b.w / 2;
    ctx.font = '800 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    const label = 'Tap the sky to aim! · ' + Math.ceil(c.timeLeft) + 's';
    const half = ctx.measureText(label).width / 2 + 6, lx = Math.max(half, Math.min(W - half, cx));
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(label, lx, b.top - 42);
    ctx.fillStyle = '#ffd86b'; ctx.fillText(label, lx, b.top - 42);
    const n = c.type.shots, gap = n > 15 ? 6 : 9, w = (n - 1) * gap, dx0 = Math.max(8, Math.min(W - 8 - w, cx - w / 2));
    for (let i = 0; i < n; i++) {
      const on = i < n - c.shots;
      ctx.fillStyle = on ? `hsla(${c.type.hue(n - 1 - i)},100%,65%,1)` : 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(dx0 + i * gap, b.top - 28, on ? 2.6 : 2, 0, TAU); ctx.fill();
    }
  }
}


function endFinale() {
  if (lives < MAX_LIVES) {
    lives++;
    texts.push({ x: W / 2, y: H * 0.5, txt: 'Bonus +1 ♥', color: '#ff7aa8', life: 1.6, big: true });
  }
  showIdx++;
  if (showIdx >= 3) unlock('show3');
  if (showIdx >= 6) unlock('encore');
  if (showIdx === SWARM_AFTER_SHOW) return startSwarm();
  beginShow();
}

function gameOver() {
  addStat('games', 1, true);
  addStat('total', score, true);
  state = 'over'; paused = false; slowT = 0;
  store.set('mfPlayed', '1'); firstHint = false;
  showman.mood = 'walk';
  showman.dir = showman.x < W / 2 ? 1 : -1;
  showman.say = { text: 'I love every damn one of you.', t: 0 };
  $('goalsLine').textContent = shortcutUsed ? '' : (goals.newThisGame.length ? '🏆 New: ' + goals.newThisGame.join(', ') + ' · ' : '') +
    'Effects ' + goals.seen.length + '/' + SHELL_TYPES.length + ' · Achievements ' + achCount() + '/' + ACHIEVEMENTS.length;
  if (shortcutUsed) {
    $('best').textContent = 'Shortcut game: score not saved';
  } else if (score > best) {
    best = score;
    store.set('moonFireworksBest', best);
    $('best').textContent = 'New personal best!';
  } else {
    $('best').textContent = 'Your best: ' + best;
  }
  $('final').textContent = 'Score: ' + score;
  $('reached').textContent = 'You made it to Show ' + (showIdx + 1) + ': ' + showInfo(showIdx).name;
  $('nameIn').value = store.get('mfName', '');
  $('postForm').style.display = score > 0 && !shortcutUsed ? '' : 'none';
  $('postBtn').disabled = false;
  setStatus('', null);
  loadScores($('overList'));
  setTimeout(() => {
    if (state !== 'over') return;
    showOverlay('over');
    $('hud').classList.add('hidden');
  }, 3200);
  updateHud();
}

function setPaused(v) {
  if (!playing()) return;
  paused = v;
  muteEngine(v);
  muteDrones(v);
  showOverlay(v ? 'pause' : null);
}

function multiplier() { return 1 + Math.floor(streak / 10); }

let hudSlow = -1;
function updateHud() {
  $('score').textContent = 'Score ' + score;
  $('lives').textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, MAX_LIVES - lives));
  const info = showInfo(showIdx);
  $('showName').textContent = state === 'swarm' ? 'Intermission · Drone show' : 'Show ' + (showIdx + 1) + ' · ' + info.name;
  $('barFill').style.width = (state === 'finale' ? 100 : Math.min(100, showScore / info.target * 100)) + '%';
  const m = multiplier();
  const parts = [];
  if (m > 1) parts.push('x' + m + ' streak!'); else if (streak > 1) parts.push(streak + ' in a row');
  hudSlow = slowT > 0 ? Math.ceil(slowT) : -1;
  if (hudSlow > 0) parts.push('⏱ slow-mo ' + hudSlow + 's');
  $('mult').textContent = playing() ? parts.join('  ·  ') : '';
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
  $('musicBtn').classList.toggle('off', !musicOn);
}

// ---------- rockets ----------
const KIND = {
  normal: { base: 10 },
  gold:   { base: 50, hue: 45,  sym: '★' },
  heart:  { base: 10, hue: 335, sym: '♥' },
  utah:   { base: 100, hue: 355, sym: 'U', lit: 40 },
  byu:    { base: 100, hue: 218, sym: 'Y', lit: 62 },  // bright blue, bursts into the oval Y
  dud:    { base: 0,  hue: 0,   sym: '✕', sat: 0, lit: 60 },
  stage2: { base: 10, hue: 185, sym: '2' },
  slow:   { base: 10, hue: 210, sym: 'clock' },
  mega:   { base: 25, hue: 280, sym: 'burst' },
  mini:   { base: 15 },
  salute: { base: 0, hue: 0, lit: 50 },   // the red celebration volley after a U; just for show
};
const special = r => r.kind !== 'normal' && r.kind !== 'mini' && r.kind !== 'salute';

function level() { return showIdx + showTime / 45; }
function flightTime() {
  if (state === 'finale') return 2.3;
  if (state !== 'play') return 2.4;
  return Math.max(1.0, 2.6 - level() * 0.2);
}

// The dark red U and bright blue Y are the rarest: about 1 rocket in 80 each during play.
function pickKind() {
  if (state === 'finale') return Math.random() < 0.08 ? 'gold' : Math.random() < 0.01 ? 'utah' : Math.random() < 0.01 ? 'byu' : 'normal';
  if (state !== 'play') return Math.random() < 0.05 ? 'gold' : Math.random() < 0.008 ? 'utah' : 'normal';
  const later = showIdx >= 1;
  const table = [['utah', .0125], ['byu', .0125], ['gold', .07], ['heart', lives < MAX_LIVES ? .04 : 0],
    ['dud', later ? .08 : 0], ['stage2', later ? .06 : 0], ['slow', .025], ['mega', .02]];
  let roll = Math.random();
  for (const [k, p] of table) { if (roll < p) return k; roll -= p; }
  return 'normal';
}

// ---------- the portrait cameo after a Y burst ----------
// A painted portrait, cut out from its background and drawn pixelated, slides and tilts in from the right, says "Go Utes!",
// holds for a moment and swings back out.
const cameoImg = new Image();
cameoImg.src = CAMEO_SRC;
let cameo = null;
function startCameo() {
  if (cameo) { cameo.t = Math.min(cameo.t, 0.7); return; }
  cameo = { t: 0 };
}
function updateCameo(dt) {
  if (!cameo) return;
  cameo.t += dt;
  if (cameo.t > 4.3) cameo = null;
}
function drawCameo() {
  if (!cameo || !cameoImg.complete || !cameoImg.naturalWidth) return;
  const t = cameo.t, IN = 0.7, OUT = 3.6;
  // 0 = off to the right, 1 = leaning in
  const ease = k => 1 - Math.pow(1 - k, 3);
  const k = t < IN ? ease(t / IN) : t < OUT ? 1 : 1 - ease(Math.min(1, (t - OUT) / 0.7));
  const ph = Math.min(H * 0.5, W * 0.72, 440), pw = ph / 1.8;
  const cx = W + pw * 0.75 - k * pw * 1.15, cy = groundY - ph * 0.55;
  const ang = 0.45 - k * 0.6; // ends tilted toward the middle of the screen
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(ang);
  // a faint moonlit glow around him so his dark suit doesn't vanish into the night sky
  ctx.shadowColor = 'rgba(170,195,255,.45)'; ctx.shadowBlur = 14;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cameoImg, -pw / 2, -ph / 2, pw, ph);
  ctx.imageSmoothingEnabled = true;
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  // where his mouth is, in screen coordinates
  const mx = -pw * 0.02, my = -ph * 0.21;
  const sx = cx + mx * Math.cos(ang) - my * Math.sin(ang), sy = cy + mx * Math.sin(ang) + my * Math.cos(ang);
  ctx.restore();
  if (t > IN * 0.8 && t < OUT + 0.2) drawSpeech('Go Utes!', Math.max(70, sx - pw * 0.55), sy - ph * 0.12);
}

function spawnRocket() {
  const x = W * 0.08 + Math.random() * W * 0.84;
  const apex = skyTop + Math.random() * Math.max(groundY * 0.2, groundY * 0.55 - skyTop);
  launch(x, horizon(x), apex, flightTime() * (0.85 + Math.random() * 0.3), (Math.random() - 0.5) * W * 0.04, pickKind());
}

function launch(x, y, apexY, t, vx, kind) {
  const g = 2 * (y - apexY) / (t * t);
  const k = KIND[kind];
  rockets.push({ x, y, vx, vy: -g * t, g, kind, hue: k.hue !== undefined ? k.hue : Math.random() * 360,
    trail: [], pending: null, chain: 0, dead: false, size: kind === 'mini' ? 0.65 : 1 });
  if (state === 'play' && Math.random() < 0.35) whistle(Math.min(t, 1.3));
}

function rcol(r, a, lit) {
  const k = KIND[r.kind];
  return `hsla(${r.hue},${k.sat !== undefined ? k.sat : 100}%,${lit || k.lit || 68}%,${a})`;
}

function addPoints(pts) {
  score += pts;
  if (state === 'play' || state === 'candle') showScore += pts;
  if (state === 'play' && showScore >= showInfo(showIdx).target) startFinale();
}

function pop(r, chain) {
  if (r.dead) return;
  r.dead = true;
  const live = state === 'play' || state === 'finale' || state === 'candle';
  if (r.kind === 'dud') {
    puff(r.x, r.y, 24);
    if (!live) return;
    score = Math.max(0, score - 25); streak = 0; shake = 6;
    goals.show.dud = true;
    texts.push({ x: r.x, y: r.y, txt: 'DUD! -25', color: '#c0c0c8', life: 1.1 });
    fizzleSound(); buzz(70); react('slump', 0.9);
    updateHud();
    return;
  }
  const shellName = explode(r);
  if (!live) return;
  noteEffect(shellName);
  unlock('first');
  if (chain >= 2) unlock('chain3');
  if (r.kind === 'utah') unlock('utes');
  goals.kinds.add(r.kind);
  if (chain >= 4) unlock('chain5');
  if (slowT > 0 && r.kind !== 'slow' && ++goals.slowPops >= 10) unlock('slowhands');
  if (goals.kinds.has('utah') && goals.kinds.has('byu')) unlock('holywar');

  streak++;
  const pts = KIND[r.kind].base * (chain + 1) * multiplier();
  addPoints(pts);
  let label = '+' + pts + (shellName ? ' ' + shellName : '');
  if (chain > 0) label += ' · CHAIN x' + (chain + 1);
  texts.push({ x: r.x, y: r.y, txt: label, color: r.kind === 'gold' ? '#ffd86b' : r.kind === 'utah' ? '#ff4a4a' : '#fff', life: 1 });
  buzz(special(r) ? 35 : 12);

  switch (r.kind) {
    case 'heart':
      if (lives === 1) unlock('comeback');
      if (lives < MAX_LIVES) {
        lives++;
        texts.push({ x: r.x, y: r.y + 24, txt: '+1 ♥', color: '#ff7aa8', life: 1.2 });
      }
      break;
    case 'byu':
      startCameo();
      react('dance', 2.5);
      break;
    case 'utah':
      texts.push({ x: r.x, y: r.y - 30, txt: 'GO UTES!', color: '#ff3b3b', life: 1.6, big: true });
      react('dance', 2.5);
      redSalute();
      break;
    case 'gold': react('cheer', 1); break;
    case 'slow':
      slowT = 6; goals.slowPops = 0;
      texts.push({ x: W / 2, y: H * 0.36, txt: 'SLOW-MO!', color: '#7fc4ff', life: 1.4, big: true });
      break;
    case 'stage2': splitRocket(r); break;
    case 'mega': megaBurst(r, chain); break;
  }
  if (chain >= 1) react('cheer', 1.2);
  if (multiplier() >= 4) unlock('streak');
  if (score >= 5000) unlock('big');
  if (streak % 10 === 0) {
    texts.push({ x: W / 2, y: H * 0.3, txt: 'x' + multiplier() + ' STREAK!', color: '#ffd86b', life: 1.5, big: true });
  }

  // set off neighbours
  const R = Math.max(70, Math.min(W, H) * 0.12);
  for (const o of rockets) {
    if (o.dead || o.pending !== null || o.kind === 'dud' || o.kind === 'salute') continue;
    if (Math.hypot(o.x - r.x, o.y - r.y) < R) { o.pending = 0.12; o.chain = chain + 1; }
  }
  updateHud();
}

function splitRocket(r) {
  texts.push({ x: r.x, y: r.y + 22, txt: 'SPLIT!', color: '#7ff0ff', life: 1 });
  for (let i = -1; i <= 1; i++) {
    const t = 0.75 + Math.random() * 0.3;
    const apex = Math.max(skyTop, r.y - H * (0.1 + Math.random() * 0.08));
    launch(r.x, r.y, apex, t, i * W * 0.09 + (Math.random() - 0.5) * 20, 'mini');
  }
}

// Six red rockets go up from evenly spaced spots along the ground and burst one after
// another, left to right.
function redSalute() {
  for (let i = 0; i < 6; i++) {
    const x = W * (i + 0.5) / 6;
    const apex = H * (0.15 + Math.random() * 0.15);
    launch(x, horizon(x), apex, 0.9 + i * 0.14, 0, 'salute');
  }
}

function megaBurst(r, chain) {
  texts.push({ x: W / 2, y: H * 0.36, txt: 'MEGA BURST!', color: '#d9a8ff', life: 1.5, big: true });
  flash = 1; shake = 8;
  react('cheer', 1.5);
  let i = 0;
  for (const o of rockets) {
    if (o.dead || o.pending !== null || o.kind === 'salute') continue;
    if (o.kind === 'dud') { o.dead = true; puff(o.x, o.y, 12); continue; }
    o.pending = 0.08 + i * 0.05; o.chain = chain + 1; i++;
  }
  if (i >= 8) unlock('megablast');
}

function atApex(r) {
  if (r.kind === 'salute') { r.dead = true; explode(r); return; }
  if (state === 'play' && r.kind !== 'dud' && r.kind !== 'mini') return fizzle(r);
  r.dead = true;
  if (r.kind === 'dud' || state === 'play') { puff(r.x, r.y, 14); return; }
  explode(r); // the menu demo, the finale and the candle break go off on their own, for show
}

function fizzle(r) {
  r.dead = true;
  puff(r.x, r.y, 18);
  lives--; streak = 0; shake = 10;
  goals.show.lostHeart = true;
  texts.push({ x: r.x, y: r.y, txt: 'fizzle!', color: '#ff6b6b', life: 1 });
  fizzleSound(); buzz([40, 40, 40]); react('slump', 1.2);
  updateHud();
  if (lives <= 0) gameOver();
}

function puff(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = Math.random() * 40;
    particles.push({ x, y, px: x, py: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, h: 0, sat: 0,
      life: 0.8, decay: 0.8, size: 2, glitter: false });
  }
}
