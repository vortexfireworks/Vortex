// Moon Fireworks: the 25 firework effects and the particle system.

// ---------- shells ----------
// The 25 classic effects regular rockets pick from. ('ring' and 'double' are kept for specials.)
const SHELL_NAMES = {
  brocade: 'Brocade Crown', chrysanthemum: 'Chrysanthemum', crackle: 'Crackle', crossette: 'Crossette', coconut: 'Coconut',
  comets: 'Comets', dahlia: 'Dahlia', fish: 'Fish', leaves: 'Falling Leaves', glitter: 'Glitter',
  jellyfish: 'Jellyfish', mine: 'Mine', palm: 'Palm Tree', peony: 'Peony', rings: 'Rings',
  dragon: 'Silver Dragon', spider: 'Spider', spiral: 'Spiral', snowflakes: 'Snowflakes', strobe: 'Strobe',
  timerain: 'Time Rain', waterfall: 'Waterfall', wave: 'Wave', whirlwind: 'Whirlwind', willow: 'Willow',
  ring: 'Ring', double: 'Double Ring',
};
const SHELL_TYPES = Object.keys(SHELL_NAMES).filter(t => t !== 'ring' && t !== 'double');

function explode(r) {
  const s = r.size;
  switch (r.kind) {
    case 'utah': if (UTAH_POINTS.length) { explodeUtah(r); return ''; } break;
    case 'byu': explodeY(r); return '';
    case 'heart': shell(r.x, r.y, 'heart', 335, s); return '';
    case 'slow': shell(r.x, r.y, 'ring', 210, s); return '';
    case 'mega': shell(r.x, r.y, 'double', 280, 1.3); shell(r.x, r.y, 'crackle', 50, 1); return '';
    case 'stage2': shell(r.x, r.y, 'peony', 185, 0.6); return '';
    case 'mini': shell(r.x, r.y, 'peony', r.hue, 0.55); return '';
    case 'salute': shell(r.x, r.y, ['peony', 'ring', 'chrysanthemum'][Math.floor(Math.random() * 3)], Math.random() < 0.5 ? 0 : 355, 0.9); return '';
  }
  const type = SHELL_TYPES[Math.floor(Math.random() * SHELL_TYPES.length)];
  shell(r.x, r.y, type, r.hue, s, r.kind === 'gold');
  return SHELL_NAMES[type];
}

