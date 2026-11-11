/* ================= Formel-Umwandlung =================
   latexToText: MathQuill-LaTeX → kanonischer Text (Punkt = Dezimal, Komma = Argumente)
   textToLatex: kanonischer Text → MathQuill-LaTeX
   Erwartet: S (Einstellungen), K (Rechenkern, optional für Namen). */
const ED = {};

ED.OPNAMES = ('iint iiint extrema grad div rot curl laplace regr regression fit dgl ode polarform param polar surface kurve stetig kurvenint bogen lineint arclen continuous folge reihe rekursiv muster seq series recseq pattern sin cos tan cot sec csc asin acos atan arcsin arccos arctan arccot arcsec arccsc sinh cosh tanh coth sech csch arsinh arcosh artanh arcoth arsech arcsch ln log lg exp abs det inv rref rank eig cross dot ' +
  'norm trace transpose solve diff integrate limit lim expand factor simplify apart gcd lcm mod floor ceil round nCr nPr fact binomPdf ' +
  'binomCdf normCdf mean median var std taylor pctval pctrate pctbase pctchg torad todeg sgn re im arg conj max min hypot identity diag tangent randInt mode quantile angle ans').split(' ');
const MQ_BUILTIN = new Set('sin cos tan cot sec csc sinh cosh tanh coth sech csch ln log exp det lim arcsin arccos arctan arccot arcsec arccsc arsinh arcosh artanh arcoth arsech arcsch'.split(' '));
const TRIG_MAP = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', arccot: 'acot', arcsec: 'asec', arccsc: 'acsc', arsinh: 'asinh', arcosh: 'acosh', artanh: 'atanh', arcoth: 'acoth', arsech: 'asech', arcsch: 'acsch' };
const TRIG_BACK = Object.fromEntries(Object.entries(TRIG_MAP).map(([a, b]) => [b, a]));
const VALUE_NAMES = new Set(['ans', 'pi', 'e', 'i', 'Infinity']);
const FN_NAMES = new Set(ED.OPNAMES.filter(n => !VALUE_NAMES.has(n)).concat(['sqrt', 'root', 'sum', 'prod', 'arcsin', 'arccos', 'arctan']));

// Konstanten: Anzeige (\text-Schlüssel) ↔ interner Name
ED.CONSTS = [
  ['c', '_c'], ['h', '_h'], ['ħ', '_hb'], ['N_A', '_NA'], ['k_B', '_kB'], ['R', '_R'], ['F', '_F'], ['e', '_qe'],
  ['m_e', '_me'], ['m_p', '_mp'], ['u', '_u'], ['ε_0', '_eps0'], ['g', '_g'], ['V_m', '_Vm'], ['G', '_G'], ['p_0', '_atm'], ['φ', '_phi'], ['μ_0', '_mu0'], ['σ', '_sigma'], ['T_0', '_T0'], ['a_0', '_a0']
];
const C_BY_KEY = Object.fromEntries(ED.CONSTS);
const C_BY_NAME = Object.fromEntries(ED.CONSTS.map(([k, n]) => [n, k]));
ED.constLatex = name => {
  const k = C_BY_NAME[name]; if (!k) return name;
  const [a, b] = k.split('_');
  return '\\text{' + a + '}' + (b ? '_{\\text{' + b + '}}' : '');
};
const GREEK = { iota: 'ι', upsilon: 'υ', Xi: 'Ξ', Pi: 'Π', Upsilon: 'Υ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', sigma: 'σ', tau: 'τ', omega: 'ω', phi: 'φ', varphi: 'φ', psi: 'ψ', rho: 'ρ', nu: 'ν', eta: 'η', kappa: 'κ', xi: 'ξ', zeta: 'ζ', chi: 'χ', Delta: 'Δ', Omega: 'Ω', Gamma: 'Γ', Phi: 'Φ', Psi: 'Ψ', Lambda: 'Λ', Theta: 'Θ', Sigma: 'Σ' };

/* ---------- LaTeX-Tokenizer ---------- */
function lexLatex(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const m = s.slice(i + 1).match(/^([A-Za-z]+|.)/);
      const name = m ? m[1] : '';
      i += 1 + name.length;
      if (name === ' ' || name === ',' || name === ':' || name === ';' || name === '!' || name === 'quad' || name === 'qquad') { out.push({ t: 'sp' }); continue; }
      if (name === '%') { out.push({ t: 'ch', v: '%' }); continue; }
      if (name === '{' || name === '}' || name === '|') { out.push({ t: 'ch', v: name === '|' ? '|' : name === '{' ? '(' : ')' }); continue; }
      out.push({ t: 'cmd', v: name });
      continue;
    }
    if (c === '{' || c === '}') { out.push({ t: c }); i++; continue; }
    if (c === '^' || c === '_') { out.push({ t: c }); i++; continue; }
    if (c === ' ' || c === '~') { i++; continue; }
    out.push({ t: 'ch', v: c }); i++;
  }
  return out;
}

