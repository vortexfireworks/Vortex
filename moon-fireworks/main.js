// Moon Fireworks: input, goals, shortcuts, leaderboard and the main loop.

// ---------- input ----------
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  const x = e.clientX, y = e.clientY;
  ripples.push({ x, y, life: 1 });
  if (state === 'arrive' && !paused) { endArrival(); return; }
  if (state === 'gallery') { nextGallery(); return; }
  if (!(state === 'play' || state === 'finale' || state === 'candle' || state === 'swarm') || paused) return;
  const touch = e.pointerType !== 'mouse';
  const hitR = touch ? Math.max(56, Math.min(W, H) * 0.07) : Math.max(34, Math.min(W, H) * 0.05);
  let target = null, bestD = hitR;
  for (const r of rockets) {
    if (r.dead || r.pending !== null || r.kind === 'salute') continue;
    const d = Math.hypot(r.x - x, r.y - y);
    if (d < bestD) { bestD = d; target = r; }
  }
  // a tap right on a drone hits it, unless a rocket is even closer to the tap
  const dh = droneAt(x, y);
  if (dh && (!target || dh.dist < bestD)) { hitDrone(dh.d); return; }
  if (state === 'candle' && candleActive()) { candleShoot(x, y); return; }
  if (state === 'swarm' && tapSwarm(x, y, touch)) return;
  if (target) {
    pop(target, 0);
    if (firstHint) { firstHint = false; store.set('mfPlayed', '1'); }
    return;
  }
  const b = showmanBox();
  if (x > b.left && x < b.left + b.w && y > b.top && y < b.top + b.h) { tapShowman(); return; }
  if (tapGazer(x, y)) return;
  const db = dogBox();
  if (!dog.hidden && x > db.left && x < db.left + db.w && y > db.top && y < db.top + db.h) tapDog();
});
cv.addEventListener('contextmenu', e => e.preventDefault());

function tapShowman() {
  const m = showman;
  if (m.tappedShow !== showIdx) {
    m.tappedShow = showIdx;
    goals.game.chuckShows.add(showIdx);
    if (goals.game.chuckShows.size >= 5) unlock('fanclub');
    addPoints(50);
    texts.push({ x: m.x, y: showmanBox().top - 10, txt: 'Hey there! +50', color: '#ffd86b', life: 1.3 });
    buzz(25);
    updateHud();
  }
  react('cheer', 0.9);
}

let helpThen = null;
function openHelp(then) { helpThen = then; $('helpGo').textContent = then === 'start' ? "Got it, let's go!" : 'Got it'; showOverlay('help'); }
$('start').onclick = () => {
  if (hashFlags().has('effects')) return startGallery();
  if (store.get('mfHelpSeen', '0') !== '1') { store.set('mfHelpSeen', '1'); openHelp('start'); }
  else startGame();
};
$('helpGo').onclick = () => {
  if (helpThen === 'start') startGame();
  else showOverlay(helpThen === 'pause' ? 'pause' : 'menu');
};
$('menuHelp').onclick = () => openHelp('menu');
$('pauseHelp').onclick = () => openHelp('pause');
$('menuBoard').onclick = () => { showOverlay('board'); loadScores($('boardList')); };
$('boardClose').onclick = () => showOverlay('menu');
$('menuEffects').onclick = () => { renderEffects(); showOverlay('effects'); };
$('menuAch').onclick = () => { renderAchievements(); showOverlay('ach'); };
$('effectsClose').onclick = () => showOverlay('menu');
$('achClose').onclick = () => showOverlay('menu');
$('again').onclick = startGame;
$('pauseBtn').onclick = () => setPaused(!paused);
$('resume').onclick = () => setPaused(false);
$('quit').onclick = () => {
  state = 'menu'; paused = false; slowT = 0; banner = null; rockets = [];
  candle = null; swarm = null; showman.mood = 'walk'; showman.say = null; showman.hidden = false;
  dog.hidden = false; dog.hide = false;
  if (van && !van.parked) van = null;
  stopEngine(); clearDrones();
  $('hud').classList.add('hidden');
  showOverlay('menu');
  updateHud();
};
$('muteBtn').onclick = () => {
  muted = !muted; store.set('mfMuted', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : 1;
  updateHud();
};
$('musicBtn').onclick = () => {
  musicOn = !musicOn; store.set('mfMusic', musicOn ? '1' : '0');
  audio();
  musicOn ? startMusic() : stopMusic();
  updateHud();
};
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.key === 'm' || e.key === 'M') $('muteBtn').click();
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') setPaused(!paused);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
addEventListener('blur', () => setPaused(true));
addEventListener('resize', resize);
if (window.visualViewport) visualViewport.addEventListener('resize', resize);

