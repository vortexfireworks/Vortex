// Moon Fireworks: stray drones and the drone show intermission.

// ---------- drones: rare, cross the sky, and cost 1000 points if you tap one ----------
let drones = [], droneIn = 60;
const DRONE_LINES = ['Not the drone!', "That's coming out of your pay", 'Who brought a drone?!'];
function droneScale() { return Math.max(0.9, Math.min(1.6, Math.min(W, H) / 400)); }

function spawnDrone() {
  const dir = Math.random() < 0.5 ? 1 : -1, s = droneScale();
  const y = skyTop + 20 + Math.random() * Math.max(10, groundY * 0.45 - skyTop);
  drones.push({ x: dir > 0 ? -40 * s : W + 40 * s, y, baseY: y, dir, s, t: 0,
    speed: Math.max(60, W / 7) * (0.85 + Math.random() * 0.3), hit: false, vy: 0, spin: 0, sound: droneSound() });
}

function updateDrones(dt) {
  if (state === 'play') {
    droneIn -= dt;
    if (droneIn <= 0) {
      droneIn = 30 + Math.random() * 40;
      if (!drones.length) spawnDrone();
    }
  }
  for (const d of drones) {
    d.t += dt;
    if (d.hit) {
      d.vy += 420 * dt; d.y += d.vy * dt; d.x += d.dir * d.speed * 0.4 * dt; d.spin += dt * 9;
      if (Math.random() < 0.7) particles.push({ x: d.x, y: d.y, px: d.x, py: d.y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 40,
        h: 25 + Math.random() * 20, sat: 100, life: 0.5, decay: 1.6, size: 1.6, glitter: false });
      if (d.y >= horizon(d.x)) { d.gone = true; puff(d.x, horizon(d.x), 26); boom(false, true); }
    } else {
      d.x += d.dir * d.speed * dt;
      d.y = d.baseY + Math.sin(d.t * 1.7) * 8 * d.s;
      if ((d.dir > 0 && d.x > W + 50 * d.s) || (d.dir < 0 && d.x < -50 * d.s)) d.gone = true;
      if (d.sound && actx) d.sound.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, d.x / W * 2 - 1)), actx.currentTime, 0.1);
    }
    if (d.gone) stopDroneSound(d);
  }
  drones = drones.filter(d => !d.gone);
}

// Tight box around the drone itself; returns the drone hit and its distance from the tap.
function droneAt(x, y) {
  for (const d of drones) {
    if (d.hit) continue;
    if (Math.abs(x - d.x) < 22 * d.s && Math.abs(y - d.y) < 12 * d.s) return { d, dist: Math.hypot(x - d.x, y - d.y) };
  }
  return null;
}

function hitDrone(d) {
  unlock('oops');
  d.hit = true; d.vy = -60;
  stopDroneSound(d);
  score = Math.max(0, score - 1000); streak = 0; shake = 14; flash = Math.min(1, flash + 0.3);
  texts.push({ x: d.x, y: d.y - 10, txt: 'DRONE! -1000', color: '#ff4a4a', life: 1.8, big: true });
  const m = showman;
  if (!m.hidden && m.mood !== 'candle' && !m.say)
    texts.push({ x: m.x, y: showmanBox().top - 10, txt: DRONE_LINES[Math.floor(Math.random() * DRONE_LINES.length)], color: '#fff', life: 1.8 });
  crashSound(); buzz([80, 40, 120]); react('slump', 1.5);
  updateHud();
}

function droneSound() {
  if (!actx) return null;
  const t = actx.currentTime;
  const out = actx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(paused ? 0.0001 : 0.03, t + 0.6);
  const pan = actx.createStereoPanner ? actx.createStereoPanner() : null;
  const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
  const oscs = [205, 213].map(f => { const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(bp); o.start(t); return o; });
  bp.connect(out);
  if (pan) out.connect(pan).connect(master); else out.connect(master);
  return { out, oscs, pan: pan || { pan: { setTargetAtTime() {} } } };
}
function stopDroneSound(d) {
  if (!d.sound || !actx) return;
  const t = actx.currentTime, s = d.sound;
  d.sound = null;
  s.out.gain.cancelScheduledValues(t); s.out.gain.setValueAtTime(s.out.gain.value, t);
  s.out.gain.linearRampToValueAtTime(0.0001, t + 0.2);
  for (const o of s.oscs) o.stop(t + 0.25);
}
function muteDrones(off) {
  if (!actx) return;
  for (const d of drones) if (d.sound) d.sound.out.gain.setTargetAtTime(off ? 0.0001 : 0.03, actx.currentTime, 0.05);
}
function clearDrones() { for (const d of drones) stopDroneSound(d); drones = []; }

