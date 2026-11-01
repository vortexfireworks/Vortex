// Moon Fireworks: sound effects and music.

// ---------- sound ----------
let actx = null, noiseBuf = null, master = null, musicGain = null, fxBus = null;
let muted = store.get('mfMuted', '0') === '1';
let musicOn = store.get('mfMusic', '0') === '1';
function audio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = muted ? 0 : 1;
      master.connect(actx.destination);
      musicGain = actx.createGain(); musicGain.gain.value = 0.6;
      musicGain.connect(master);
      const len = actx.sampleRate * 1.5;
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      // bangs go through a compressor so a finale full of them doesn't distort
      fxBus = actx.createDynamicsCompressor();
      fxBus.threshold.value = -14; fxBus.knee.value = 10; fxBus.ratio.value = 6;
      fxBus.attack.value = 0.002; fxBus.release.value = 0.25;
      fxBus.connect(master);
      loadBangs();
      if (musicOn) startMusic();
    } catch (e) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
let bangs = [];
function loadBangs() {
  BANG_MP3.forEach((b64, i) => {
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    try { actx.decodeAudioData(bytes.buffer, buf => { bangs[i] = buf; }, () => {}); } catch (e) {}
  });
}
// Play one of the recorded bangs, slightly re-pitched each time so repeats don't sound identical.
function playBang(i, rate, gain) {
  const buf = bangs[i];
  if (!buf) return false;
  const src = actx.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
  const g = actx.createGain(); g.gain.value = gain;
  src.connect(g).connect(fxBus); src.start();
  return true;
}

function boom(big, small) {
  if (!actx) return;
  const pick = big ? (Math.random() < 0.7 ? 0 : 3) : small ? 1 + Math.floor(Math.random() * 4) : Math.random() < 0.15 ? 0 : 1 + Math.floor(Math.random() * 4);
  if (playBang(pick, big ? 0.88 : small ? 1.3 : 1, big ? 1 : small ? 0.3 : 0.65)) return;
  // fallback until the recordings are decoded
  const t = actx.currentTime;
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(big ? 1400 : small ? 1800 : 900 + Math.random() * 500, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 1.2);
  const g = actx.createGain(); g.gain.value = big ? 0.7 : small ? 0.2 : 0.45;
  src.connect(lp).connect(g).connect(master);
  src.start(t);
}
function crackleSound() {
  if (!actx) return;
  const t0 = actx.currentTime + 0.45;
  for (let i = 0; i < 22; i++) {
    const t = t0 + Math.random() * 0.7;
    const s = actx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 3 + Math.random() * 2;
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(hp).connect(g).connect(master);
    s.start(t, Math.random() * 0.3); s.stop(t + 0.05);
  }
}
function whistle(dur) {
  if (!actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(700 + Math.random() * 300, t);
  o.frequency.exponentialRampToValueAtTime(2000 + Math.random() * 600, t + dur);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
// A Roman candle shot leaving the tube: a soft low thump with a puff of air.
function candleThump() {
  if (!actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  const og = actx.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(og).connect(master); o.start(t); o.stop(t + 0.25);
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const g = actx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  s.connect(lp).connect(g).connect(master); s.start(t); s.stop(t + 0.14);
}
function candlePop() {
  if (!actx) return;
  const t = actx.currentTime;
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500 + Math.random() * 300; bp.Q.value = 0.8;
  const g = actx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  s.connect(bp).connect(g).connect(master); s.start(t); s.stop(t + 0.2);
}
// The sharp bang of a salute: a hard crack on top of a short low thump.
function reportSound() {
  if (!actx) return;
  if (playBang(Math.random() < 0.5 ? 1 : 4, 1.12, 0.6)) return;
  const t = actx.currentTime;
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  const g = actx.createGain(); g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  s.connect(hp).connect(g).connect(master); s.start(t); s.stop(t + 0.15);
  const o = actx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  const og = actx.createGain(); og.gain.setValueAtTime(0.35, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(og).connect(master); o.start(t); o.stop(t + 0.32);
}
// The crack of each crossette star breaking, timed to match when each one splits.
function crossetteSound(times) {
  if (!actx) return;
  const t0 = actx.currentTime;
  for (const d of times) {
    const t = t0 + d;
    const s = actx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 2 + Math.random();
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    s.connect(hp).connect(g).connect(master); s.start(t); s.stop(t + 0.08);
  }
}
// The Clear Your Boards countdown: a short beep for 3, 2, 1 and a higher, longer one for GO.
function countdownBeep(go) {
  if (!actx) return;
  const t = actx.currentTime, dur = go ? 0.45 : 0.16;
  const o = actx.createOscillator(); o.type = 'square'; o.frequency.value = go ? 1046 : 660;
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.01);
  g.gain.setValueAtTime(0.09, t + dur - 0.04); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function fizzleSound() {
  if (!actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.4);
  const g = actx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.5);
}

// A gentle looping tune: slow pad chords with a soft arpeggio on top.
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
let musicTimer = null, musicStep = 0;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function tone(freq, t, dur, gain, type) {
  const o = actx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (type === 'sine' ? 0.01 : 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicGain); o.start(t); o.stop(t + dur + 0.05);
}
function musicTick() {
  if (!actx || !musicOn) return;
  const t = actx.currentTime + 0.05;
  const chord = CHORDS[Math.floor(musicStep / 8) % CHORDS.length];
  if (musicStep % 8 === 0) for (const n of chord) tone(mtof(n - 12), t, 4.2, 0.035, 'triangle');
  tone(mtof(chord[ARP[musicStep % 8]] + 12), t, 0.4, 0.045, 'sine');
  musicStep++;
}
function startMusic() { if (!musicTimer) { musicStep = 0; musicTimer = setInterval(musicTick, 260); } }
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}