// ---------- goals: effects collection and achievements ----------
// Both are saved on this phone. Nothing counts in shortcut games.
const ACHIEVEMENTS = [
  { id: 'first', name: 'First Light', desc: 'Pop your first rocket.' },
  { id: 'chain3', name: 'Chain Reaction', desc: 'Set off a chain of 3 rockets.' },
  { id: 'streak', name: 'On Fire', desc: 'Reach a x4 multiplier.' },
  { id: 'utes', name: 'Go Utes!', desc: 'Pop a rare dark red U rocket.' },
  { id: 'show3', name: 'Showrunner', desc: 'Finish 3 shows in one game.' },
  { id: 'encore', name: 'Encore!', desc: 'Make it to show 7.' },
  { id: 'big', name: 'Big Show', desc: 'Score 5,000 in one game.' },
  { id: 'sharp', name: 'Sharpshooter', desc: 'Shoot down 10 drones with a Roman candle.', stat: 'targets', goal: 10 },
  { id: 'sweep', name: 'Clean Sweep', desc: 'Shoot down 5 drones in one Roman candle break.' },
  { id: 'buster', name: 'Drone Buster', desc: 'Knock down 500 drones in drone shows.', stat: 'swarm', goal: 500 },
  { id: 'oops', name: 'Oops!', desc: 'Tap a stray drone.' },
  { id: 'dog', name: 'Good Girl', desc: 'Pet the whippet 10 times.', stat: 'pets', goal: 10 },
  { id: 'holywar', name: 'Holy War', desc: 'Pop a dark red U and a bright blue Y in the same game.' },
  { id: 'collector', name: 'Collector', desc: 'See all 25 firework effects.' },
  // skill
  { id: 'flawless', name: 'Flawless', desc: 'Finish a show without losing a heart.' },
  { id: 'chain5', name: 'Chain Master', desc: 'Set off a chain of 5 rockets with one tap.' },
  { id: 'dodger', name: 'Dud Dodger', desc: 'Finish show 2 or later without tapping a dud.' },
  { id: 'gasp', name: 'Last Gasp', desc: 'Finish a show with only 1 heart left.' },
  { id: 'comeback', name: 'Comeback Kid', desc: 'Catch a pink heart rocket while down to your last heart.' },
  { id: 'slowhands', name: 'Slow Hands', desc: 'Pop 10 rockets during one slow-motion.' },
  { id: 'megablast', name: 'Mega Blast', desc: 'Set off 8 or more rockets with one mega burst.' },
  // bonus rounds
  { id: 'thunder', name: 'Thunderstruck', desc: 'Take down 2 drones with a single Thunder Candle burst.' },
  { id: 'bullseye', name: 'Bullseye', desc: 'Hit a drone with every shot of a Roman candle break.' },
  { id: 'wrecker', name: 'Logo Wrecker', desc: 'Knock down 300 drones in a single drone show.' },
  // characters and Easter eggs
  { id: 'astro', name: 'Astronomy 101', desc: 'Have the stargazer name all 5 planets.' },
  { id: 'fanclub', name: 'Fan Club', desc: 'Tap Chuck in 5 different shows of one game.' },
  { id: 'dogout', name: 'Who Let the Dog Out', desc: 'The whippet leaves 5 piles in one game.' },
  { id: 'earthfire', name: "Earth's on Fire", desc: 'Make it to show 4, when the Earth catches fire.' },
  // playing over time
  { id: 'regular', name: 'Regular', desc: 'Play 10 games.', stat: 'games', goal: 10 },
  { id: 'nightowl', name: 'Night Owl', desc: 'Play between midnight and 4 a.m.' },
  { id: 'tycoon', name: 'Fireworks Tycoon', desc: 'Score 100,000 points across all your games.', stat: 'total', goal: 100000 },
];
const loadJSON = (k, d) => { try { return JSON.parse(store.get(k, '')) || d; } catch (e) { return d; } };
const goals = { ach: loadJSON('mfAch', {}), stats: loadJSON('mfStats', {}), seen: loadJSON('mfEffects', []),
  planets: loadJSON('mfPlanets', []), newThisGame: [], kinds: new Set(),
  game: { chuckShows: new Set(), poops: 0 },   // this game
  show: { lostHeart: false, dud: false },      // this show
  slowPops: 0 };