function crashSound() {
  if (!actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.9);
  const g = actx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
  o.connect(g).connect(master); o.start(t); o.stop(t + 1);
  fizzleSound();
}

function drawDrones() {
  for (const d of drones) drawDrone(d);
}

// A quadcopter with blinking navigation lights; also used for the Roman candle's targets.
function drawDrone(d) {
  {
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.hit ? d.spin : d.dir * 0.12);
    // arms and rotors
    ctx.strokeStyle = '#4a4f5c'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.moveTo(-17 * s, -4 * s); ctx.lineTo(17 * s, -4 * s); ctx.stroke();
    for (const rx of [-17, 17]) {
      ctx.fillStyle = '#2a2d36'; ctx.fillRect((rx - 1.5) * s, -7 * s, 3 * s, 4 * s);
      const blur = d.hit ? 0.5 : 0.35 + 0.25 * Math.abs(Math.sin(d.t * 40 + rx));
      ctx.fillStyle = `rgba(200,210,230,${blur})`;
      ctx.beginPath(); ctx.ellipse(rx * s, -8 * s, 9 * s, 1.6 * s, 0, 0, TAU); ctx.fill();
    }
    // body, camera and landing legs
    ctx.fillStyle = '#d9dce4';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-9 * s, -6 * s, 18 * s, 8 * s, 3 * s) : ctx.rect(-9 * s, -6 * s, 18 * s, 8 * s); ctx.fill();
    ctx.fillStyle = '#2a2d36'; ctx.fillRect(-3 * s, 2 * s, 6 * s, 3 * s);
    ctx.fillStyle = '#6ab0ff'; ctx.fillRect(-1 * s, 3 * s, 2 * s, 1.5 * s);
    ctx.strokeStyle = '#4a4f5c'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(-6 * s, 2 * s); ctx.lineTo(-9 * s, 7 * s); ctx.moveTo(6 * s, 2 * s); ctx.lineTo(9 * s, 7 * s); ctx.stroke();
    // navigation lights: red and green, plus a white strobe
    const blink = Math.floor(d.t * 2) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3030' : '#661010'; ctx.fillRect(-9 * s, -3 * s, 2 * s, 2 * s);
    ctx.fillStyle = blink ? '#30ff60' : '#106620'; ctx.fillRect(7 * s, -3 * s, 2 * s, 2 * s);
    if (!d.hit && d.t % 1.2 < 0.08) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(0, -6 * s, 3 * s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}


// ---------- drone show intermission after the 5th show ----------
// The sponsor logos, each drawn by a swarm of lit drones, drift across the sky from right to
// left. Tapping knocks nearby drones out of the sky with a small explosion, 1 point per 3 drones.
// Like the Roman candle, these are bonus points that don't count toward a show's target.
const SWARM_AFTER_SHOW = 5, SWARM_DRONES_PER_POINT = 3;
let swarm = null;
const swarmSprites = {};
function swarmSprite(col) {
  if (swarmSprites[col]) return swarmSprites[col];
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.18, col); grad.addColorStop(0.45, col + '99'); grad.addColorStop(1, col + '00');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return (swarmSprites[col] = c);
}