function shell(x, y, type, hue, scale, gold) {
  const sp = Math.min(W, H) * 0.26 * scale * (0.85 + Math.random() * 0.3);
  const hue2 = (hue + 120 + Math.random() * 80) % 360;
  const add = o => particles.push(Object.assign({ x, y, px: x, py: y, vx: 0, vy: 0, h: hue, sat: 100, life: 1,
    decay: 0.45 + Math.random() * 0.3, size: (1.5 + Math.random() * 1.3) * Math.max(0.7, scale),
    glitter: gold || Math.random() < 0.2 }, o));
  const dir = (a, s) => ({ vx: Math.cos(a) * s, vy: Math.sin(a) * s });
  const rand = Math.random;
  const n = Math.round(100 * Math.max(0.5, scale) * (gold ? 1.3 : 1));

  if (type === 'peony') {
    for (let i = 0; i < n; i++) add(dir(rand() * TAU, sp * Math.sqrt(rand())));
  } else if (type === 'chrysanthemum') {
    // long streaky stars that drip sparks behind them
    for (let i = 0; i < n; i++) add({ ...dir(rand() * TAU, sp * (0.7 + 0.3 * rand())), streak: 0.07, emit: 5, decay: 0.38 + rand() * 0.15 });
  } else if (type === 'palm') {
    // a few fat golden fronds plus a small core
    const k = 7 + Math.floor(rand() * 3);
    for (let i = 0; i < k; i++) {
      add({ ...dir(i / k * TAU + rand() * 0.3, sp * (1 + rand() * 0.15)), h: 40, sat: 90, size: 3.4,
        streak: 0.09, emit: 28, decay: 0.3, glitter: false });
    }
    for (let i = 0; i < 30; i++) add(dir(rand() * TAU, sp * 0.3 * Math.sqrt(rand())));
  } else if (type === 'crossette') {
    // red tailed stars thrown out unevenly; partway out each one cracks into a little cross of
    // white glittering stars, one after another
    const k = 16 + Math.floor(rand() * 5), splits = [];
    for (let i = 0; i < k; i++) {
      const split = 0.55 + rand() * 0.4;
      splits.push(split);
      add({ ...dir(i / k * TAU + (rand() - 0.5) * 0.35, sp * (0.8 + rand() * 0.35)), h: rand() * 10, sat: 100, lit: 52,
        size: 3, streak: 0.3, emit: 45, trailLife: 1.1, split, decay: 0.3, glitter: false });
    }
    crossetteSound(splits);
  } else if (type === 'waterfall') {
    // a red flash, then silver glitter strands thrown up and out that arc over and pour down,
    // leaving hanging trails like a waterfall; the whole burst leans a little to one side
    const lean = (rand() - 0.5) * 0.8;
    add({ vx: 0, vy: -4, h: 2, sat: 100, lit: 45, life: 1, decay: 1.1, size: sp * 0.55, haze: true, glitter: false });
    add({ vx: 0, vy: -4, h: 10, sat: 100, lit: 60, life: 0.8, decay: 1.6, size: sp * 0.22, haze: true, glitter: false });
    for (let i = 0; i < 25; i++) add({ ...dir(rand() * TAU, sp * 0.25 * rand()), h: rand() * 15, sat: 100, lit: 55, life: 0.5, decay: 1.5, size: 1.6, glitter: false });
    const k = Math.round(60 * Math.max(0.6, scale));
    for (let i = 0; i < k; i++) {
      const a = -Math.PI / 2 + lean + (rand() - 0.5) * 2.7;
      add({ ...dir(a, sp * (0.45 + rand() * 0.5)), h: 42, sat: 18, lit: 80, decay: 0.36 + rand() * 0.08,
        size: 2, gm: 3.6, streak: 0.06, emit: 60, trailLife: 1.4, glitter: true });
    }
  } else if (type === 'brocade') {
    // brocade crown: a dense dome of orange-gold stars that slow, then sag with heavy glittering trails
    add({ vx: 0, vy: 0, h: 30, sat: 100, lit: 50, life: 0.8, decay: 1.4, size: sp * 0.35, haze: true, glitter: false });
    for (let i = 0; i < 80; i++) {
      add({ ...dir(-Math.PI / 2 + (rand() - 0.5) * 3.4, sp * (0.75 + rand() * 0.35)), h: 28 + rand() * 12, sat: 95, lit: 55,
        size: 2, drag: 0.6, gm: 3, decay: 0.3 + rand() * 0.06, emit: 45, trailLife: 1.2, glitter: true });
    }
  } else if (type === 'coconut') {
    // a coconut palm: a dozen thick golden-brown fronds that droop over
    const k = 10 + Math.floor(rand() * 4);
    for (let i = 0; i < k; i++) {
      add({ ...dir(i / k * TAU + rand() * 0.3, sp * (0.9 + rand() * 0.3)), h: 32, sat: 75, lit: 62, size: 3.6,
        streak: 0.2, emit: 60, trailLife: 1.2, gm: 2.8, drag: 0.35, decay: 0.3, glitter: false });
    }
    for (let i = 0; i < 20; i++) add({ ...dir(rand() * TAU, sp * 0.25 * rand()), h: 35, sat: 80, size: 1.6, decay: 0.9 });
  } else if (type === 'comets') {
    // a handful of big comets with long tails, flung up and out so they cross
    for (let i = 0; i < 8; i++) {
      const white = i < 6;
      add({ ...dir(-Math.PI / 2 + (rand() - 0.5) * 2.6, sp * (0.95 + rand() * 0.35)), h: white ? 45 : hue, sat: white ? 35 : 100,
        lit: white ? 78 : 60, size: 4.2, streak: 0.24, emit: 70, trailLife: 1, gm: 1.6, decay: 0.34, glitter: false });
    }
  } else if (type === 'dahlia') {
    // fewer, bigger stars on long straight tails, evenly spaced
    const k = 26;
    for (let i = 0; i < k; i++) {
      add({ ...dir(i / k * TAU + (rand() - 0.5) * 0.08, sp * (0.95 + rand() * 0.1)), h: i % 3 ? 30 : hue, sat: 100, lit: 58,
        size: 3, streak: 0.3, emit: 22, trailLife: 0.8, decay: 0.4, glitter: false });
    }
    add({ vx: 0, vy: 0, h: 40, sat: 100, lit: 70, life: 0.5, decay: 2, size: sp * 0.25, haze: true, glitter: false });
  } else if (type === 'fish') {
    // a white flash, then stars that squirm away like little fish
    add({ vx: 0, vy: 0, h: 50, sat: 10, lit: 85, life: 0.6, decay: 1.8, size: sp * 0.3, haze: true, glitter: false });
    for (let i = 0; i < 70; i++) {
      add({ ...dir(rand() * TAU, sp * (0.55 + rand() * 0.45)), lit: 60, size: 2.6, streak: 0.06, emit: 20, trailLife: 0.7, drag: 0.8, decay: 0.36,
        wig: 9, wf: 12 + rand() * 6, wph: rand() * TAU, glitter: false });
    }
  } else if (type === 'leaves') {
    // falling leaves: glowing pieces that pop out, then flutter slowly down
    const cols = [[48, 90, 62], [90, 70, 55], [200, 60, 75], [30, 95, 58]];
    for (let i = 0; i < 46; i++) {
      const [h, sat, lit] = cols[Math.floor(rand() * cols.length)];
      add({ ...dir(rand() * TAU, sp * (0.4 + rand() * 0.7)), h, sat, lit, size: 3, drag: 1.6, gm: 2.6, decay: 0.24 + rand() * 0.06,
        flutter: 45 + rand() * 30, ff: 2 + rand() * 2, fph: rand() * TAU, emit: 4, glitter: false });
    }
  } else if (type === 'glitter') {
    // stars that shed a dense cloud of twinkling sparks
    for (let i = 0; i < 80; i++) {
      add({ ...dir(rand() * TAU, sp * Math.sqrt(rand())), h: 18 + rand() * 20, sat: 100, size: 1.7, emit: 32, trailLife: 0.9,
        decay: 0.38, glitter: true });
    }
  } else if (type === 'jellyfish') {
    // a silver dome on top with wavy tentacles trailing down
    for (let i = 0; i < 56; i++) {
      add({ ...dir(-Math.PI + (i / 55) * Math.PI, sp * (0.85 + rand() * 0.08)), h: 200, sat: 15, lit: 82, size: 2.4,
        emit: 16, drag: 0.9, gm: 0.6, decay: 0.36, glitter: true });
    }
    for (let i = 0; i < 26; i++) {
      // tentacles spread out under the dome's width, then hang and wave
      add({ vx: (rand() * 2 - 1) * sp * 0.75, vy: sp * (0.05 + rand() * 0.12), h: 200, sat: 15, lit: 82,
        size: 1.8, gm: 1.6, drag: 0.9, emit: 45, trailLife: 1.4, decay: 0.3, wig: 2.5, wf: 4 + rand() * 3, wph: rand() * TAU, glitter: true });
    }
  } else if (type === 'mine') {
    // a V-shaped spray of gold sparks blasting upward from the break
    add({ vx: 0, vy: 0, h: 35, sat: 100, lit: 55, life: 0.7, decay: 1.5, size: sp * 0.3, haze: true, glitter: false });
    for (let i = 0; i < 95; i++) {
      add({ ...dir(-Math.PI / 2 + (rand() - 0.5) * 0.9, sp * (0.5 + rand() * 1.1)), h: 36 + rand() * 10, sat: 90, size: 1.8,
        streak: 0.14, emit: 14, gm: 3.2, decay: 0.5 + rand() * 0.15, glitter: true });
    }
  } else if (type === 'dragon') {
    // silver dragons: a few silver tails that twist and curl as they climb, with a whistle
    for (let i = 0; i < 12; i++) {
      add({ ...dir(-Math.PI / 2 + (rand() - 0.5) * 2.4, sp * (0.75 + rand() * 0.3)), h: 210, sat: 6, lit: 82, size: 2.6,
        emit: 60, trailLife: 1.2, swirl: (rand() < 0.5 ? -1 : 1) * (2.5 + rand() * 2.5), wig: 4, wf: 9, wph: rand() * TAU,
        drag: 0.4, decay: 0.36, glitter: true });
    }
    whistle(1.2);
  } else if (type === 'spider') {
    // lots of fast thin gold legs that stop short and sag
    for (let i = 0; i < 130; i++) {
      add({ ...dir(rand() * TAU, sp * (1.3 + rand() * 0.3)), h: 40, sat: 85, size: 1.6, streak: 0.12, emit: 26, trailLife: 1.1,
        drag: 1.1, gm: 3, decay: 0.34, glitter: true });
    }
  } else if (type === 'spiral') {
    // stars laid out along spiral arms around a green core, slowly turning
    const arms = 5, per = 14;
    for (let a = 0; a < arms; a++) {
      for (let j = 1; j <= per; j++) {
        const r = j / per;
        add({ ...dir(a / arms * TAU + r * 2.6, sp * (0.15 + 0.85 * r)), lit: 62, size: 2.8, swirl: 0.7, decay: 0.34, glitter: false });
      }
    }
    for (let i = 0; i < 18; i++) add({ ...dir(rand() * TAU, sp * 0.12 * rand()), h: 110, sat: 100, size: 2.4, decay: 0.5 });
  } else if (type === 'snowflakes') {
    // a cloud of tiny white and pale blue twinkles
    for (let i = 0; i < 180; i++) {
      add({ ...dir(rand() * TAU, sp * 0.9 * Math.sqrt(rand())), h: rand() < 0.1 ? 275 : 205, sat: 35, lit: 85, size: 1.9,
        drag: 0.8, gm: 0.4, decay: 0.28 + rand() * 0.06, strobe: 3 + rand() * 4, sph: rand(), glitter: false });
    }
  } else if (type === 'strobe') {
    // stars that blink on and off
    const cols = [[25, 100, 60], [5, 100, 58], [45, 20, 88]];
    for (let i = 0; i < 80; i++) {
      const [h, sat, lit] = cols[Math.floor(rand() * cols.length)];
      add({ ...dir(rand() * TAU, sp * 0.85 * Math.sqrt(rand())), h, sat, lit: lit + 6, size: 3.6, drag: 0.6, gm: 0.8,
        decay: 0.3, strobe: 7 + rand() * 5, sph: rand(), glitter: false });
    }
  } else if (type === 'timerain') {
    // long-hanging glittering gold that drifts down and crackles out at the end
    for (let i = 0; i < 70; i++) {
      add({ ...dir(rand() * TAU, sp * 0.8 * Math.sqrt(rand())), h: 45, sat: 60, size: 1.6, drag: 0.5, gm: 2, decay: 0.17 + rand() * 0.04,
        emit: 25, trailLife: 0.9, crackle: true, glitter: true });
    }
  } else if (type === 'wave') {
    // a pink flower whose petals curve as they open, around a white pistil
    const k = 36;
    for (let i = 0; i < k; i++) {
      add({ ...dir(i / k * TAU, sp * 0.95), h: 318, sat: 90, lit: 62, size: 2.6, swirl: 1.3, drag: 0.5, emit: 60, trailLife: 0.9,
        streak: 0.12, decay: 0.4, glitter: false });
    }
    for (let i = 0; i < 22; i++) add({ ...dir(rand() * TAU, sp * 0.22 * Math.sqrt(rand())), h: 50, sat: 15, lit: 85, size: 2, decay: 0.7 });
  } else if (type === 'whirlwind') {
    // blue and white stars that spin in tight curls as they fly out
    for (let i = 0; i < 40; i++) {
      add({ ...dir(rand() * TAU, sp * (0.8 + rand() * 0.4)), h: 215, sat: i % 3 ? 70 : 10, lit: 72, size: 2.2,
        swirl: (i % 2 ? 1 : -1) * (2.2 + rand() * 1.2), drag: 0.2, emit: 45, trailLife: 1, decay: 0.36, glitter: false });
    }
  } else if (type === 'rings') {
    // three small rings, each around its own little core
    for (let r = 0; r < 3; r++) {
      const a0 = r / 3 * TAU + rand(), cx = x + Math.cos(a0) * sp * 0.45, cy = y + Math.sin(a0) * sp * 0.35;
      const h = [hue, 45, hue2][r], tilt = 0.75 + rand() * 0.25;
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * TAU;
        add({ x: cx, y: cy, px: cx, py: cy, vx: Math.cos(a) * sp * 0.45, vy: Math.sin(a) * sp * 0.45 * tilt, h, lit: 62, size: 2.4, decay: 0.42, glitter: true });
      }
      for (let i = 0; i < 10; i++) add({ x: cx, y: cy, px: cx, py: cy, ...dir(rand() * TAU, sp * 0.12 * rand()), h: 30, size: 2, decay: 0.7 });
    }
  } else if (type === 'willow') {
    for (let i = 0; i < n; i++) {
      add({ ...dir(rand() * TAU, sp * 0.75 * Math.sqrt(rand())), h: 42, sat: 70, decay: 0.2 + rand() * 0.06,
        size: 1.4, gm: 2.2, emit: 3, glitter: true });
    }
  } else if (type === 'crackle') {
    for (let i = 0; i < n * 0.8; i++) add({ ...dir(rand() * TAU, sp * 0.8 * Math.sqrt(rand())), crackle: true, glitter: true });
    crackleSound();
  } else if (type === 'ring' || type === 'double') {
    // tilted rings look like they're facing a different way each time
    const tilt = 0.35 + rand() * 0.65, rot = rand() * TAU;
    const ring = (count, s, h) => {
      for (let i = 0; i < count; i++) {
        const a = i / count * TAU, vx = Math.cos(a) * s, vy = Math.sin(a) * s * tilt;
        add({ vx: vx * Math.cos(rot) - vy * Math.sin(rot), vy: vx * Math.sin(rot) + vy * Math.cos(rot), h });
      }
    };
    ring(Math.round(n * 0.8), sp, hue);
    if (type === 'double') ring(Math.round(n * 0.6), sp * 0.55, hue2);
  } else if (type === 'heart') {
    for (let i = 0; i < n; i++) {
      const t = i / n * TAU;
      add({ vx: 16 * Math.pow(Math.sin(t), 3) / 17 * sp * 0.9,
        vy: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 * sp * 0.9 });
    }
  }
  flash = Math.min(1, flash + (gold ? 0.55 : 0.3) * Math.max(0.4, scale));
  boom(gold || scale > 1.1, scale < 0.8);
}