/* ---------- Parser LaTeX → Text ---------- */
function encloses(s) { // "(…)" umschließt den gesamten String?
  if (s[0] !== '(' || s[s.length - 1] !== ')') return false;
  let d = 0;
  for (let i = 0; i < s.length; i++) { if (s[i] === '(' || s[i] === '[') d++; else if (s[i] === ')' || s[i] === ']') { d--; if (d === 0 && i < s.length - 1) return false; } }
  return true;
}
function isAtomic(s) {
  if (/^-?[\w.]+$/.test(s) && !/^-/.test(s)) return true;
  if (encloses(s)) return true;
  const m = s.match(/^[A-Za-z_]\w*(?=\()/);
  return !!(m && encloses(s.slice(m[0].length)));
}
const wrap = s => isAtomic(s) ? s : '(' + s + ')';
function dedupeParens(s) {
  for (let guard = 0; guard < 50; guard++) {
    const st = [], match = {};
    for (let i = 0; i < s.length; i++) { if (s[i] === '(') st.push(i); else if (s[i] === ')') { const o = st.pop(); if (o !== undefined) match[o] = i; } }
    let done = true;
    for (const o of Object.keys(match).map(Number).sort((a, b) => a - b)) {
      const c = match[o];
      if (s[o + 1] === '(' && match[o + 1] === c - 1) { s = s.slice(0, o) + s.slice(o + 1, c - 1) + s.slice(c); done = false; break; }
      // (x) einzelnes Atom in Klammern, nicht nach Funktionsnamen
      const inner = s.slice(o + 1, c);
      const pv = s[o - 1] || '', nx = s[c + 1] || '';
      if (/^[\w.]+\/[\w.]+$/.test(inner) && /^[+\-(,=]?$/.test(pv) && /^[+\-),=]?$/.test(nx) && !/[\w)\]']/.test(pv)) { s = s.slice(0, o) + inner + s.slice(c + 1); done = false; break; }
      if (/^[\w.]+$/.test(inner) && !/[\w)\]']/.test(s[o - 1] || '') && s[c + 1] !== '^' ) { s = s.slice(0, o) + inner + s.slice(c + 1); done = false; break; }
    }
    if (done) break;
  }
  return s;
}
class LP {
  constructor(tokens) { this.tk = tokens; this.i = 0; }
  peek(o = 0) { return this.tk[this.i + o]; }
  next() { return this.tk[this.i++]; }
  eof() { return this.i >= this.tk.length; }
  // eine Gruppe {…} oder ein einzelnes Token als Token-Liste
  groupTokens() {
    while (this.peek() && this.peek().t === 'sp') this.i++;
    const t = this.next();
    if (!t) return [];
    if (t.t === '{') {
      let d = 1; const start = this.i;
      while (!this.eof()) {
        const x = this.next();
        if (x.t === '{') d++;
        else if (x.t === '}') { d--; if (d === 0) return this.tk.slice(start, this.i - 1); }
      }
      return this.tk.slice(start);
    }
    if (t.t === 'cmd' && t.v === 'left') { // \left( … \right)
      const start = this.i - 1; this.skipLeftRight(); return this.tk.slice(start, this.i);
    }
    return [t];
  }
  skipLeftRight() { // steht hinter \left; bis zum passenden \right + Begrenzer
    this.i++; let d = 1;
    while (!this.eof()) {
      const x = this.next();
      if (x.t === 'cmd' && x.v === 'left') { this.i++; d++; }
      else if (x.t === 'cmd' && x.v === 'right') { this.i++; d--; if (d === 0) return; }
    }
  }
  // Index des Endes eines \left…\right-Blocks ab Position p (p zeigt auf \left)
}
const sub = toks => new LP(toks);
const isSep = (t, dec) => t && t.t === 'ch' && (t.v === (dec === ',' ? ';' : ','));
const isDecPoint = (t, dec) => t && t.t === 'ch' && t.v === (dec === ',' ? ',' : '.');
const STOP_TERM = new Set(['+', '-', '=', '<', '>']);

function convertSeq(p, dec, stop) {
  // stop(token, parser) → true beendet die Sequenz (Token wird nicht verbraucht)
  const items = []; // {s, k}
  const push = (s, k) => items.push({ s, k });
  while (!p.eof()) {
    const t = p.peek();
    if (stop && stop(t, p, items)) break;
    p.i++;
    if (t.t === 'sp') continue;
    if (t.t === '{') { p.i--; const g = p.groupTokens(); push('(' + convertSeq(sub(g), dec).s + ')', 'close'); continue; }
    if (t.t === '}') continue;
    if (t.t === '^') {
      const g = p.groupTokens();
      if (!items.length) throw new Error('^');
      const last = items[items.length - 1];
      // Gradzeichen: 30° → 30·π/180
      if (g.length && g.every(x => x.t === 'sp' || (x.t === 'cmd' && (x.v === 'circ' || x.v === 'degree')))) { last.s = '(' + last.s + '*pi/180)'; last.k = 'close'; continue; }
      const inner = convertSeq(sub(g), dec).s;
      last.s = wrap(last.s) + '^' + wrap(inner); last.k = 'close';
      continue;
    }
    if (t.t === '_') {
      const g = p.groupTokens();
      const txt = convertSeq(sub(g), dec).s.replace(/[^A-Za-z0-9]/g, '');
      const last = items[items.length - 1];
      if (last && last.k === 'id' && txt) last.s = last.s + '_' + txt;
      continue;
    }
    if (t.t === 'ch') {
      const v = t.v;
      if (/[0-9]/.test(v) || isDecPoint(t, dec)) {
        let num = v === (dec === ',' ? ',' : '.') ? '.' : v;
        while (p.peek() && p.peek().t === 'ch' && (/[0-9]/.test(p.peek().v) || (isDecPoint(p.peek(), dec) && /[0-9]/.test((p.peek(1) || {}).v || '')))) {
          const c = p.next().v; num += /[0-9]/.test(c) ? c : '.';
        }
        push(num, 'num'); continue;
      }
      if (/[A-Za-z]/.test(v)) {
        let run = v;
        while (p.peek() && p.peek().t === 'ch' && /[A-Za-z]/.test(p.peek().v)) run += p.next().v;
        splitRun(run, p, items);
        continue;
      }
      if (v === '(' || v === '[') { push(v, 'open'); continue; }
      if (v === ')' || v === ']') { push(v, 'close'); continue; }
      if (v === '!' || v === '%') { push(v, 'post'); continue; }
      if (v === (dec === ',' ? ';' : ',')) { push(',', 'sep'); continue; }
      if (v === ',' || v === ';') { push(',', 'sep'); continue; }
      if (v === '*') { push('*', 'op'); continue; }
      if (v === '|') { push('|', 'op'); continue; }
      push(v, 'op'); continue;
    }
    if (t.t === 'cmd') { convertCmd(t.v, p, dec, items); continue; }
  }
  return { s: join(items), items };
}
function needStar(a, b) {
  if (!a) return false;
  const left = ['num', 'id', 'close', 'post'].includes(a.k);
  const right = ['num', 'id', 'fn', 'open', 'close-start'].includes(b.k) || b.k === 'valfn';
  if (!left || !right) return false;
  if (a.k === 'num' && b.k === 'num') return true;
  if (a.k === 'num' && (b.k === 'id' || b.k === 'open' || b.k === 'fn' || b.k === 'valfn')) return false; // 2x, 2(…), 2sin(x)
  if (a.k === 'id' && a.call) return false;
  return true;
}
function join(items) {
  let s = '';
  for (let j = 0; j < items.length; j++) {
    const a = items[j - 1], b = items[j];
    let k = b.k;
    if (k === 'close' && b.startsValue) k = 'close-start';
    if (needStar(a, { ...b, k: b.k === 'close' ? 'close-start' : b.k })) s += '*';
    s += b.s;
  }
  return s;
}
function knownNames() {
  const n = new Set(FN_NAMES);
  VALUE_NAMES.forEach(x => n.add(x));
  if (typeof K !== 'undefined') {
    Object.keys(K.vars || {}).forEach(x => n.add(x));
    Object.keys(K.funcs || {}).forEach(x => n.add(x));
  }
  return n;
}
function splitRun(run, p, items) {
  const names = knownNames();
  let i = 0;
  while (i < run.length) {
    let best = run[i];
    for (let L = run.length - i; L > 1; L--) { const c = run.slice(i, i + L); if (names.has(c)) { best = c; break; } }
    i += best.length;
    const nextIsParen = i >= run.length && isLeftParen(p);
    const userFn = typeof K !== 'undefined' && K.funcs && K.funcs[best];
    if (FN_NAMES.has(best) && nextIsParen) items.push({ s: best, k: 'fn' });
    else if ((userFn || /^[fghFGH]$/.test(best)) && nextIsParen) items.push({ s: best, k: 'id', call: true });
    else items.push({ s: best === 'Infinity' ? 'Infinity' : best, k: 'id' });
  }
}
function isLeftParen(p) {
  let j = p.i; while (p.tk[j] && p.tk[j].t === 'sp') j++;
  const t = p.tk[j];
  return t && ((t.t === 'cmd' && t.v === 'left' && p.tk[j + 1] && p.tk[j + 1].v === '(') || (t.t === 'ch' && t.v === '('));
}
// \left X … \right Y  →  Inhalt als Text
function leftRight(p, dec) {
  const open = p.next(); // Begrenzer nach \left
  const start = p.i; let d = 1, end = p.i;
  while (!p.eof()) {
    const x = p.next();
    if (x.t === 'cmd' && x.v === 'left') { p.i++; d++; }
    else if (x.t === 'cmd' && x.v === 'right') { d--; if (d === 0) { end = p.i - 1; p.i++; break; } p.i++; }
  }
  const inner = convertSeq(sub(p.tk.slice(start, end)), dec).s;
  return { open: open ? (open.v || open.t) : '(', inner };
}
// nächster Operand (für \sin x, d/dx f, Σ …): bis + - = < > , oder Ende
function operand(p, dec, untilTerm = true) {
  while (p.peek() && p.peek().t === 'sp') p.i++;
  if (isLeftParen(p)) {
    // genau eine Klammer, ggf. mit Hochzahl
    const r = convertSeq(p, dec, (t, pp, items) => items.length >= 1 && !(t.t === '^'));
    return r.s;
  }
  const r = convertSeq(p, dec, (t, pp, items) => {
    if (!untilTerm) return items.length >= 1 && t.t !== '^' && t.t !== '_';
    if (t.t === 'ch' && (STOP_TERM.has(t.v) || t.v === ',' || t.v === ';' || t.v === ':') && items.length) return true;
    if (t.t === 'cmd' && ['le', 'ge', 'ne', 'pm'].includes(t.v)) return true;
    return false;
  });
  return wrap(r.s);
}
function bounds(p, dec) {
  let lo = null, hi = null;
  for (let k = 0; k < 2; k++) {
    while (p.peek() && p.peek().t === 'sp') p.i++;
    const t = p.peek();
    if (t && t.t === '_') { p.i++; lo = p.groupTokens(); }
    else if (t && t.t === '^') { p.i++; hi = p.groupTokens(); }
  }
  return { lo, hi };
}
const tokText = (toks, dec) => toks ? convertSeq(sub(toks), dec).s.trim() : '';
function convertCmd(name, p, dec, items) {
  const push = (s, k) => items.push({ s, k });
  switch (name) {
    case 'left': {
      const r = leftRight(p, dec);
      if (r.open === '|') { push('abs(' + r.inner + ')', 'close'); return; }
      if (r.open === '[') { push('[' + r.inner + ']', 'close'); return; }
      push('(' + r.inner + ')', 'close'); return;
    }
    case 'right': p.i++; return;
    case 'frac': {
      const A = p.groupTokens(), B = p.groupTokens();
      const a = tokText(A, dec), b = tokText(B, dec);
      const dm = a.match(/^d(?:\^\(?(\d+)\)?)?$/), vm = b.match(/^d\*?([A-Za-z])(?:\^\(?(\d+)\)?)?$/);
      if (dm && vm) {
        const order = dm[1] || vm[2];
        const f = operand(p, dec);
        push('diff(' + f + ',' + vm[1] + (order && order !== '1' ? ',' + order : '') + ')', 'close');
        return;
      }
      push('(' + wrap(a) + '/' + wrap(b) + ')', 'close'); return;
    }
    case 'dfrac': case 'tfrac': return convertCmd('frac', p, dec, items);
    case 'sqrt': {
      let n = null;
      if (p.peek() && p.peek().t === 'ch' && p.peek().v === '[') {
        p.i++; const st = p.i; let d = 1;
        while (!p.eof()) { const x = p.next(); if (x.t === 'ch' && x.v === '[') d++; if (x.t === 'ch' && x.v === ']') { d--; if (!d) break; } }
        n = tokText(p.tk.slice(st, p.i - 1), dec);
      }
      const A = tokText(p.groupTokens(), dec);
      push(n ? 'root(' + A + ',' + n + ')' : 'sqrt(' + A + ')', 'close'); return;
    }
    case 'nthroot': { const n = tokText(p.groupTokens(), dec), A = tokText(p.groupTokens(), dec); push('root(' + A + ',' + n + ')', 'close'); return; }
    case 'binom': { const a = tokText(p.groupTokens(), dec), b = tokText(p.groupTokens(), dec); push('nCr(' + a + ',' + b + ')', 'close'); return; }
    case 'sum': case 'prod': {
      const { lo, hi } = bounds(p, dec);
      const l = tokText(lo, dec), h = tokText(hi, dec);
      if (!l || !h) throw new Error(T('err_bounds'));
      const m = l.match(/^([A-Za-z]\w*)=(.+)$/);
      const v = m ? m[1] : 'k', a = m ? m[2] : l;
      const body = operand(p, dec);
      push(name + '(' + body + ',' + v + ',' + a + ',' + h + ')', 'close'); return;
    }
    case 'int': {
      const { lo, hi } = bounds(p, dec);
      const l = tokText(lo, dec), h = tokText(hi, dec);
      // Körper bis zum Differential d<var>
      const st = p.i; let j = p.i, depth = 0, dpos = -1, v = 'x';
      for (; j < p.tk.length; j++) {
        const x = p.tk[j];
        if (x.t === '{' || (x.t === 'cmd' && x.v === 'left')) depth++;
        if (x.t === '}' || (x.t === 'cmd' && x.v === 'right')) depth--;
        if (depth === 0 && x.t === 'ch' && x.v === 'd') {
          let q = j + 1; while (p.tk[q] && p.tk[q].t === 'sp') q++;
          const y = p.tk[q];
          if (y && y.t === 'ch' && /[A-Za-z]/.test(y.v) && !(p.tk[q + 1] && p.tk[q + 1].t === 'ch' && /[A-Za-z]/.test(p.tk[q + 1].v))) { dpos = j; v = y.v; break; }
        }
        if (depth === 0 && x.t === 'ch' && ['=', '<', '>'].includes(x.v)) break;
        if (depth === 0 && isSep(x, dec)) break;
      }
      const bodyToks = p.tk.slice(st, dpos >= 0 ? dpos : j);
      p.i = dpos >= 0 ? dpos + 1 : j;
      if (dpos >= 0) { while (p.peek() && p.peek().t === 'sp') p.i++; p.i++; }
      const body = tokText(bodyToks, dec) || '1';
      push('integrate(' + body + ',' + v + (l && h ? ',' + l + ',' + h : '') + ')', 'close'); return;
    }
    case 'lim': {
      const { lo } = bounds(p, dec);
      let v = 'x', a = '0', dir = '';
      if (lo) {
        const k = lo.findIndex(x => x.t === 'cmd' && (x.v === 'to' || x.v === 'rightarrow'));
        if (k >= 0) {
          v = tokText(lo.slice(0, k), dec) || 'x';
          let rest = lo.slice(k + 1);
          const caret = rest.findIndex(x => x.t === '^');
          if (caret >= 0) { const dd = tokText(rest.slice(caret + 1), dec); dir = /-/.test(dd) ? '-' : '+'; rest = rest.slice(0, caret); }
          a = tokText(rest, dec) || '0';
        }
      }
      const body = operand(p, dec);
      push('limit(' + body + ',' + v + ',' + a + (dir ? ',' + dir : '') + ')', 'close'); return;
    }
    case 'operatorname': {
      const nm = tokText(p.groupTokens(), dec).replace(/\*/g, '');
      return opName(nm, p, dec, items);
    }
    case 'text': case 'mathrm': case 'textrm': {
      const a = tokText(p.groupTokens(), dec).replace(/\*/g, '');
      let key = a;
      while (p.peek() && p.peek().t === 'sp') p.i++;
      if (p.peek() && p.peek().t === '_') { p.i++; key += '_' + tokText(p.groupTokens(), dec).replace(/\*/g, ''); }
      const raw = typeof unescape === 'function' ? key : key;
      push(C_BY_KEY[raw] || C_BY_KEY[a] || a, 'id'); return;
    }
    case 'cdot': case 'times': push('*', 'op'); return;
    case 'div': push('/', 'op'); return;
    case 'le': case 'leq': push('<=', 'op'); return;
    case 'ge': case 'geq': push('>=', 'op'); return;
    case 'ne': case 'neq': push('!=', 'op'); return;
    case 'lt': push('<', 'op'); return;
    case 'gt': push('>', 'op'); return;
    case 'pi': push('pi', 'id'); return;
    case 'infty': push('Infinity', 'id'); return;
    case 'hbar': push('_hb', 'id'); return;
    case 'to': push('->', 'op'); return;
    case 'pm': push('+', 'op'); return;
    case 'circ': case 'degree': push('*pi/180', 'op'); return;
    default:
      if (GREEK[name]) { push(name, 'id'); return; }
      if (MQ_BUILTIN.has(name) || FN_NAMES.has(name)) return opName(name, p, dec, items);
      push(name, 'id');
  }
}
function opName(nm, p, dec, items) {
  nm = TRIG_MAP[nm] || nm;
  if (VALUE_NAMES.has(nm) || (typeof K !== 'undefined' && K.vars && K.vars[nm] !== undefined && !FN_NAMES.has(nm))) { items.push({ s: nm, k: 'id' }); return; }
  // Potenz direkt am Funktionsnamen: sin^2(x)
  let pow = null;
  if (p.peek() && p.peek().t === '^') { p.i++; pow = tokText(p.groupTokens(), dec); }
  let arg;
  if (isLeftParen(p)) {
    while (p.peek().t === 'sp') p.i++;
    if (p.peek().t === 'cmd') { p.i++; arg = leftRight(p, dec).inner; } else { p.i++; arg = convertSeq(p, dec, t => t.t === 'ch' && t.v === ')').s; p.i++; }
  } else arg = operand(p, dec, false).replace(/^\((.*)\)$/, '$1');
  const call = nm + '(' + arg + ')';
  items.push({ s: pow ? '(' + call + ')^(' + pow + ')' : call, k: 'close', startsValue: true });
}

/* ---------- Matrizen/Vektoren als echte Struktur (MathQuill-Embed) ---------- */
ED.MX = {}; let mxN = 0;
const mxSep = () => (typeof S !== 'undefined' && S.dec === ',') ? ';' : ',';
ED.mxNew = m => { const id = 'mx' + (++mxN); ED.MX[id] = m; return id; };
ED.mxBracket = m => m.vec ? '\\left[' + m.rows.map(r => r[0] || '0').join(mxSep()) + '\\right]'
  : '\\left[' + m.rows.map(r => '\\left[' + r.map(c => c || '0').join(mxSep()) + '\\right]').join(mxSep()) + '\\right]';
ED.mxPmat = m => '\\begin{pmatrix}' + m.rows.map(r => r.map(c => c || '0').join('&')).join('\\\\') + '\\end{pmatrix}';
ED.embedTo = (latex, f) => String(latex).replace(/\\embed\{mx\}\[(\w+)\]/g, (s, id) => ED.MX[id] ? f(ED.MX[id]) : s);
ED.pmatToBracket = latex => String(latex).replace(/\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}/g, (s, body) => {
  const rows = body.split('\\\\').map(r => r.split('&').map(x => x.trim()));
  return ED.mxBracket(rows.length > 1 && rows.every(r => r.length === 1) ? { vec: true, rows } : { rows });
});
// Klammer-LaTeX (\left[\left[…\right]…\right]) in Embeds umwandeln
ED.toEmbeds = function (latex) {
  const L = '\\left[', R = '\\right]';
  const matchEnd = (s, i) => { // i zeigt auf \left[ → Index nach passendem \right<x>
    let d = 0, k = i;
    while (k < s.length) {
      if (s.startsWith('\\left', k)) { d++; k += 5; continue; }
      if (s.startsWith('\\right', k)) { d--; k += 6; if (d === 0) return k + 1; continue; }
      k++;
    }
    return -1;
  };
  const splitTop = s => { const out = []; let d = 0, b = 0, cur = '', i = 0;
    while (i < s.length) {
      if (s.startsWith('\\left', i)) { d++; cur += '\\left'; i += 5; continue; }
      if (s.startsWith('\\right', i)) { d--; cur += '\\right'; i += 6; continue; }
      const ch = s[i]; if (ch === '{') b++; if (ch === '}') b--;
      if ((ch === ',' || ch === ';') && d === 0 && b === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
      i++;
    }
    out.push(cur.trim()); return out; };
  let s = String(latex), i = 0, guard = 0;
  while ((i = s.indexOf(L, i)) >= 0 && guard++ < 200) {
    const end = matchEnd(s, i); if (end < 0) break;
    const inner = s.slice(i + L.length, end - R.length), items = splitTop(inner);
    let m = null;
    if (items.length && items.every(x => x.startsWith(L) && x.endsWith(R) && matchEnd(x, 0) === x.length)) {
      const rows = items.map(x => splitTop(x.slice(L.length, -R.length)));
      if (rows.every(r => r.length === rows[0].length && r.every(c => !c.includes(L)))) m = { rows };
    } else if (items.length >= 2 && items.every(x => !x.includes(L))) m = { vec: true, rows: items.map(x => [x]) };
    if (m) { const tag = '\\embed{mx}[' + ED.mxNew(m) + ']'; s = s.slice(0, i) + tag + s.slice(end); i += tag.length; }
    else i += L.length;
  }
  return s;
};
ED.latexToText = function (latex, dec = S.dec) {
  latex = ED.pmatToBracket(ED.embedTo(String(latex || ''), ED.mxBracket));
  // f^{(n)}(…) → f'''…(…) (n-te Ableitung einer Funktion)
  latex = latex.replace(/(^|[^A-Za-z\\])([fgh])\^\{\\left\((\d)\\right\)\}(?=\\left\()/g, (m, pre, n, k) => pre + n + "'".repeat(+k));
  const p = new LP(lexLatex(String(latex || '')));
  let s = convertSeq(p, dec).s;
  return dedupeParens(s);
};

/* =========================================================
   Text → LaTeX (rekursiver Abstieg über kanonischen Text)
   ========================================================= */
function lexText(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const two = s.slice(i, i + 2);
    if ([':=', '<=', '>=', '!=', '=='].includes(two)) { out.push({ t: 'cmp', v: two === '==' ? '=' : two }); i += 2; continue; }
    if ('=<>'.includes(c)) { out.push({ t: 'cmp', v: c }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = s.slice(i).match(/^(\d*\.?\d+(?:[eE][+-]?\d+)?|\d+\.)/);
      out.push({ t: 'num', v: m[0] }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) { const m = s.slice(i).match(/^[A-Za-z_]\w*/); out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    out.push({ t: 'op', v: c }); i++;
  }
  return out;
}
class TP {
  constructor(tk) { this.tk = tk; this.i = 0; }
  peek() { return this.tk[this.i]; }
  next() { return this.tk[this.i++]; }
  is(v) { const t = this.peek(); return t && t.v === v; }
  eat(v) { if (this.is(v)) { this.i++; return true; } return false; }
}
const decT = s => S.dec === ',' ? s.replace('.', '{,}') : s;
const sepT = () => S.dec === ',' ? ';' : ',';
const OPTEX = { '<=': '\\le ', '>=': '\\ge ', '!=': '\\ne ', ':=': ':=', '=': '=', '<': '<', '>': '>' };
function tExpr(p) {
  let s = tAdd(p);
  while (p.peek() && p.peek().t === 'cmp') { const op = p.next().v; s += OPTEX[op] + tAdd(p); }
  return s;
}
function tAdd(p) {
  let s = tMul(p);
  while (p.is('+') || p.is('-')) { const op = p.next().v; s += op + tMul(p); }
  return s;
}
const stripP = s => { // äußere \left(…\right) entfernen, wenn sie den ganzen Ausdruck umschließen
  if (!s.startsWith('\\left(') || !s.endsWith('\\right)')) return s;
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith('\\left', i)) d++;
    else if (s.startsWith('\\right', i)) { d--; if (d === 0 && i < s.length - 7) return s; }
  }
  return s.slice(6, -7);
};
function tMul(p) {
  let s = tUnary(p);
  for (;;) {
    if (p.is('*')) {
      p.i++; const r = tUnary(p);
      const implicit = (/\d$/.test(s) && /^([A-Za-z]|\\left\(|\\pi|\\sqrt|\\sin|\\cos|\\tan|\\ln|\\log|\\operatorname)/.test(r)) || (/\\right\)$/.test(s) && /^\\left\(/.test(r));
      s += (implicit ? '' : '\\cdot ') + r; continue;
    }
    if (p.is('/')) { p.i++; const r = tUnary(p); s = '\\frac{' + stripP(s) + '}{' + stripP(r) + '}'; continue; }
    const t = p.peek();
    if (t && (t.t === 'num' || t.t === 'id' || t.v === '(' || t.v === '[' || t.v === '√')) { s += tUnary(p); continue; }
    break;
  }
  return s;
}
function tUnary(p) {
  if (p.eat('-')) return '-' + tUnary(p);
  if (p.eat('+')) return tUnary(p);
  return tPow(p);
}
function tPow(p) {
  let b = tPost(p);
  if (p.eat('^')) {
    let e;
    if (p.is('-')) { p.i++; e = '-' + tPow(p); } else e = tPow(p);
    b = b + '^{' + stripP(e) + '}';
  }
  return b;
}
function tPost(p) {
  let s = tPrimary(p);
  while (p.is('!') || p.is('%')) s += p.next().v === '%' ? '\\%' : '!';
  return s;
}
function tArgs(p) {
  const args = [];
  if (p.eat(')')) return args;
  for (;;) { args.push(tExpr(p)); if (p.eat(',')) continue; p.eat(')'); break; }
  return args;
}
function tPrimary(p) {
  const t = p.next();
  if (!t) return '';
  if (t.t === 'num') return decT(t.v.replace(/[eE]([+-]?\d+)$/, '\\cdot10^{$1}'));
  if (t.v === '(') { const e = tExpr(p); p.eat(')'); return isOneFrac(e) ? e : '\\left(' + e + '\\right)'; }
  if (t.v === '[') {
    const items = []; if (!p.eat(']')) { for (;;) { items.push(tExpr(p)); if (p.eat(',')) continue; p.eat(']'); break; } }
    return '\\left[' + items.join(sepT()) + '\\right]';
  }
  if (t.v === '|') { const e = tExpr(p); p.eat('|'); return '\\left|' + e + '\\right|'; }
  if (t.t === 'id') {
    const n = t.v;
    if (p.is('(')) { p.i++; return tCall(n, tArgs(p)); }
    if (n === 'pi') return '\\pi ';
    if (n === 'Infinity') return '\\infty ';
    if (n.startsWith('_')) return ED.constLatex(n);
    if (GREEK[n]) return '\\' + n + ' ';
    if (n === 'ans') return '\\operatorname{ans}';
    const m = n.match(/^([A-Za-z]+)_(\w+)$/);
    if (m) return m[1] + '_{' + m[2] + '}';
    return n;
  }
  return t.v;
}
function isOneFrac(e) {
  if (!e.startsWith('\\frac{')) return false;
  let i = 5, groups = 0;
  while (groups < 2) { if (e[i] !== '{') return false; let d = 0; for (; i < e.length; i++) { if (e[i] === '{') d++; else if (e[i] === '}') { d--; if (!d) { i++; break; } } } groups++; }
  return i === e.length;
}
function tCall(n, a) {
  const P = x => stripP(x) !== x || /^\\left[(|[]/.test(x) && stripP(x) !== x ? x : (/^[A-Za-z0-9]+$|^\\pi $/.test(x) && false ? x : '\\left(' + x + '\\right)');
  const S_ = sepT();
  switch (n) {
    case 'sqrt': return '\\sqrt{' + a[0] + '}';
    case 'root': return '\\sqrt[' + (a[1] || 'n') + ']{' + a[0] + '}';
    case 'abs': return '\\left|' + a[0] + '\\right|';
    case 'nCr': if (a.length === 2) return '\\binom{' + a[0] + '}{' + a[1] + '}'; break;
    case 'diff': {
      const v = a[1] || 'x', o = a[2];
      return (o && o !== '1' ? '\\frac{d^{' + o + '}}{d' + v + '^{' + o + '}}' : '\\frac{d}{d' + v + '}') + P(a[0]);
    }
    case 'integrate': {
      const v = a[1] || 'x';
      return '\\int' + (a.length >= 4 ? '_{' + a[2] + '}^{' + a[3] + '}' : '') + ' ' + a[0] + '\\ d' + v;
    }
    case 'limit': return '\\lim_{' + (a[1] || 'x') + '\\to ' + (a[2] || '0') + (a[3] ? '^{' + a[3] + '}' : '') + '}' + P(a[0]);
    case 'sum': case 'prod': return '\\' + n + '_{' + (a[1] || 'k') + '=' + (a[2] || '1') + '}^{' + (a[3] || 'n') + '}' + P(a[0]);
    case 'exp': return 'e^{' + a[0] + '}';
    case 'asin': case 'acos': case 'atan': return '\\' + TRIG_BACK[n] + P(a.join(S_));
  }
  if (TRIG_BACK[n]) return '\\operatorname{' + TRIG_BACK[n] + '}' + P(a.join(S_));
  if (['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'exp', 'det'].includes(n)) return '\\' + n + P(a.join(S_));
  if (MQ_BUILTIN.has(n)) return '\\operatorname{' + n + '}' + P(a.join(S_));
  if (FN_NAMES.has(n)) return '\\operatorname{' + n + '}' + P(a.join(S_));
  return n + P(a.join(S_));
}
ED.textToLatex = function (text) {
  const s = String(text || '').trim();
  if (!s) return '';
  try {
    const p = new TP(lexText(s));
    const parts = [];
    while (p.i < p.tk.length) {
      const before = p.i;
      parts.push(tExpr(p));
      if (p.i === before) { const t = p.next(); parts.push(t.v === ',' ? sepT() : t.v); }
      else if (p.peek() && p.peek().v === ',') { p.i++; parts.push(sepT()); }
    }
    return parts.join('');
  } catch (e) { return s; }
};

// Unicode und Schreibweisen von außen vereinheitlichen (Anzeige-Text → kanonisch)
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+', 'ⁿ': 'n', 'ˣ': 'x' };
const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
const VULG = { '½': '(1/2)', '⅓': '(1/3)', '⅔': '(2/3)', '¼': '(1/4)', '¾': '(3/4)', '⅕': '(1/5)', '⅙': '(1/6)', '⅛': '(1/8)' };
ED.cleanPasted = function (s) {
  s = String(s).replace(/[\u00a0\u2009\u202f]/g, ' ').trim()
    .replace(/^[=≈]\s*/, '').replace(/≈/g, '=')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿˣ]+/g, m => '^(' + m.split('').map(c => SUP[c]).join('') + ')')
    .replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, m => '_' + m.split('').map(c => SUB[c]).join(''))
    .replace(/[½⅓⅔¼¾⅕⅙⅛]/g, m => VULG[m])
    .replace(/(\d) (?=\d{3}\b)/g, '$1');
  s = s.replace(/[×·⋅∙]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/∞/g, 'Infinity')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=')
    .replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([\d.,]+|[A-Za-z]\w*)/g, 'sqrt($1)');
  if (S.dec === ',') s = s.replace(/,/g, '§').replace(/;/g, ',').replace(/§/g, '.');
  return s;
};

if (typeof module !== 'undefined') module.exports = ED;