// Most goals only count during a game; a few (the stargazer, games played) count anywhere.
const counts = anywhere => !shortcutUsed && (anywhere || playing());
// only achievements that still exist count (an old one may be saved from an earlier version)
const achCount = () => ACHIEVEMENTS.filter(a => goals.ach[a.id]).length;

function unlock(id, anywhere) {
  if (!counts(anywhere) || goals.ach[id]) return;
  goals.ach[id] = Date.now();
  store.set('mfAch', JSON.stringify(goals.ach));
  const a = ACHIEVEMENTS.find(a => a.id === id);
  goals.newThisGame.push(a.name);
  toast('🏆 ' + a.name, a.desc);
  updateGoalButtons();
}

function addStat(key, n, anywhere) {
  if (!counts(anywhere)) return;
  goals.stats[key] = (goals.stats[key] || 0) + n;
  store.set('mfStats', JSON.stringify(goals.stats));
  for (const a of ACHIEVEMENTS) if (a.stat === key && goals.stats[key] >= a.goal) unlock(a.id, anywhere);
}

// The stargazer has named a planet (on the menu screen too).
function notePlanet(name) {
  if (shortcutUsed || goals.planets.includes(name)) return;
  goals.planets.push(name);
  store.set('mfPlanets', JSON.stringify(goals.planets));
  if (goals.planets.length >= PLANETS.length) unlock('astro', true);
}

function noteEffect(name) {
  if (!counts() || !name || goals.seen.includes(name)) return;
  goals.seen.push(name);
  store.set('mfEffects', JSON.stringify(goals.seen));
  toast('✨ New effect: ' + name, goals.seen.length + ' of ' + SHELL_TYPES.length + ' seen');
  if (goals.seen.length >= SHELL_TYPES.length) unlock('collector');
  updateGoalButtons();
}

// Little notices under the score bar, shown one after another.
const toastQueue = [];
let toastBusy = false;
function toast(title, sub) {
  toastQueue.push([title, sub]);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const el = $('toast'), item = toastQueue.shift();
  if (!item) { toastBusy = false; return; }
  toastBusy = true;
  el.innerHTML = '<b>' + esc(item[0]) + '</b>' + (item[1] ? '<span>' + esc(item[1]) + '</span>' : '');
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 400); }, 2200);
}

function updateGoalButtons() {
  $('menuEffects').textContent = 'Effects ' + goals.seen.length + '/' + SHELL_TYPES.length;
  $('menuAch').textContent = 'Achievements ' + achCount() + '/' + ACHIEVEMENTS.length;
}

function renderEffects() {
  $('effectsList').innerHTML = SHELL_TYPES.map(t => {
    const name = SHELL_NAMES[t], seen = goals.seen.includes(name);
    return '<li class="' + (seen ? 'got' : '') + '">' + (seen ? '✨ ' + esc(name) : '❔ ???') + '</li>';
  }).join('');
  $('effectsCount').textContent = goals.seen.length + ' of ' + SHELL_TYPES.length + ' seen. Pop rockets to find the rest.';
}

function renderAchievements() {
  $('achList').innerHTML = ACHIEVEMENTS.map(a => {
    const got = !!goals.ach[a.id];
    const prog = a.stat && !got ? ' (' + Math.min(goals.stats[a.stat] || 0, a.goal) + '/' + a.goal + ')' : '';
    return '<li class="' + (got ? 'got' : '') + '"><span class="ic">' + (got ? '🏆' : '🔒') + '</span><span><b>' + esc(a.name) +
      '</b><br>' + esc(a.desc) + prog + '</span></li>';
  }).join('');
}