function startSwarm() {
  clearDrones();
  state = 'swarm';
  const size = Math.min(W * 0.75, groundY - skyTop - 50, 460), gap = size * 0.45;
  const cy = (skyTop + groundY - 40) / 2;
  const logos = SWARM_LOGOS.map((L, i) => {
    const rows = L.rows, cols = Math.max(...rows.map(r => r.length)), n = Math.max(rows.length, cols), cell = size / n;
    const drones = [];
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === '.') return;
      drones.push({ ox: (x - cols / 2 + 0.5) * cell, oy: (y - rows.length / 2 + 0.5) * cell,
        sprite: swarmSprite(L.pal['abcdefgh'.indexOf(ch)]), ph: Math.random() * TAU, up: true });
    }));
    return { x: W + size / 2 + 30 + i * (size + gap), cell, drones };
  });
  swarm = { logos, size, cy, speed: (W + size) / 9, falling: [], downed: 0, points: 0, done: 0 };
  banner = { title: 'Drone show!', sub: 'Tap the drones to knock them down', sub2: '1 point for every 3 drones', t: 2.6, dur: 2.6 };
  react('cheer', 1.2);
  updateHud();
}

function updateSwarm(dt) {
  const s = swarm;
  for (const L of s.logos) L.x -= s.speed * dt;
  const g = H * 1.1;
  for (const f of s.falling) {
    f.vy += g * dt; f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.y >= horizon(f.x) + 2) { f.gone = true; puff(f.x, horizon(f.x), 3); }
  }
  s.falling = s.falling.filter(f => !f.gone);
  const last = s.logos[s.logos.length - 1];
  if (last.x + s.size / 2 < 0 && !s.falling.length) {
    s.done += dt;
    if (s.done > 0.8) endSwarm();
  }
}

function endSwarm() {
  const n = swarm.downed, pts = swarm.points;
  if (n >= 300) unlock('wrecker');
  swarm = null;
  beginShow();
  texts.push({ x: W / 2, y: H * 0.62, txt: n ? 'Drones downed: ' + n + ' (+' + pts + ')' : 'What a drone show!', color: '#7ff0ff', life: 2.6, big: true });
}

// Knock down every drone within reach of the tap. Returns true if any were hit.
function tapSwarm(x, y, touch) {
  const s = swarm;
  let hit = 0;
  for (const L of s.logos) {
    const r = Math.max(touch ? 16 : 11, L.cell * 1.8);
    if (Math.abs(x - L.x) > s.size / 2 + r || Math.abs(y - s.cy) > s.size / 2 + r) continue;
    for (const d of L.drones) {
      if (!d.up) continue;
      const dx = L.x + d.ox, dy = s.cy + d.oy;
      if (Math.hypot(dx - x, dy - y) > r) continue;
      d.up = false; hit++;
      s.falling.push({ x: dx, y: dy, vx: (dx - x) * 2 + (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 50,
        sprite: d.sprite, size: L.cell * 1.9 });
    }
  }
  if (!hit) return false;
  s.downed += hit;
  const pts = Math.max(1, Math.round(hit / SWARM_DRONES_PER_POINT));
  s.points += pts;
  score += pts;
  addStat('swarm', hit);
  // small explosion where the tap landed
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * TAU, v = 30 + Math.random() * 90;
    particles.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, h: 30 + Math.random() * 25, sat: 100,
      life: 0.6, decay: 1.5, size: 1.6, glitter: Math.random() < 0.4 });
  }
  particles.push({ x, y, px: x, py: y, vx: 0, vy: 0, h: 45, sat: 30, lit: 90, life: 0.25, decay: 4, size: 10, glow: true, glitter: false });
  candlePop(); buzz(10);
  texts.push({ x, y: y - 16, txt: '+' + pts, color: '#7ff0ff', life: 0.9 });
  if (Math.random() < 0.15) react('cheer', 0.6);
  updateHud();
  return true;
}

function drawSwarm() {
  if (!swarm) return;
  const s = swarm;
  for (const L of s.logos) {
    if (L.x + s.size / 2 < -20 || L.x - s.size / 2 > W + 20) continue;
    const sz = L.cell * 1.9, h = sz / 2;
    for (const d of L.drones) {
      if (!d.up) continue;
      const x = L.x + d.ox;
      if (x < -sz || x > W + sz) continue;
      const y = s.cy + d.oy + Math.sin(time * 2 + d.ph) * 0.8;
      ctx.globalAlpha = 0.8 + 0.2 * Math.sin(time * 5 + d.ph);
      ctx.drawImage(d.sprite, x - h, y - h, sz, sz);
    }
  }
  ctx.globalAlpha = 0.7;
  for (const f of s.falling) ctx.drawImage(f.sprite, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
  ctx.globalAlpha = 1;
}
