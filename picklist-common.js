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

  var FUNCS = {
    ceil: { fn: Math.ceil, args: 1 },
    floor: { fn: Math.floor, args: 1 },
    round: { fn: Math.round, args: 1 },
    abs: { fn: Math.abs, args: 1 },
    min: { fn: Math.min, args: -1 },
    max: { fn: Math.max, args: -1 }
  };
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function tokenize(src) {
    var tokens = [], i = 0, m;
    while (i < src.length) {
      var ch = src.charAt(i);
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        m = /^(?:\d+\.?\d*|\.\d+)/.exec(src.slice(i));
        if (!m) throw new Error('Unexpected "' + ch + '"');
        tokens.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
        tokens.push({ t: 'id', v: m[0].toLowerCase() }); i += m[0].length; continue;
      }
      if ('+-*/(),'.indexOf(ch) !== -1) { tokens.push({ t: ch }); i++; continue; }
      if (ch === '\u00d7') { tokens.push({ t: '*' }); i++; continue; }   // ×
      if (ch === '\u00f7') { tokens.push({ t: '/' }); i++; continue; }   // ÷
      throw new Error('Unexpected "' + ch + '"');
    }
    return tokens;
  }

  function evalFormula(formula, vars) {
    var src = String(formula == null ? '' : formula).trim();
    if (!src) return { ok: false, empty: true, error: 'No formula yet' };
    if (src.length > 300) return { ok: false, error: 'Formula is too long' };
    try {
      var toks = tokenize(src), pos = 0;
      var peek = function () { return toks[pos]; };
      var take = function (t) {
        var k = toks[pos];
        if (!k || (t && k.t !== t)) throw new Error(t ? 'Expected "' + t + '"' : 'Unexpected end of formula');
        pos++; return k;
      };
      var parseExpr, parseTerm, parseUnary, parsePrimary;
      parseExpr = function () {
        var v = parseTerm();
        while (peek() && (peek().t === '+' || peek().t === '-')) {
          var op = take().t, r = parseTerm();
          v = op === '+' ? v + r : v - r;
        }
        return v;
      };
      parseTerm = function () {
        var v = parseUnary();
        while (peek() && (peek().t === '*' || peek().t === '/')) {
          var op = take().t, r = parseUnary();
          if (op === '/' && r === 0) throw new Error('Division by zero');
          v = op === '*' ? v * r : v / r;
        }
        return v;
      };
      parseUnary = function () {
        if (peek() && peek().t === '-') { take(); return -parseUnary(); }
        if (peek() && peek().t === '+') { take(); return parseUnary(); }
        return parsePrimary();
      };
      parsePrimary = function () {
        var k = take();
        if (k.t === 'num') return k.v;
        if (k.t === '(') { var v = parseExpr(); take(')'); return v; }
        if (k.t === 'id') {
          if (peek() && peek().t === '(') {
            if (!has(FUNCS, k.v)) throw new Error('Unknown function "' + k.v + '"');
            take('(');
            var args = [];
            if (peek() && peek().t !== ')') {
              args.push(parseExpr());
              while (peek() && peek().t === ',') { take(','); args.push(parseExpr()); }
            }
            take(')');
            var f = FUNCS[k.v];
            if (f.args === 1 && args.length !== 1) throw new Error(k.v + '() takes one value');
            if (f.args === -1 && args.length < 1) throw new Error(k.v + '() needs at least one value');
            return f.fn.apply(null, args);
          }
          if (!vars || !has(vars, k.v)) throw new Error('Unknown variable "' + k.v + '"');
          return vars[k.v];
        }
        throw new Error('Unexpected "' + k.t + '"');
      };
      var result = parseExpr();
      if (pos < toks.length) throw new Error('Unexpected "' + toks[pos].t + '"');
      if (!isFinite(result)) return { ok: false, error: 'The result is not a number' };
      return { ok: true, value: Math.round(result * 100) / 100 };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* state: 'unset' (no formula saved yet) | 'ok' | 'error' */
  function computeRacks(data, formula) {
    var r = evalFormula(formula, buildVariables(data));
    if (r.ok) return { state: 'ok', value: r.value };
    if (r.empty) return { state: 'unset' };
    return { state: 'error', error: r.error };
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
    evalFormula: evalFormula, computeRacks: computeRacks,
    formatDateLong: formatDateLong, formatDateShort: formatDateShort
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PickList = api;
})(typeof window !== 'undefined' ? window : globalThis);