// ---------- shortcuts for checking things quickly ----------
// Add these to the end of the address (more than one with commas, e.g. #candle,fps):
//   #drones  skip straight to the drone show       #candle  skip straight to a Roman candle break
//   #effects show all 25 effects one by one       #fps     show frames per second and spark count
// Games started with #drones or #candle aren't saved to the leaderboard, best score or goals.
const hashFlags = () => new Set(location.hash.slice(1).toLowerCase().split(/[,&+]/).filter(Boolean));

let gallery = null;
function startGallery() {
  audio();
  rockets = []; particles = []; texts = [];
  state = 'gallery'; gallery = { i: -1, t: 0 };
  showOverlay(null);
  nextGallery();
}
function nextGallery() {
  const g = gallery;
  g.i++; g.t = 0;
  if (g.i >= SHELL_TYPES.length) { gallery = null; state = 'menu'; banner = null; showOverlay('menu'); return; }
  const t = SHELL_TYPES[g.i];
  particles = [];
  shell(W / 2, H * 0.38, t, Math.random() * 360, 1);
  banner = { title: SHELL_NAMES[t], sub: (g.i + 1) + ' of ' + SHELL_TYPES.length + ' · tap for the next one', t: 3, dur: 3 };
}
function updateGallery(dt) {
  gallery.t += dt;
  if (gallery.t > 3.2) nextGallery();
}

let fpsAvg = 60;
function drawFps(dt) {
  if (!hashFlags().has('fps')) return;
  if (dt > 0) fpsAvg += (1 / dt - fpsAvg) * 0.05;
  ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'left';
  const txt = Math.round(fpsAvg) + ' fps · ' + particles.length + ' sparks';
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(6, H - 26, ctx.measureText(txt).width + 12, 20);
  ctx.fillStyle = fpsAvg < 40 ? '#ff8a8a' : '#8affb0'; ctx.fillText(txt, 12, H - 11);
}

// ---------- leaderboard ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function renderScores(el, list, me) {
  if (!list) { el.innerHTML = '<li class="muted">The leaderboard is offline right now.</li>'; return; }
  if (!list.length) { el.innerHTML = '<li class="muted">No scores yet. Be the first!</li>'; return; }
  const mine = String(me || '').toLowerCase();
  el.innerHTML = list.map((s, i) =>
    `<li class="${mine && String(s.name).toLowerCase() === mine ? 'me' : ''}"><span class="rank">${i + 1}</span>` +
    `<span class="nm">${esc(s.name)}</span><span class="sc">${Number(s.score).toLocaleString()}</span></li>`).join('');
}
async function loadScores(el) {
  el.innerHTML = '<li class="muted">Loading…</li>';
  try {
    const res = await fetch(SCORES_API + '?type=gameScores', { cache: 'no-store' });
    const data = await res.json();
    renderScores(el, Array.isArray(data) ? data : null, store.get('mfName', ''));
  } catch (e) {
    renderScores(el, null);
  }
}
function setStatus(msg, ok) {
  const s = $('postStatus');
  s.textContent = msg;
  s.className = 'status' + (ok === true ? ' ok' : ok === false ? ' err' : '');
}
$('postForm').onsubmit = async e => {
  e.preventDefault();
  const name = $('nameIn').value.trim().slice(0, 20);
  if (!name) { setStatus('Type a name first.', false); return; }
  store.set('mfName', name);
  $('postBtn').disabled = true;
  setStatus('Posting…', null);
  try {
    const res = await fetch(SCORES_API, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ recordType: 'gameScore', name, score, show: showIdx + 1 }),
    });
    const data = await res.json();
    if (!data || data.status !== 'ok') throw new Error((data && data.message) || 'Could not post');
    setStatus('Posted! Nice show, ' + name + '.', true);
    $('postForm').style.display = 'none';
    renderScores($('overList'), data.scores || [], name);
  } catch (err) {
    setStatus(err.message && err.message !== 'Failed to fetch' ? err.message : "Couldn't post. Check your connection and try again.", false);
    $('postBtn').disabled = false;
  }
};

