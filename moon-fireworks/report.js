// Moon Fireworks: the After Action Report shown when a game ends.

// ---------- game stats ----------
// Counted as the game is played. Points are recorded where they're earned, and penalties as the
// score actually changed (it can't go below 0), so the breakdown always adds up to the final score.
function newGameStats() {
  return { time: 0, shows: 0, popped: 0, fizzled: 0, duds: 0, bestStreak: 0, bestChain: 0, topMult: 1, kinds: {},
    rocketPts: 0, chuckPts: 0, candlePts: 0, swarmPts: 0, penalties: 0,
    candleShots: 0, candleDrones: 0, swarmDowned: 0, strays: 0,
    effects: new Set(), newEffects: 0, planets: new Set(), chuckTaps: 0, pets: 0, poops: 0,
    started: new Date() };
}
let gs = newGameStats();

const fmtNum = n => Math.round(n).toLocaleString();
function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';

// The report as sections of [label, value] rows; used for both the screen and the copied text.
function reportSections() {
  const g = gs, k = g.kinds;
  const specials = [['Gold', k.gold], ['Dark red U', k.utah], ['Bright blue Y', k.byu], ['Pink hearts', k.heart],
    ['Slow-mo', k.slow], ['Mega bursts', k.mega], ['Two-stage', k.stage2], ['Mini rockets', k.mini]]
    .filter(([, n]) => n).map(([l, n]) => [l, fmtNum(n)]);
  const sections = [
    ['Summary', [
      ['Final score', fmtNum(score)],
      ['Made it to', 'Show ' + (showIdx + 1) + ': ' + showInfo(showIdx).name],
      ['Shows completed', g.shows],
      ['Time on the moon', fmtTime(g.time)],
    ]],
    ['Rockets', [
      ['Popped', fmtNum(g.popped)],
      ['Fizzled', fmtNum(g.fizzled)],
      ['Accuracy', pct(g.popped, g.popped + g.fizzled)],
      ['Best streak', fmtNum(g.bestStreak)],
      ['Biggest chain', fmtNum(g.bestChain)],
      ['Top multiplier', 'x' + g.topMult],
      ['Duds tapped', fmtNum(g.duds)],
    ]],
    ['Special rockets', specials.length ? specials : [['None this time', '']]],
    ['Bonus rounds', [
      ['Roman candle shots', fmtNum(g.candleShots)],
      ['Drones shot down by candle', fmtNum(g.candleDrones) + (g.candleShots ? ' (' + pct(g.candleDrones, g.candleShots) + ' of shots)' : '')],
      ['Drone show drones knocked down', fmtNum(g.swarmDowned)],
      ['Stray drones tapped', fmtNum(g.strays)],
    ]],
    ['Where the points came from', [
      ['Rockets', fmtNum(g.rocketPts)],
      ['Roman candle', fmtNum(g.candlePts)],
      ['Drone show', fmtNum(g.swarmPts)],
      ['Saying hi to Chuck', fmtNum(g.chuckPts)],
      ['Penalties (duds, stray drones)', g.penalties ? '−' + fmtNum(g.penalties) : '0'],
      ['Total', fmtNum(score)],
    ]],
    ['Around the moon', [
      ['Firework effects seen', g.effects.size + ' of ' + SHELL_TYPES.length + (g.newEffects ? ' (' + g.newEffects + ' new)' : '')],
      ['Planets the stargazer named', g.planets.size ? [...g.planets].join(', ') : 'none'],
      ['Times you tapped Chuck', fmtNum(g.chuckTaps)],
      ['Whippet pets', fmtNum(g.pets)],
      ['Piles left by the whippet', fmtNum(g.poops)],
    ]],
  ];
  if (goals.newThisGame.length) sections.push(['Achievements unlocked', goals.newThisGame.map(n => ['🏆 ' + n, ''])]);
  return sections;
}

function reportStamp() {
  return gs.started.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' +
    gs.started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function renderReport() {
  $('aarMeta').textContent = 'Moon Fireworks · ' + reportStamp() + (shortcutUsed ? ' · shortcut game, not saved' : '');
  $('aarBody').innerHTML = reportSections().map(([title, rows]) =>
    '<section><h3>' + esc(title) + '</h3><dl>' +
    rows.map(([l, v]) => '<div' + (l === 'Total' ? ' class="total"' : '') + '><dt>' + esc(l) + '</dt><dd>' + esc(v) + '</dd></div>').join('') +
    '</dl></section>').join('');
  $('aarCopyStatus').textContent = '';
}

function reportText() {
  const lines = ['MOON FIREWORKS · AFTER ACTION REPORT', reportStamp(), ''];
  for (const [title, rows] of reportSections()) {
    lines.push(title.toUpperCase());
    for (const [l, v] of rows) lines.push('  ' + l + (v !== '' ? ': ' + v : ''));
    lines.push('');
  }
  return lines.join('\n').trim();
}

async function copyReport() {
  const text = reportText();
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
    // older browsers: copy through a hidden text box
    try {
      const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove();
    } catch (e2) {}
  }
  $('aarCopyStatus').textContent = ok ? 'Copied! Paste it anywhere.' : "Couldn't copy on this device.";
}
