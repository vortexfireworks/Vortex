// Moon Fireworks: the planets, and the stargazer who walks out to point them out.

// ---------- planets ----------
// A few small planets hang in the sky alongside the Earth. Positions are fractions of the sky
// between the score bar and the top of the rockets' range.
const PLANETS = [
  { name: 'Mars', fx: 0.14, fy: 0.32, r: 0.011, line: "That red one's Mars!" },
  { name: 'Jupiter', fx: 0.55, fy: 0.1, r: 0.02, line: "Jupiter. Biggest of 'em all!" },
  { name: 'Saturn', fx: 0.33, fy: 0.62, r: 0.014, line: 'Saturn. Check out those rings!' },
  { name: 'Venus', fx: 0.9, fy: 0.66, r: 0.007, line: 'Venus. Brightest thing up there!' },
  { name: 'Earth', earth: true, line: "And that's home. Earth!" },
];
function planetPos(pl) {
  if (pl.earth) { const { er, ex, ey } = earthGeom(); return { x: ex, y: ey, r: er }; }
  const top = skyTop + 10, bottom = groundY * 0.62;
  return { x: W * pl.fx, y: top + (bottom - top) * pl.fy, r: Math.max(3, Math.min(W, H) * pl.r) };
}

function drawPlanets() {
  for (const pl of PLANETS) {
    if (pl.earth) continue;
    const { x, y, r } = planetPos(pl);
    if (pl.name === 'Mars') {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#f08a5a'); g.addColorStop(1, '#8a2e16');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    } else if (pl.name === 'Jupiter') {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
      const bands = ['#e8d2b0', '#c79a6c', '#efe0c4', '#b9875a', '#e6cfa8', '#c49468', '#e8d6b6'];
      bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x - r, y - r + i * 2 * r / bands.length, 2 * r, 2 * r / bands.length + 1); });
      ctx.fillStyle = '#c0583a'; ctx.beginPath(); ctx.ellipse(x + r * 0.35, y + r * 0.25, r * 0.22, r * 0.12, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (pl.name === 'Saturn') {
      const ring = (front) => {
        ctx.strokeStyle = 'rgba(225,205,160,.85)'; ctx.lineWidth = Math.max(1.5, r * 0.28);
        ctx.beginPath(); ctx.ellipse(x, y, r * 2.1, r * 0.6, -0.35, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
      };
      ring(false);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#f3e1b5'); g.addColorStop(1, '#a8874f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ring(true);
    } else {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.25, 'rgba(255,240,190,.55)'); g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
    }
  }
}

// ---------- the stargazer ----------
// Now and then he walks out from the side away from Chuck, stops, points at three planets one
// after another and names each one, then walks back off. He shows up from time to time on the
// menu screen, and once per show during play. Tap him to move on to the next planet.
const GAZER_W = 33, GAZER_H = 72, GAZER_SHOULDER = [5.6, 20.3], GAZER_TALL = 46;
const gazerImg = new Image(); gazerImg.src = GAZER_SRC;
const gazerPointImg = new Image(); gazerPointImg.src = GAZER_POINT_SRC;
let gazer = null, gazerTimer = 6, gazerShow = -1, gazerAt = 20;

function startGazer() {
  const p = pixelSize(), fromRight = showman.x < W / 2, k = GAZER_TALL * p / GAZER_H;
  const order = PLANETS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  gazer = { x: fromRight ? W + 30 * k : -30 * k, dir: fromRight ? -1 : 1, from: fromRight ? 1 : -1,
    standX: W * (fromRight ? 0.55 + Math.random() * 0.25 : 0.2 + Math.random() * 0.25),
    mode: 'in', t: 0, anim: 0, targets: order, idx: 0, flip: false };
}