// ---------- loop ----------
function update(dt) {
  time += dt;
  if (state === 'play') showTime += dt;
  if (state === 'play' && showScore >= candleAt) { candleAt = Infinity; startCandle(); }
  if (state === 'candle') updateCandle(dt);
  if (state === 'swarm' && swarm) updateSwarm(dt);
  if (state === 'gallery' && gallery) updateGallery(dt);
  if (state === 'arrive') updateArrival(dt);
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }

  if (state === 'intro') {
    introT -= dt;
    if (introT <= 0) { state = 'play'; spawnTimer = 0.4; }
  }
  if (state === 'finale') {
    finaleT -= dt;
    if (finaleT <= -3) endFinale();
  }
  if (slowT > 0) {
    slowT -= dt;
    if ((slowT > 0 ? Math.ceil(slowT) : -1) !== hudSlow) updateHud();
  }
  const ts = slowT > 0 ? 0.45 : 1, rdt = dt * ts;

  spawnTimer -= rdt;
  if (spawnTimer <= 0) {
    if (state === 'play') {
      const volley = Math.random() < Math.min(0.4, level() * 0.07) ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let i = 0; i < volley; i++) spawnRocket();
      spawnTimer = Math.max(0.33, 1.35 - level() * 0.14) * (0.7 + Math.random() * 0.6);
    } else if (state === 'finale' && finaleT > 0) {
      spawnRocket();
      spawnTimer = 0.25 + Math.random() * 0.15;
    } else if (state === 'menu' || state === 'over') {
      spawnRocket();
      spawnTimer = 0.9;
    }
  }

  for (const r of rockets) {
    if (r.dead) continue;
    r.vy += r.g * rdt; r.x += r.vx * rdt; r.y += r.vy * rdt;
    if (r.kind === 'dud') r.x += Math.sin(time * 20 + r.trail.length) * 0.6;
    r.trail.push(r.x, r.y);
    if (r.trail.length > 24) r.trail.splice(0, 2);
    if (Math.random() < (r.kind === 'dud' ? 0.9 : 0.5)) {
      particles.push({ x: r.x, y: r.y + 3, px: r.x, py: r.y, vx: (Math.random() - 0.5) * 20, vy: Math.random() * 30,
        h: 35, sat: r.kind === 'dud' ? 0 : 100, life: 0.5, decay: 1.6, size: 1.2 * r.size, glitter: false });
    }
    if (r.pending !== null) {
      r.pending -= dt;
      if (r.pending <= 0) pop(r, r.chain);
    } else if (r.vy >= 0) {
      atApex(r);
    }
  }
  rockets = rockets.filter(r => !r.dead);

  const pg = H * 0.05; // gentle lunar gravity, no air drag
  const born = [];
  for (const p of particles) {
    p.px = p.x; p.py = p.y;
    p.vy += pg * (p.gm || 1) * dt;
    if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
    // swirl turns a star steadily; wig makes it squirm back and forth
    const turn = (p.swirl || 0) * dt + (p.wig ? Math.sin((p.t || 0) * p.wf + p.wph) * p.wig * dt : 0);
    if (turn) { const c = Math.cos(turn), s = Math.sin(turn), vx = p.vx; p.vx = vx * c - p.vy * s; p.vy = vx * s + p.vy * c; }
    if (p.wig || p.flutter) p.t = (p.t || 0) + dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.flutter) p.x += Math.sin(p.t * p.ff + p.fph) * p.flutter * dt;
    p.life -= p.decay * dt;
    if (p.emit && Math.random() < p.emit * dt) {
      born.push({ x: p.x, y: p.y, px: p.x, py: p.y, vx: p.vx * 0.1 + (Math.random() - 0.5) * 10, vy: p.vy * 0.1,
        h: p.h, sat: p.sat, lit: p.lit, life: p.trailLife || 0.5, decay: 1.8, size: p.trailLife ? 1.6 : 1, glitter: !!p.trailLife && p.glitter });
    }
    if (p.split !== undefined) {
      p.split -= dt;
      if (p.split <= 0) {
        // crossette break: a white flash and a cross of silver stars that keep the star's drift
        p.life = 0;
        const a0 = Math.atan2(p.vy, p.vx) + (Math.random() - 0.5) * 0.5, s = Math.hypot(p.vx, p.vy) * 0.55 + 25;
        born.push({ x: p.x, y: p.y, px: p.x, py: p.y, vx: p.vx * 0.3, vy: p.vy * 0.3, h: 40, sat: 20, lit: 95,
          life: 0.2, decay: 5, size: 5, glow: true, glitter: false });
        for (let k = 0; k < 4; k++) {
          const a = a0 + k * TAU / 4 + Math.PI / 4 + (Math.random() - 0.5) * 0.3, v = s * (0.8 + Math.random() * 0.4);
          born.push({ x: p.x, y: p.y, px: p.x, py: p.y, vx: p.vx * 0.35 + Math.cos(a) * v, vy: p.vy * 0.35 + Math.sin(a) * v,
            h: 45, sat: 15, lit: 84, life: 1.1, decay: 0.85, size: 2.3, streak: 0.14, emit: 22, trailLife: 0.9, glitter: true });
        }
      }
    }
    if (p.crackle && p.life < 0.5) {
      p.life = 0;
      born.push({ x: p.x, y: p.y, px: p.x, py: p.y, vx: 0, vy: 0, h: 50, sat: 20, life: 0.25, decay: 3, size: 3.2, glitter: false });
    }
  }
  particles = particles.filter(p => p.life > 0 && p.y < H + 10);
  for (const b of born) particles.push(b);
  if (particles.length > 5000) particles.splice(0, particles.length - 5000);

  for (const t of texts) { t.y -= 30 * dt; t.life -= dt * 0.9; }
  texts = texts.filter(t => t.life > 0);
  for (const r of ripples) r.life -= dt * 3;
  ripples = ripples.filter(r => r.life > 0);

  updateShowman(dt);
  updateDog(dt);
  updateDrones(dt);
  updateEarthFire(dt);
  updateGazer(dt);
  updateCameo(dt);

  flash = Math.max(0, flash - dt * 2.5);
  shake = Math.max(0, shake - dt * 40);
}

