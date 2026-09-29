/* Shared pick-list logic used by Manage Pick Lists and Pick Lists.
   Nothing in here runs typed text as code: the racks formula is parsed by a small
   arithmetic parser that only understands numbers, + - * /, parentheses, a short
   list of functions, and named variables. */
(function (root) {
  'use strict';

  var SIZES = [
    { value: '2.5', label: '2-1/2"', key: '2_5' },
    { value: '3',   label: '3"',     key: '3'   },
    { value: '4',   label: '4"',     key: '4'   },
    { value: '5',   label: '5"',     key: '5'   },
    { value: '6',   label: '6"',     key: '6'   },
    { value: '8',   label: '8"',     key: '8'   }
  ];

  var UNITS = [
    { value: 'boxes',  label: 'Box(s)', one: 'box',   many: 'boxes'  },
    { value: 'shells', label: 'Shells', one: 'shell', many: 'shells' },
    { value: 'pairs',  label: 'Pairs',  one: 'pair',  many: 'pairs'  }
  ];

  function sizeByValue(v) {
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i].value === String(v)) return SIZES[i];
    return null;
  }
  function unitByValue(v) {
    for (var i = 0; i < UNITS.length; i++) if (UNITS[i].value === String(v)) return UNITS[i];
    return null;
  }
  function sizeLabel(v) { var s = sizeByValue(v); return s ? s.label : String(v); }
  function unitText(unit, qty) {
    var u = unitByValue(unit);
    if (!u) return String(unit || '');
    return Number(qty) === 1 ? u.one : u.many;
  }

  function newId() {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-2);
  }

  function toQty(v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    if (!isFinite(n) || n < 0) return null;
    return Math.round(n);
  }

  /* Accepts whatever came back from the server (or an empty list) and returns a clean,
     predictable shape. Lines with nothing useful in them are dropped. */
  function normalizeData(raw) {
    raw = (raw && typeof raw === 'object') ? raw : {};
    var shells = [];
    (Array.isArray(raw.shells) ? raw.shells : []).forEach(function (l) {
      if (!l || !sizeByValue(l.size) || !unitByValue(l.unit)) return;
      var qty = toQty(l.qty);
      if (!qty) return;                       // a shell line with no quantity means nothing
      shells.push({ id: String(l.id || newId()), size: String(l.size), qty: qty, unit: String(l.unit) });
    });
    var setup = [];
    (Array.isArray(raw.setup) ? raw.setup : []).forEach(function (l) {
      if (!l) return;
      var title = String(l.title == null ? '' : l.title).trim().slice(0, 120);
      if (!title) return;                     // the title is what makes a setup line real
      setup.push({ id: String(l.id || newId()), title: title, qty: toQty(l.qty) });
    });
    var cakes = toQty(raw.cakes);
    return { shells: shells, cakes: cakes, setup: setup };
  }

  /* Every number a racks formula is allowed to use. Missing things count as 0. */
  function buildVariables(data) {
    var d = normalizeData(data);
    var vars = { cakes: d.cakes || 0, shells: 0, boxes: 0, pairs: 0 };
    SIZES.forEach(function (s) {
      UNITS.forEach(function (u) { vars['s' + s.key + '_' + u.value] = 0; });
    });
    d.shells.forEach(function (l) {
      var s = sizeByValue(l.size);
      vars['s' + s.key + '_' + l.unit] += l.qty;
      vars[l.unit] += l.qty;
    });
    return vars;
  }

  /* How many shells fit in one rack, by size. A rack holds one caliber at a time,
     so racks are worked out per size and then added up. */
  var DEFAULT_RACK_CAPACITY = { '2.5': 50, '3': 50, '4': 25, '5': 15, '6': 9, '8': 4 };

  /* Accepts whatever came back from the server (or nothing yet) and fills in defaults
     for anything the admin hasn't customized. shellsPerBox has no built-in default —
     it stays null (meaning "not set yet") until the admin fills it in. */
  function normalizeRacksConfig(raw) {
    raw = (raw && typeof raw === 'object') ? raw : {};
    var capacity = {}, shellsPerBox = {};
    SIZES.forEach(function (s) {
      var cap = Number(raw.capacity && raw.capacity[s.value]);
      capacity[s.value] = (isFinite(cap) && cap > 0) ? cap : DEFAULT_RACK_CAPACITY[s.value];
      var spb = Number(raw.shellsPerBox && raw.shellsPerBox[s.value]);
      shellsPerBox[s.value] = (isFinite(spb) && spb > 0) ? spb : null;
    });
    return { capacity: capacity, shellsPerBox: shellsPerBox };
  }

  /* state: 'ok' (every line could be converted to a shell count) |
            'partial' (still gives a number, but some box quantities couldn't count
            yet because shells-per-box isn't set for that size) */
  function computeRacks(data, racksConfigRaw) {
    var d = normalizeData(data);
    var cfg = normalizeRacksConfig(racksConfigRaw);
    var totals = {};
    SIZES.forEach(function (s) { totals[s.value] = 0; });
    var unknownSizes = [];
    d.shells.forEach(function (l) {
      if (l.unit === 'pairs') { totals[l.size] += l.qty * 2; return; }        // a pair is 2 shells
      if (l.unit === 'shells') { totals[l.size] += l.qty; return; }
      // boxes: only counts once we know how many shells are in a box of this size
      var spb = cfg.shellsPerBox[l.size];
      if (spb) { totals[l.size] += l.qty * spb; }
      else if (unknownSizes.indexOf(l.size) === -1) { unknownSizes.push(l.size); }
    });
    var racks = 0;
    SIZES.forEach(function (s) {
      if (totals[s.value] > 0) racks += Math.ceil(totals[s.value] / cfg.capacity[s.value]);
    });
    if (unknownSizes.length) {
      return { state: 'partial', value: racks, unknownSizes: unknownSizes.map(sizeLabel) };
    }
    return { state: 'ok', value: racks };
  }

  function formatDateLong(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3 || isNaN(Number(p[1])) || isNaN(Number(p[2]))) return String(iso);
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0];
  }
  function formatDateShort(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3 || isNaN(Number(p[1])) || isNaN(Number(p[2]))) return String(iso);
    return Number(p[1]) + '/' + Number(p[2]);
  }

  var api = {
    SIZES: SIZES, UNITS: UNITS,
    sizeByValue: sizeByValue, unitByValue: unitByValue, sizeLabel: sizeLabel, unitText: unitText,
    newId: newId, toQty: toQty, normalizeData: normalizeData, buildVariables: buildVariables,
    DEFAULT_RACK_CAPACITY: DEFAULT_RACK_CAPACITY, normalizeRacksConfig: normalizeRacksConfig, computeRacks: computeRacks,
    formatDateLong: formatDateLong, formatDateShort: formatDateShort
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PickList = api;
})(typeof window !== 'undefined' ? window : globalThis);