// Every spark flies outward at a speed proportional to its spot in the logo, so the
// whole picture grows evenly (gravity tugs every spark the same, keeping it intact).
// The oval Y: a bright blue oval of stars with a brilliant white Y inside it.
const Y_POINTS = (() => {
  const cols = Y_LOGO_ROWS[0].length, half = cols / 2, pts = [];
  Y_LOGO_ROWS.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') pts.push([(x - half + 0.5) / half, (y - Y_LOGO_ROWS.length / 2 + 0.5) / half, ch === 'w']);
  }));
  return pts;
})();
function explodeY(r) {
  const sp = Math.min(W, H) * 0.24;
  particles.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: 0, vy: 0, h: 218, sat: 100, lit: 55, life: 1, decay: 0.9, size: sp * 0.9, haze: true, glitter: false });
  for (const [ox, oy, white] of Y_POINTS) {
    const j = 0.97 + Math.random() * 0.06;
    particles.push({
      x: r.x, y: r.y, px: r.x, py: r.y, vx: ox * sp * j, vy: oy * sp * j,
      h: white ? 210 : 218, sat: white ? 25 : 100, lit: white ? 86 : 56,
      life: 1.25, decay: 0.42 + Math.random() * 0.08, size: white ? 3.8 : 3.2, glow: white,
      glitter: Math.random() < 0.12,
    });
  }
  flash = Math.min(1, flash + 0.6);
  boom(true);
}

function explodeUtah(r) {
  const sp = Math.min(W, H) * 0.24;
  for (const [ox, oy] of UTAH_POINTS) {
    const j = 0.97 + Math.random() * 0.06;
    particles.push({
      x: r.x, y: r.y, vx: ox * sp * j, vy: oy * sp * j, h: 355, sat: 95, lit: 48,
      life: 1.25, decay: 0.42 + Math.random() * 0.08, size: 3.4,
      glitter: Math.random() < 0.15, px: r.x, py: r.y,
    });
  }
  flash = Math.min(1, flash + 0.5);
  boom(true);
}