// Small white marks next to special rockets, so they can be told apart without relying on colour.
function drawSymbol(r) {
  const sym = KIND[r.kind].sym;
  if (!sym) return;
  const x = r.x + 15, y = r.y - 14;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3;
  if (sym === 'clock') {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 4); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + 1); ctx.stroke();
  } else if (sym === 'burst') {
    for (const [w, c] of [[3.5, 'rgba(0,0,0,.85)'], [1.6, '#fff']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        ctx.moveTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2); ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
      }
      ctx.stroke();
    }
  } else {
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(sym, x, y); ctx.fillText(sym, x, y);
    ctx.textBaseline = 'alphabetic';
  }
}

function drawBanner() {
  if (!banner) return;
  const k = banner.t / banner.dur;
  ctx.globalAlpha = Math.max(0, Math.min(1, k * 4, (1 - k) * 6));
  ctx.textAlign = 'center';
  const big = Math.min(64, W / 9);
  ctx.font = `900 ${big}px system-ui, sans-serif`;
  const g = ctx.createLinearGradient(W / 2 - big * 3, 0, W / 2 + big * 3, 0);
  g.addColorStop(0, '#ff5ea8'); g.addColorStop(0.5, '#ffd86b'); g.addColorStop(1, '#6bf3ff');
  ctx.fillStyle = g;
  ctx.fillText(banner.title, W / 2, H * 0.38);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.min(26, W / 18)}px system-ui, sans-serif`;
  ctx.fillText(banner.sub, W / 2, H * 0.38 + big * 0.75);
  if (banner.sub2) {
    ctx.fillStyle = '#c9cff5';
    ctx.font = `600 ${Math.min(18, W / 24)}px system-ui, sans-serif`;
    ctx.fillText(banner.sub2, W / 2, H * 0.38 + big * 0.75 + 30);
  }
  ctx.globalAlpha = 1;
}

function drawHint() {
  if (!firstHint || state !== 'play') return;
  const r = rockets.find(r => !r.dead && r.kind !== 'dud' && r.kind !== 'salute');
  if (!r) return;
  const y = r.y - 48 + Math.sin(time * 8) * 5;
  ctx.fillStyle = '#ffd86b'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(r.x, y + 26); ctx.lineTo(r.x - 9, y + 14); ctx.lineTo(r.x + 9, y + 14); ctx.closePath();
  ctx.stroke(); ctx.fill();
  ctx.font = '800 18px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.strokeText('Tap it!', r.x, y + 6); ctx.fillText('Tap it!', r.x, y + 6);
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.drawImage(bg, 0, 0, W, H);

  ctx.fillStyle = '#fff';
  for (const s of stars) {
    ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase));
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  drawEarthFire();
  drawPlanets();

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const p of particles) {
    let a = Math.min(1, p.life);
    if (p.haze) {
      // a soft coloured glow around a burst
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, `hsla(${p.h},100%,${p.lit}%,${a * 0.55})`); g.addColorStop(1, `hsla(${p.h},100%,${p.lit}%,0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      continue;
    }
    if (p.glitter && p.life < 0.6) a *= Math.random() < 0.5 ? 1 : 0.15;
    if (p.strobe && (time * p.strobe + p.sph) % 1 > 0.45) continue;
    const l = p.lit ? p.lit + p.life * 12 : 55 + p.life * 30;
    ctx.strokeStyle = `hsla(${p.h},${p.sat}%,${l}%,${a})`;
    ctx.lineWidth = p.size;
    ctx.beginPath();
    if (p.streak) ctx.moveTo(p.x - p.vx * p.streak, p.y - p.vy * p.streak);
    else ctx.moveTo(p.px, p.py);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    if (p.glow) {
      ctx.strokeStyle = `hsla(${p.h},100%,60%,${a * 0.3})`;
      ctx.lineWidth = p.size * 3.5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = p.size * 0.5;
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';

  for (const r of rockets) {
    for (let i = 2; i < r.trail.length; i += 2) {
      ctx.strokeStyle = rcol(r, i / r.trail.length * 0.8);
      ctx.lineWidth = 2.5 * r.size;
      ctx.beginPath(); ctx.moveTo(r.trail[i - 2], r.trail[i - 1]); ctx.lineTo(r.trail[i], r.trail[i + 1]); ctx.stroke();
    }
    const rad = 16 * r.size * (r.kind === 'byu' ? 1.5 : 1); // the bright blue Y glows bigger
    const glow = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rad);
    glow.addColorStop(0, rcol(r, 0.9, r.kind === 'utah' ? 40 : r.kind === 'byu' ? 60 : 80));
    glow.addColorStop(1, rcol(r, 0, 60));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.fill();
    ctx.fillStyle = r.kind === 'utah' ? '#ff9a9a' : r.kind === 'dud' ? '#aaa' : '#fff';
    ctx.beginPath(); ctx.arc(r.x, r.y, 3 * r.size, 0, TAU); ctx.fill();
    if (special(r) && r.kind !== 'dud' && playing()) {
      ctx.strokeStyle = rcol(r, 0.4 + 0.3 * Math.sin(time * 10));
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, 22, 0, TAU); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  if (playing()) for (const r of rockets) drawSymbol(r);

  drawSwarm();
  ctx.drawImage(fg, 0, 0, W, H);
  if (dog.hide) drawDog(); // hiding behind the van
  drawVan();
  drawFlag();
  drawPoops();
  drawGazer();
  if (!dog.hide) drawDog();
  drawShowman();
  drawCandle();
  drawDrones();
  if (state === 'arrive' && !paused) {
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Tap to skip', W / 2, H - 14);
  }

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,235,210,${flash * 0.12})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (slowT > 0) {
    ctx.fillStyle = `rgba(60,120,255,${Math.min(0.12, slowT * 0.05)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawCameo();
  for (const r of ripples) {
    ctx.strokeStyle = `rgba(255,255,255,${r.life * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, 10 + (1 - r.life) * 26, 0, TAU); ctx.stroke();
  }

  ctx.textAlign = 'center';
  for (const t of texts) {
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.font = `800 ${t.big ? Math.min(40, W / 15) : 17}px system-ui, sans-serif`;
    ctx.fillStyle = t.color;
    // keep labels on screen when they pop up near an edge
    const half = ctx.measureText(t.txt).width / 2 + 6;
    ctx.fillText(t.txt, Math.max(half, Math.min(W - half, t.x)), t.y);
  }
  ctx.globalAlpha = 1;
  drawHint();
  drawBanner();
  ctx.restore();
}

let last = performance.now();
function frame(now) {
  // Not every browser fires 'resize' once the viewport gets its real size,
  // so re-check here to avoid getting stuck with a 1px canvas.
  const vw = viewportSize();
  if (vw.w !== W || vw.h !== H) resize();
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  if (!paused) update(dt);
  draw();
  drawFps(dt);
  requestAnimationFrame(frame);
}

resize();
updateHud();
updateGoalButtons();
requestAnimationFrame(frame);