function updateGazer(dt) {
  if (!gazer) {
    // on the menu screen he wanders out every so often; in play, once per show
    if (state === 'menu' || state === 'over') {
      gazerTimer -= dt;
      if (gazerTimer <= 0) { gazerTimer = 25 + Math.random() * 15; startGazer(); }
    } else if (state === 'play' && gazerShow !== showIdx && showTime > gazerAt) {
      gazerShow = showIdx; gazerAt = 15 + Math.random() * 20;
      startGazer();
    }
    return;
  }
  const g = gazer, p = pixelSize(), speed = 26 * p;
  g.t += dt; g.anim += dt;
  if (g.mode === 'in') {
    g.dir = Math.sign(g.standX - g.x) || 1;
    g.x += g.dir * Math.min(Math.abs(g.standX - g.x), speed * dt);
    g.flip = g.dir > 0;
    if (Math.abs(g.standX - g.x) < 1) { g.mode = 'point'; g.t = 0; }
  } else if (g.mode === 'point') {
    // face so the free arm is on the planet's side
    g.flip = planetPos(g.targets[g.idx]).x > g.x;
    if (g.t > 0.3) notePlanet(g.targets[g.idx].name);
    if (g.t > 2.6) nextGazerPlanet();
  } else {
    g.dir = g.from; g.flip = g.dir > 0;
    g.x += g.dir * speed * dt;
    if (g.x < -60 || g.x > W + 60) gazer = null;
  }
}

function nextGazerPlanet() {
  const g = gazer;
  g.t = 0; g.idx++;
  if (g.idx >= g.targets.length) g.mode = 'out';
}

function gazerBox() {
  const g = gazer, k = GAZER_TALL * pixelSize() / GAZER_H;
  const w = GAZER_W * k, h = GAZER_H * k;
  const bob = g.mode !== 'point' && Math.floor(g.anim / 0.2) % 2 ? -k * 1.5 : 0;
  return { left: g.x - w / 2, top: horizon(g.x) + 4 - h + bob, w, h, k };
}

function tapGazer(x, y) {
  if (!gazer || gazer.mode !== 'point') return false;
  const b = gazerBox();
  if (x < b.left || x > b.left + b.w || y < b.top || y > b.top + b.h) return false;
  nextGazerPlanet();
  return true;
}

function drawGazer() {
  if (!gazer || !gazerImg.complete) return;
  const g = gazer, { left, top, w, h, k } = gazerBox();
  const pointing = g.mode === 'point' && g.t > 0.3;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(g.x, horizon(g.x) + 4, w * 0.45, 1.5 * pixelSize(), 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (g.flip) { ctx.translate(left + w, top); ctx.scale(-1, 1); } else ctx.translate(left, top);
  ctx.drawImage(pointing ? gazerPointImg : gazerImg, 0, 0, w, h);
  ctx.restore();
  if (!pointing) return;
  // the pointing arm: sleeve, forearm and a finger, in chunky pixels to match the sprite
  const target = planetPos(g.targets[g.idx]);
  const sx = left + (g.flip ? GAZER_W - GAZER_SHOULDER[0] : GAZER_SHOULDER[0]) * k, sy = top + GAZER_SHOULDER[1] * k;
  const a = Math.atan2(target.y - sy, target.x - sx), ca = Math.cos(a), sa = Math.sin(a);
  const seg = (from, to, wid, col) => {
    ctx.fillStyle = col;
    for (let d = from; d <= to; d += 0.8) {
      const px = sx + ca * d * k, py = sy + sa * d * k;
      ctx.fillRect(Math.round(px - wid * k / 2), Math.round(py - wid * k / 2), Math.ceil(wid * k), Math.ceil(wid * k));
    }
  };
  seg(0, 8, 6, '#3b3f48'); seg(0, 8, 4.6, '#8d939e');       // short sleeve
  seg(8, 17, 3.6, '#5a3a2c'); seg(8, 17, 2.6, '#e2a07c');    // forearm
  seg(17, 20, 3.4, '#d68f6a');                               // hand
  seg(20, 23, 1.6, '#e2a07c');                               // pointing finger
  // the planet he's naming lights up, and he names it
  const pulse = 0.5 + 0.5 * Math.sin(time * 6);
  ctx.strokeStyle = `rgba(255,216,107,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(target.x, target.y, target.r * (target.r > 20 ? 1.25 : 2.4) + 4 + pulse * 3, 0, TAU); ctx.stroke();
  drawSpeech(g.targets[g.idx].line, g.x, top - 6);
}
