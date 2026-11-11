/* ================= Kalkül – Rechenkern =================
   Nutzt nerdamer (exakte Symbolik) und math.js (Numerik, Ableitungen, Matrizen).
   Erwartet globale Objekte: math, nerdamer, T(key, vars), S (Einstellungen). */

const K = {};
K.vars = {};   // name -> Ausdruck (String)
K.funcs = {};  // name -> {params:[..], body}

/* ---------- Konstanten (CODATA 2018) ---------- */
K.CONST = {
  _c:  { v: '299792458', tex: 'c', u: 'm/s' },
  _h:  { v: '6.62607015e-34', tex: 'h', u: 'J·s' },
  _hb: { v: '1.054571817e-34', tex: '\\hbar', u: 'J·s' },
  _NA: { v: '6.02214076e23', tex: 'N_A', u: '1/mol' },
  _kB: { v: '1.380649e-23', tex: 'k_B', u: 'J/K' },
  _R:  { v: '8.314462618', tex: 'R', u: 'J/(mol·K)' },
  _F:  { v: '96485.33212', tex: 'F', u: 'C/mol' },
  _qe: { v: '1.602176634e-19', tex: 'e', u: 'C' },
  _me: { v: '9.1093837015e-31', tex: 'm_e', u: 'kg' },
  _mp: { v: '1.67262192369e-27', tex: 'm_p', u: 'kg' },
  _u:  { v: '1.66053906660e-27', tex: 'u', u: 'kg' },
  _eps0: { v: '8.8541878128e-12', tex: '\\varepsilon_0', u: 'F/m' },
  _g:  { v: '9.80665', tex: 'g', u: 'm/s²' },
  _Vm: { v: '0.02241396954', tex: 'V_m', u: 'm³/mol' },
  _G:  { v: '6.67430e-11', tex: 'G', u: 'm³/(kg·s²)' },
  _atm: { v: '101325', tex: 'p_0', u: 'Pa' },
  _phi: { v: '(1+sqrt(5))/2', tex: '\\varphi', u: '' },
  _mu0: { v: '1.25663706212e-6', tex: '\\mu_0', u: 'N/A²' },
  _sigma: { v: '5.670374419e-8', tex: '\\sigma', u: 'W/(m²·K⁴)' },
  _T0: { v: '273.15', tex: 'T_0', u: 'K' },
  _a0: { v: '5.29177210903e-11', tex: 'a_0', u: 'm' }
};

/* ---------- Text-Werkzeuge ---------- */
const OPEN = '([{', CLOSE = ')]}';
function matchClose(s, i) {
  let d = 0;
  for (let j = i; j < s.length; j++) {
    if (OPEN.includes(s[j])) d++;
    else if (CLOSE.includes(s[j])) { d--; if (d === 0) return j; }
  }
  return -1;
}
function splitTop(s, sep = ',') {
  const out = []; let d = 0, cur = '';
  for (const ch of s) {
    if (OPEN.includes(ch)) d++;
    if (CLOSE.includes(ch)) d--;
    if (ch === sep && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim() !== '' || out.length) out.push(cur.trim());
  return out;
}
function rewriteCalls(s, name, fn) {
  const re = new RegExp('(^|[^A-Za-z0-9_])' + name + '\\s*\\(', 'g');
  let guard = 0, m;
  while ((m = re.exec(s)) && guard++ < 500) {
    const start = m.index + m[1].length;
    const open = s.indexOf('(', start + name.length);
    const close = matchClose(s, open);
    if (close < 0) throw new Error(T('err_paren'));
    const inner = rewriteCalls(s.slice(open + 1, close), name, fn);
    const rep = fn(splitTop(inner));
    s = s.slice(0, start) + rep + s.slice(close + 1);
    re.lastIndex = 0;
  }
  return s;
}
// gesamte Eingabe ist ein Funktionsaufruf name(...)?
function topCall(s) {
  const m = s.match(/^([A-Za-z_]\w*)\s*\(/);
  if (!m) return null;
  const open = m[0].length - 1;
  if (matchClose(s, open) !== s.length - 1) return null;
  return { name: m[1], args: splitTop(s.slice(open + 1, -1)) };
}
// oberste Ebene: '=' (kein :=, ==, <=, >=, !=)
function splitEq(s) {
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (OPEN.includes(ch)) d++;
    else if (CLOSE.includes(ch)) d--;
    else if (ch === '=' && d === 0 && !'<>!:='.includes(s[i - 1] || '') && s[i + 1] !== '=')
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
  }
  return null;
}

// oberste Ebene: Vergleich <, >, <=, >=, !=
function splitCmp(s) {
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (OPEN.includes(ch)) d++;
    else if (CLOSE.includes(ch)) d--;
    else if (d === 0 && (ch === '<' || ch === '>' || (ch === '!' && s[i + 1] === '='))) {
      const two = s.slice(i, i + 2);
      const op = ['<=', '>=', '!='].includes(two) ? two : ch;
      return [s.slice(0, i).trim(), op, s.slice(i + op.length).trim()];
    }
  }
  return null;
}
K.splitCmp = splitCmp;
/* ---------- Normalisierung ---------- */
K.normalize = function (s) {
  s = String(s)
    .replace(/[×·⋅∙]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')
    .replace(/π/g, 'pi').replace(/∞/g, 'Infinity').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/λ/g, 'l').replace(/θ/g, 't').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=')
    .replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([\d.]+|[A-Za-z]\w*)/g, 'sqrt($1)')
    .replace(/\s+/g, ' ').trim();
  if (S.dec === ',') s = s.replace(/,/g, '.').replace(/;/g, ',');
  s = s.replace(/(\d+(?:\.\d+)?)\s*%(?!\s*[\d(])/g, '($1/100)');
  s = s.replace(/\b(inf|infinity|oo)\b/gi, 'Infinity').replace(/:(?!=)/g, '/');
  s = s.replace(/\barc?(sinh|cosh|tanh|coth|sech|csch)\s*\(/g, 'a$1(').replace(/\barc(sin|cos|tan|cot|sec|csc)\s*\(/g, 'a$1(');
  s = s.replace(/\bsgn\s*\(/g, 'sign(');
  s = s.replace(/\bder\b|\bderivative\b|\bd\s*\/\s*dx\b/g, 'diff')
    .replace(/\bint\s*\(/g, 'integrate(').replace(/\blim\s*\(/g, 'limit(')
    .replace(/\bproduct\s*\(/g, 'prod(').replace(/\bbinom\s*\(/g, 'nCr(');
  return s;
};

function applyDefs(s, skip = []) {
  // Ableitungen definierter Funktionen: f'(a), f''(a), f'''(a)
  s = s.replace(/([A-Za-z]\w*)('{1,9})\s*\(/g, (m, name, pr) => {
    const f = K.funcs[name];
    if (!f) throw new Error(T('err_undef_fn', { n: name }));
    if (f.params.length !== 1 || skip.includes(name)) return m;
    const key = name + '__d' + pr.length;
    if (!K._derived || !K._derived[key] || K._derived[key].src !== f.body) {
      try {
        const d = nerdamer(`diff(${toN(f.body)},${f.params[0]},${pr.length})`).toString();
        K._derived = K._derived || {}; K._derived[key] = { params: f.params, body: K.mjToUser(fromN(d)), src: f.body };
      } catch (e) { return m; }
    }
    return key + '(';
  });
  const all = Object.assign({}, K.funcs, K._derived || {});
  for (const [name, f] of Object.entries(all)) {
    if (skip.includes(name)) continue;
    s = rewriteCalls(s, name, args => {
      let body = f.body;
      f.params.forEach((p, i) => {
        body = body.replace(new RegExp('\\b' + p + '\\b', 'g'), '§' + i + '§');
      });
      f.params.forEach((p, i) => { body = body.split('§' + i + '§').join('(' + (args[i] ?? p) + ')'); });
      return '(' + body + ')';
    });
  }
  for (const [name, v] of Object.entries(K.vars)) {
    if (skip.includes(name)) continue;
    s = s.replace(new RegExp('(^|[^A-Za-z0-9_])' + name + '(?![A-Za-z0-9_(])', 'g'), '$1(' + v + ')');
  }
  return s;
}
function applyConsts(s) {
  return s.replace(/_[A-Za-z]\w*/g, m => {
    const c = K.CONST[m]; if (!c) return m;
    const v = c.v.replace(/e(-?\d+)$/, '*10^($1)');
    return '(' + v + ')';
  });
}
function bigFact(n) { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; }
function bigBinom(n, k) {
  n = BigInt(n); k = BigInt(k); if (k < 0n || k > n) return 0n;
  if (k > n - k) k = n - k; let r = 1n;
  for (let i = 1n; i <= k; i++) r = r * (n - k + i) / i;
  return r;
}
const isIntLit = a => /^\s*\d+\s*$/.test(a);

function degWrap(s) {
  if (S.angle !== 'deg') return s;
  for (const f of ['sin', 'cos', 'tan', 'cot', 'sec', 'csc'])
    s = rewriteCalls(s, f, a => `${f.toUpperCase()}D((${a[0]})*pi/180)`);
  for (const f of ['asin', 'acos', 'atan', 'acot', 'asec', 'acsc'])
    s = rewriteCalls(s, f, a => `(${f.toUpperCase()}D(${a[0]})*180/pi)`);
  return s.replace(/([A-Z]+)D\(/g, (m, f) => f.toLowerCase() + '(');
}

// in math.js-Syntax
function toM(s, numeric = true) {
  s = rewriteCalls(s, 'log', a => a.length > 1 ? `LOGB(${a[0]},${a[1]})` : `LOGT(${a[0]})`);
  s = rewriteCalls(s, 'lg', a => `LOGT(${a[0]})`);
  s = rewriteCalls(s, 'ln', a => `LOGN(${a[0]})`);
  s = rewriteCalls(s, 'root', a => numeric ? `nthRoot(${a[0]},${a[1]})` : `(${a[0]})^(1/(${a[1]}))`);
  s = rewriteCalls(s, 'nCr', a => `combinations(${a[0]},${a[1]})`);
  s = rewriteCalls(s, 'nPr', a => `permutations(${a[0]},${a[1]})`);
  s = rewriteCalls(s, 'fact', a => `factorial(${a[0]})`);
  return s.replace(/LOGB\(/g, 'log(').replace(/LOGT\(/g, 'log10(').replace(/LOGN\(/g, 'log(');
}
// nerdamer-Ausgabe → math.js
function fromN(s) { return toM(String(s).replace(/\blog10\(/g, 'lg(').replace(/\blog\(/g, 'ln('), true); }
// in nerdamer-Syntax
function toN(s) {
  s = rewriteCalls(s, 'log', a => a.length > 1 ? `(LOGN(${a[0]})/LOGN(${a[1]}))` : `LOGT(${a[0]})`);
  s = rewriteCalls(s, 'lg', a => `LOGT(${a[0]})`);
  s = rewriteCalls(s, 'ln', a => `LOGN(${a[0]})`);
  s = rewriteCalls(s, 'root', a => `((${a[0]})^(1/(${a[1]})))`);
  s = rewriteCalls(s, 'nCr', a => isIntLit(a[0]) && isIntLit(a[1]) ? '(' + bigBinom(a[0], a[1]) + ')'
    : `(fact(${a[0]})/(fact(${a[1]})*fact((${a[0]})-(${a[1]}))))`);
  s = rewriteCalls(s, 'nPr', a => isIntLit(a[0]) && isIntLit(a[1]) ? '(' + (bigFact(a[0]) / bigFact(+a[0] - +a[1])) + ')'
    : `(fact(${a[0]})/fact((${a[0]})-(${a[1]})))`);
  s = s.replace(/(^|[^\w.)])(\d{1,4})\s*!/g, (m, p, n) => p + (+n <= 400 ? '(' + bigFact(n) + ')' : 'fact(' + n + ')'));
  s = s.replace(/\bnthRoot\(/g, 'nthroot(');
  return s.replace(/LOGN\(/g, 'log(').replace(/LOGT\(/g, 'log10(');
}

/* ---------- Formatierung ---------- */
function decFix(t) { return S.dec === ',' ? t.replace(/(\d)\.(\d)/g, '$1{,}$2') : t; }
K.decFix = decFix;
function fmtReal(x) {
  if (!isFinite(x)) return isNaN(x) ? '\\text{n. d.}' : (x > 0 ? '\\infty' : '-\\infty');
  if (x === 0) return '0';
  const d = S.digits, ax = Math.abs(x);
  let s;
  if (ax >= 1e12 || ax < 1e-6) s = x.toExponential(d - 1);
  else s = String(Number(x.toPrecision(d)));
  let [mant, ex] = s.split('e');
  if (mant.includes('.')) mant = mant.replace(/0+$/, '').replace(/\.$/, '');
  if (!ex && mant.includes('e')) { [mant, ex] = mant.split('e'); }
  return decFix(mant) + (ex ? '\\cdot 10^{' + parseInt(ex) + '}' : '');
}
function fmtVal(v) {
  if (v == null) return '';
  if (typeof v === 'number') return fmtReal(v);
  if (typeof v === 'boolean') return v ? '\\text{wahr}' : '\\text{falsch}';
  if (typeof v === 'bigint') return String(v);
  if (v.isFraction || (v.d !== undefined && v.n !== undefined && v.s !== undefined)) {
    const n = v.s * v.n, d = v.d;
    return d === 1 ? String(n) : (n < 0 ? '-' : '') + '\\frac{' + Math.abs(n) + '}{' + d + '}';
  }
  if (v.isComplex || (v.re !== undefined && v.im !== undefined)) {
    const re = Math.abs(v.re) < 1e-14 * Math.max(1, Math.abs(v.im)) ? 0 : v.re;
    const im = Math.abs(v.im) < 1e-14 * Math.max(1, Math.abs(v.re)) ? 0 : v.im;
    if (im === 0) return fmtReal(re);
    const imS = Math.abs(im) === 1 ? '' : fmtReal(Math.abs(im));
    return (re !== 0 ? fmtReal(re) + (im < 0 ? '-' : '+') : (im < 0 ? '-' : '')) + imS + 'i';
  }
  if (v.isMatrix || Array.isArray(v)) {
    const a = v.toArray ? v.toArray() : v;
    if (!Array.isArray(a[0])) return '\\begin{pmatrix}' + a.map(fmtVal).join('\\\\') + '\\end{pmatrix}';
    return '\\begin{pmatrix}' + a.map(r => r.map(fmtVal).join('&')).join('\\\\') + '\\end{pmatrix}';
  }
  if (v.isUnit) return decFix(v.toString());
  if (v.entries) return fmtVal(v.entries[v.entries.length - 1]);
  if (typeof v === 'function') return '\\text{' + T('fn_saved') + '}';
  return decFix(String(v));
}
K.fmtVal = fmtVal; K.fmtReal = fmtReal;

/* ---------- TeX der Eingabe ---------- */
const FN_TEX = { sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', csc: '\\csc', asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', coth: '\\coth', exp: '\\exp', ln: '\\ln', lg: '\\lg', det: '\\det',
  acot: '\\operatorname{arccot}', asec: '\\operatorname{arcsec}', acsc: '\\operatorname{arccsc}', sech: '\\operatorname{sech}', csch: '\\operatorname{csch}',
  asinh: '\\operatorname{arsinh}', acosh: '\\operatorname{arcosh}', atanh: '\\operatorname{artanh}', acoth: '\\operatorname{arcoth}', asech: '\\operatorname{arsech}', acsch: '\\operatorname{arcsch}',
  sign: '\\operatorname{sgn}', re: '\\operatorname{Re}', im: '\\operatorname{Im}', arg: '\\arg', conj: '\\operatorname{conj}', hypot: '\\operatorname{hypot}', identity: '\\operatorname{E}' };
function texHandler(node, opt) {
  if (node.isSymbolNode && !node._fn) {
    if (K.CONST[node.name]) return K.CONST[node.name].tex;
    if (node.name === 'Infinity') return '\\infty';
    if (node.name === 'l') return '\\lambda';
  }
  if (node.isFunctionNode) {
    const n = node.fn.name, a = node.args, t = x => x.toTex(opt);
    switch (n) {
      case 'sqrt': return '\\sqrt{' + t(a[0]) + '}';
      case 'root': case 'nthRoot': return '\\sqrt[' + t(a[1]) + ']{' + t(a[0]) + '}';
      case 'abs': return '\\left|' + t(a[0]) + '\\right|';
      case 'log': return a.length > 1 ? '\\log_{' + t(a[1]) + '}\\left(' + t(a[0]) + '\\right)' : '\\ln\\left(' + t(a[0]) + '\\right)';
      case 'log10': return '\\log_{10}\\left(' + t(a[0]) + '\\right)';
      case 'nCr': case 'combinations': return '\\binom{' + t(a[0]) + '}{' + t(a[1]) + '}';
      case 'nPr': case 'permutations': return 'P\\left(' + t(a[0]) + ',' + t(a[1]) + '\\right)';
      case 'fact': return '\\left(' + t(a[0]) + '\\right)!';
      case 'diff': return (a[2] ? '\\frac{d^{' + t(a[2]) + '}}{d' + t(a[1] || 'x') + '^{' + t(a[2]) + '}}' : '\\frac{d}{d' + (a[1] ? t(a[1]) : 'x') + '}') + '\\left(' + t(a[0]) + '\\right)';
      case 'integrate': {
        const v = a[1] ? t(a[1]) : 'x';
        return '\\int' + (a.length >= 4 ? '_{' + t(a[2]) + '}^{' + t(a[3]) + '}' : '') + ' ' + t(a[0]) + '\\,d' + v;
      }
      case 'limit': return '\\lim_{' + (a[1] ? t(a[1]) : 'x') + '\\to ' + (a[2] ? t(a[2]) : '0') + (a[3] ? '^{' + (String(a[3]).includes('-') ? '-' : '+') + '}' : '') + '}' + t(a[0]);
      case 'sum': return '\\sum_{' + t(a[1]) + '=' + t(a[2]) + '}^{' + t(a[3]) + '}\\left(' + t(a[0]) + '\\right)';
      case 'prod': return '\\prod_{' + t(a[1]) + '=' + t(a[2]) + '}^{' + t(a[3]) + '}\\left(' + t(a[0]) + '\\right)';
      case 'transpose': return t(a[0]) + '^{T}';
      case 'inv': return t(a[0]) + '^{-1}';
    }
    if (FN_TEX[n]) return FN_TEX[n] + '\\left(' + a.map(t).join(',') + '\\right)';
  }
}
K.texOf = function (s) {
  // s: normalisierte Nutzer-Eingabe
  try {
    const def = s.match(/^(.+?)\s*:=\s*(.+)$/);
    if (def) return K.texOf(def[1]) + ' := ' + K.texOf(def[2]);
    const cmp = splitCmp(s);
    if (cmp) return K.texOf(cmp[0]) + ({ '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ', '!=': '\\ne ' }[cmp[1]]) + K.texOf(cmp[2]);
    const eq = splitEq(s);
    if (eq) return K.texOf(eq[0]) + ' = ' + K.texOf(eq[1]);
    const c = topCall(s);
    if (c && c.name === 'solve') return '\\operatorname{solve}\\left(' + c.args.map(K.texOf).join(',\\;') + '\\right)';
    const s2 = s.replace(/([A-Za-z]\w*)('{1,9})\s*\(/g, (m, n, p) => n + 'PRIME' + p.length + '(');
    const node = math.parse(s2.replace(/(\d+(?:\.\d+)?)%/g, '$1/100'));
    return tidy(decFix(node.toTex({ handler: texHandler, parenthesis: 'keep', implicit: 'hide' }))).replace(/(?:\\mathrm\{|\\operatorname\{)?([A-Za-z]\w*?)PRIME(\d)\}?/g, (m, n, k) => +k > 3 ? n + '^{(' + k + ')}' : n + "'".repeat(+k));
  } catch (e) { return null; }
};
const tidy = t => t.replace(/bmatrix/g, 'pmatrix').replace(/\{\s+([A-Za-z])\}/g, '{$1}').replace(/\(\s+([A-Za-z])\\right/g, '($1\\right').replace(/~\s*/g, '\\,').replace(/\\left\(\s+/g, '\\left(');
const texM = n => tidy(decFix(n.toTex({ handler: texHandler, parenthesis: 'auto', implicit: 'hide' })));
const texMk = n => tidy(decFix(n.toTex({ handler: texHandler, parenthesis: 'keep', implicit: 'hide' })));
function texN(s) {
  try {
    let t = nerdamer(s).toTeX();
    t = t.replace(/\\mathrm\{log\}_\{10\}/g, 'LOGTEN').replace(/\\mathrm\{log10\}/g, 'LOGTEN').replace(/\\mathrm\{log\}/g, '\\ln').replace(/\\log\\left/g, '\\ln\\left').replace(/\\log\(/g, '\\ln(').replace(/LOGTEN/g, '\\log_{10}')
      .replace(/\\mathrm\{(\w+)\}/g, (m, f) => FN_TEX[f] || '\\operatorname{' + f + '}')
      .replace(/\\mathrm\{(asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|exp)\}/g, (m, f) => '\\' + ({ asin: 'arcsin', acos: 'arccos', atan: 'arctan' }[f] || f));
    return decFix(t);
  } catch (e) { return decFix(String(s)); }
}
K.texN = texN;

/* ---------- Numerik ---------- */
function freeSyms(sM) {
  const names = new Set();
  math.parse(sM).traverse((n, path, parent) => {
    if (n.isSymbolNode && !(parent && parent.isFunctionNode && path === 'fn')) names.add(n.name);
  });
  ['pi', 'e', 'i', 'Infinity', 'E', 'PI', 'NaN', 'true', 'false', 'phi', 'tau'].forEach(k => names.delete(k));
  return [...names];
}
K.freeSyms = freeSyms;
function compileFn(sM, v = 'x') {
  const c = math.compile(sM);
  return x => {
    try {
      const r = c.evaluate({ [v]: x });
      if (typeof r === 'number') return r;
      if (r && r.re !== undefined) return Math.abs(r.im) < 1e-12 ? r.re : NaN;
      if (r && r.isFraction) return r.valueOf();
      return Number(r);
    } catch (e) { return NaN; }
  };
}
K.compileFn = compileFn;
function numEval(sM, scope = {}) {
  const r = math.evaluate(sM, scope);
  return r;
}
function toNum(r) {
  if (typeof r === 'number') return r;
  if (r && r.re !== undefined) return Math.abs(r.im) < 1e-10 ? r.re : NaN;
  if (r && r.isFraction) return r.valueOf();
  const x = Number(r); return x;
}
// Nullstellen numerisch suchen
function findRoots(f, lo = -60, hi = 60, N = 12000) {
  const out = [];
  const add = x => {
    if (!isFinite(x)) return;
    const y = f(x);
    if (!(Math.abs(y) < 1e-7 * (1 + Math.abs(x)))) return;
    const sc = Math.max(...[0.5, 1, -0.5, -1].map(d => Math.abs(f(x + d))).filter(isFinite), 0);
    if (!(sc > 1e-100) || !(Math.abs(y) <= 1e-7 * sc + 1e-300)) return;
    if (!out.some(r => Math.abs(r - x) < 1e-6 * (1 + Math.abs(x)))) out.push(x);
  };
  const bis = (a, b) => {
    let fa = f(a);
    for (let k = 0; k < 80; k++) {
      const m = (a + b) / 2, fm = f(m);
      if (fm === 0) return m;
      if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  };
  const h = (hi - lo) / N;
  let px = lo, py = f(lo);
  for (let i = 1; i <= N; i++) {
    const x = lo + i * h, y = f(x);
    if (y === 0) add(x);
    else if (isFinite(py) && isFinite(y) && Math.sign(py) !== Math.sign(y) && py !== 0) {
      const r = bis(px, x);
      // Pol ausschließen
      if (Math.abs(f(r)) < 1e-6 * (1 + Math.abs(py) + Math.abs(y))) add(r);
    }
    px = x; py = y;
  }
  // Berührstellen: lokale Minima von |f|
  for (let i = 1; i < N; i++) {
    const a = lo + (i - 1) * h, b = lo + i * h, c = lo + (i + 1) * h;
    const fa = Math.abs(f(a)), fb = Math.abs(f(b)), fc = Math.abs(f(c));
    if (fb < fa && fb < fc && fb < 1e-3) {
      let l = a, r = c;
      for (let k = 0; k < 100; k++) {
        const m1 = l + (r - l) / 3, m2 = r - (r - l) / 3;
        if (Math.abs(f(m1)) < Math.abs(f(m2))) r = m2; else l = m1;
      }
      add((l + r) / 2);
    }
  }
  return out.sort((a, b) => a - b).map(x => Math.abs(x) < 1e-10 ? 0 : x);
}
K.findRoots = findRoots;
function simpson(f0, a, b, n = 2000) {
  const f = x => { const y = f0(x); if (!isNaN(y)) return y; const e = 1e-7 * (1 + Math.abs(x)); return (f0(x - e) + f0(x + e)) / 2; };
  const h = (b - a) / n; let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return s * h / 3;
}

/* ---------- Schritt-Helfer ---------- */
const step = (title, tex, note) => ({ title, tex, note });

/* =========================================================
   1) Arithmetik Schritt für Schritt (exakte Brüche)
   ========================================================= */
const C = v => new math.ConstantNode(v);
function mkVal(v) {
  let node;
  if (v.f) {
    const fr = v.f, n = fr.n, d = fr.d;
    node = d === 1 ? C(n) : new math.OperatorNode('/', 'divide', [C(n), C(d)]);
    if (fr.s < 0 && n !== 0) node = new math.ParenthesisNode(new math.OperatorNode('-', 'unaryMinus', [node]));
  } else {
    const x = Number(v.x.toPrecision(12));
    node = C(Math.abs(x));
    if (x < 0) node = new math.ParenthesisNode(new math.OperatorNode('-', 'unaryMinus', [node]));
  }
  node._v = v;
  return node;
}
function valOf(n) {
  if (n._v) return n._v;
  if (n.isParenthesisNode) return valOf(n.content);
  if (n.isConstantNode && typeof n.value === 'number')
    return Number.isInteger(n.value) ? { f: math.fraction(n.value) } : { x: n.value };
  return null;
}
const fv = v => v.f ? v.f.valueOf() : v.x;
const fracTex = f => (f.s < 0 ? '-' : '') + (f.d === 1 ? f.n : '\\frac{' + f.n + '}{' + f.d + '}');
function kurz(n, d) { const g = math.gcd(Math.abs(n), Math.abs(d)); return g > 1 ? { g, tex: '=\\frac{' + n + ':' + g + '}{' + d + ':' + g + '}' } : null; }
function applyOp(n, vs) {
  const name = n.isOperatorNode ? n.fn : n.fn.name;
  const allF = vs.every(v => v.f);
  const F = vs.map(v => v.f);
  const fl = r => ({ v: { x: r } });
  switch (name) {
    case 'add': case 'subtract': {
      const sub = name === 'subtract';
      if (allF) {
        const [a, b] = F, r = sub ? a.sub(b) : a.add(b);
        let detail;
        if (a.d !== 1 || b.d !== 1) {
          if (a.d !== b.d) {
            const L = math.lcm(a.d, b.d);
            detail = fracTex(a) + (sub ? '-' : '+') + fracTex(b) + '=' +
              '\\frac{' + (a.s * a.n * L / a.d) + '}{' + L + '}' + (sub ? '-' : '+') + '\\frac{' + (b.s * b.n * L / b.d) + '}{' + L + '}' +
              '=\\frac{' + ((sub ? a.sub(b) : a.add(b)).mul(L).valueOf()) + '}{' + L + '}';
            const N = (sub ? a.sub(b) : a.add(b)).mul(L).valueOf(), k = r.d !== L ? kurz(N, L) : null;
            return { v: { f: r }, label: T('st_frac_common', { n: L }) + (k ? ', ' + T('reduced_by', { g: k.g }) : ''), detail: decFix(detail + (k ? k.tex + '=' + fracTex(r) : (r.d !== L ? '=' + fracTex(r) : ''))) };
          }
          const N = (sub ? a.sub(b) : a.add(b)).mul(a.d).valueOf(), k = r.d !== a.d ? kurz(N, a.d) : null;
          return { v: { f: r }, label: T(sub ? 'st_sub' : 'st_add') + (k ? ', ' + T('reduced_by', { g: k.g }) : ''), detail: '\\frac{' + (a.s * a.n) + (sub ? '-' : '+') + (b.s * b.n < 0 ? '(' + b.s * b.n + ')' : b.n) + '}{' + a.d + '}=\\frac{' + N + '}{' + a.d + '}' + (k ? k.tex + '=' + fracTex(r) : '') };
        }
        return { v: { f: r }, label: T(sub ? 'st_sub' : 'st_add') };
      }
      return { ...fl(sub ? fv(vs[0]) - fv(vs[1]) : fv(vs[0]) + fv(vs[1])), label: T(sub ? 'st_sub' : 'st_add') };
    }
    case 'multiply': {
      if (allF) {
        const [a, b] = F, r = a.mul(b);
        let detail;
        let k = null;
        if (a.d !== 1 || b.d !== 1) {
          const N = a.s * a.n * b.s * b.n, D = a.d * b.d; k = kurz(N, D);
          detail = '\\frac{' + (a.s * a.n) + '\\cdot ' + (b.s * b.n < 0 ? '(' + b.s * b.n + ')' : b.n) + '}{' + a.d + '\\cdot ' + b.d + '}=\\frac{' + N + '}{' + D + '}' + (k ? k.tex : '') + '=' + fracTex(r);
        }
        return { v: { f: r }, label: T('st_mul') + (k ? ', ' + T('reduced_by', { g: k.g }) : ''), detail };
      }
      return { ...fl(fv(vs[0]) * fv(vs[1])), label: T('st_mul') };
    }
    case 'divide': {
      if (fv(vs[1]) === 0) throw new Error(T('err_div0'));
      if (allF) {
        const [a, b] = F, r = a.div(b);
        if (a.d === 1 && b.d === 1) {
          const g = math.gcd(a.n, b.n);
          if (g > 1 && b.n !== g) return { v: { f: r }, label: T('st_reduce_g', { g }), detail: '\\frac{' + (a.s * a.n) + '}{' + (b.s * b.n) + '}=\\frac{' + (a.s * a.n) + ':' + g + '}{' + (b.s * b.n) + ':' + g + '}=' + fracTex(r) };
          return { v: { f: r }, label: T('st_div') };
        }
        const inv = b.inverse(), N = a.s * a.n * inv.s * inv.n, D = a.d * inv.d, k = kurz(N, D);
        return { v: { f: r }, label: T('st_frac_recip') + (k ? ', ' + T('reduced_by', { g: k.g }) : ''), detail: fracTex(a) + ':' + fracTex(b) + '=' + fracTex(a) + '\\cdot ' + fracTex(inv) + '=\\frac{' + N + '}{' + D + '}' + (k ? k.tex : '') + '=' + fracTex(r) };
      }
      return { ...fl(fv(vs[0]) / fv(vs[1])), label: T('st_div') };
    }
    case 'pow': {
      const [a, b] = vs;
      if (a.f && b.f && b.f.d === 1 && Math.abs(b.f.valueOf()) <= 64) {
        const e = b.f.valueOf();
        if (e < 0 && a.f.n === 0) throw new Error(T('err_div0'));
        const r = a.f.pow(e);
        if (Math.abs(r.n) < 9e15 && r.d < 9e15) {
          let detail;
          if (e >= 2 && e <= 5) detail = Array(e).fill(a.f.d === 1 && a.f.s > 0 ? a.f.n : '\\left(' + fracTex(a.f) + '\\right)').join('\\cdot ') + '=' + fracTex(r);
          return { v: { f: r }, label: T('st_pow'), detail };
        }
      }
      if (a.f && b.f && b.f.n === 1 && b.f.d > 1) { // rationale Wurzel
        const x = fv(a), k = b.f.d, rt = Math.round(Math.sign(x) * Math.pow(Math.abs(x), 1 / k));
        if (rt ** k === x) return { v: { f: math.fraction(rt) }, label: T('st_root') };
      }
      return { ...fl(Math.pow(fv(a), fv(b))), label: T('st_pow') };
    }
    case 'unaryMinus': return { v: vs[0].f ? { f: vs[0].f.neg() } : { x: -vs[0].x }, label: T('st_neg') };
    case 'unaryPlus': return { v: vs[0], label: T('st_neg') };
    case 'factorial': {
      const x = fv(vs[0]);
      if (!Number.isInteger(x) || x < 0) throw new Error(T('err_fact'));
      const r = Number(bigFact(x));
      return { v: x <= 18 ? { f: math.fraction(r) } : { x: r }, label: T('c_fact'), detail: x >= 2 && x <= 10 ? x + '!=' + Array.from({ length: x }, (_, i) => x - i).join('\\cdot ') + '=' + r : undefined };
    }
    case 'sqrt': {
      const v = vs[0];
      if (v.f && v.f.s >= 0) {
        const rn = Math.round(Math.sqrt(v.f.n)), rd = Math.round(Math.sqrt(v.f.d));
        if (rn * rn === v.f.n && rd * rd === v.f.d) return { v: { f: math.fraction(rn, rd) }, label: T('st_root') };
      }
      if (fv(v) < 0) return null;
      return { ...fl(Math.sqrt(fv(v))), label: T('st_root') };
    }
    case 'nthRoot': {
      const x = fv(vs[0]), k = fv(vs[1]);
      const r = math.nthRoot(x, k);
      if (vs[0].f && Number.isInteger(r)) return { v: { f: math.fraction(r) }, label: T('st_root') };
      return { ...fl(r), label: T('st_root') };
    }
    case 'abs': return { v: vs[0].f ? { f: vs[0].f.abs() } : { x: Math.abs(vs[0].x) }, label: T('st_fn', { f: '|·|' }) };
    case 'combinations': case 'permutations': {
      const r = math[name](fv(vs[0]), fv(vs[1]));
      return { v: { f: math.fraction(r) }, label: T(name === 'combinations' ? 'c_binom' : 'c_perm') };
    }
    case 'mod': return { v: { f: math.fraction(math.mod(fv(vs[0]), fv(vs[1]))) }, label: T('st_fn', { f: 'mod' }) };
    default:
      if (typeof math[name] === 'function' && n.isFunctionNode) {
        const r = math[name](...vs.map(fv));
        if (typeof r !== 'number' || !isFinite(r)) return null;
        if (Number.isInteger(r) && Math.abs(r) < 1e15) return { v: { f: math.fraction(r) }, label: T('st_fn', { f: name }) };
        return { ...fl(r), label: T('st_fn', { f: name }) };
      }
  }
  return null;
}
function reduceOnce(n) {
  if (n._v) return null;
  if (n.isParenthesisNode) {
    const r = reduceOnce(n.content);
    if (!r) {
      // Klammer um einen Wert: entfernen
      if (n.content._v && !n.content.isParenthesisNode) { const k = n.content; return { node: k, silent: true }; }
      return null;
    }
    const c = r.node;
    return { ...r, node: c._v ? c : new math.ParenthesisNode(c) };
  }
  if (n.args) {
    for (let i = 0; i < n.args.length; i++) {
      const r = reduceOnce(n.args[i]);
      if (r) {
        const args = n.args.slice(); args[i] = r.node;
        const cl = n.isOperatorNode ? new math.OperatorNode(n.op, n.fn, args, n.implicit) : new math.FunctionNode(n.fn, args);
        return { ...r, node: cl };
      }
    }
    if (n.isOperatorNode || n.isFunctionNode) {
      const vs = n.args.map(valOf);
      if (vs.every(Boolean)) {
        // reiner Bruch (ganze Zahl / ganze Zahl) gilt schon als Wert, außer er lässt sich kürzen
        const res = applyOp(n, vs);
        if (res) return { node: mkVal(res.v), label: res.label, detail: res.detail };
      }
    }
  }
  return null;
}
K.arithSteps = function (sM) {
  let node = math.parse(sM);
  const steps = [];
  let prev = texM(node);
  for (let i = 0; i < 80; i++) {
    const r = reduceOnce(node);
    if (!r) break;
    node = r.node;
    if (r.silent) continue;
    const t = texM(node);
    if (t !== prev) {
      steps.push(step(r.label, '=' + t, r.detail));
      prev = t;
    }
  }
  if (steps.length > 40) { const n = steps.length; steps.splice(20, n - 30, step('…', '')); }
  return steps;
};

/* =========================================================
   2) Ableitungen mit Regel-Erklärung
   ========================================================= */
const hasVar = (node, v) => node.filter(n => n.isSymbolNode && n.name === v).length > 0;
const DTAB = {
  sin: u => `\\cos\\left(${u}\\right)`, cos: u => `-\\sin\\left(${u}\\right)`, tan: u => `\\frac{1}{\\cos^2\\left(${u}\\right)}`,
  exp: u => `e^{${u}}`, log: u => `\\frac{1}{${u}}`, log10: u => `\\frac{1}{${u}\\cdot\\ln 10}`, sqrt: u => `\\frac{1}{2\\sqrt{${u}}}`,
  asin: u => `\\frac{1}{\\sqrt{1-\\left(${u}\\right)^2}}`, acos: u => `-\\frac{1}{\\sqrt{1-\\left(${u}\\right)^2}}`, atan: u => `\\frac{1}{1+\\left(${u}\\right)^2}`,
  sinh: u => `\\cosh\\left(${u}\\right)`, cosh: u => `\\sinh\\left(${u}\\right)`, tanh: u => `1-\\tanh^2\\left(${u}\\right)`,
  abs: u => `\\frac{${u}}{\\left|${u}\\right|}`, cot: u => `-\\frac{1}{\\sin^2\\left(${u}\\right)}`
};
function dSimp(node, v) {
  try { return math.simplify(math.derivative(node, v)); } catch (e) {
    const s = nerdamer(`diff(${toN(node.toString())},${v})`).toString();
    return math.parse(s);
  }
}
function strip(n) { while (n.isParenthesisNode) n = n.content; return n; }
const trivial = (n, v) => { n = strip(n); return !hasVar(n, v) || n.isSymbolNode || (n.isOperatorNode && n.fn === 'pow' && strip(n.args[0]).isSymbolNode && !hasVar(n.args[1], v)); };
function diffExplain(node, v, steps, depth = 0) {
  node = strip(node);
  if (steps.length > 14 || depth > 4) return;
  const t = texM(node), d = texM(dSimp(node, v)), pre = `\\left(${t}\\right)'`;
  const push = (key, mid, vars) => steps.push(step(T(key, vars), pre + (mid ? '=' + mid : '') + '=' + d));
  if (!hasVar(node, v)) { if (depth === 0) push('r_const'); return; }
  if (node.isSymbolNode) { if (depth === 0) push('r_power', '1'); return; }
  if (node.isOperatorNode) {
    const [a, b] = node.args;
    switch (node.fn) {
      case 'add': case 'subtract':
        push('r_sum', node.args.map(x => `\\left(${texM(x)}\\right)'`).join(node.fn === 'add' ? '+' : '-'));
        node.args.forEach(x => { if (!trivial(x, v)) diffExplain(x, v, steps, depth + 1); });
        return;
      case 'unaryMinus':
        push('r_factor', `-\\left(${texM(a)}\\right)'`); if (!trivial(a, v)) diffExplain(a, v, steps, depth + 1); return;
      case 'multiply': {
        if (!hasVar(a, v) || !hasVar(b, v)) {
          const c = hasVar(a, v) ? b : a, u = hasVar(a, v) ? a : b;
          push('r_factor', `${texM(c)}\\cdot\\left(${texM(u)}\\right)'`);
          if (!trivial(u, v)) diffExplain(u, v, steps, depth + 1);
          return;
        }
        steps.push(step(T('r_product'), `u=${texM(a)},\\quad v=${texM(b)}\\\\ (u\\cdot v)'=u'\\cdot v+u\\cdot v'=\\left(${texM(dSimp(a, v))}\\right)\\cdot ${texM(b)}+${texM(a)}\\cdot\\left(${texM(dSimp(b, v))}\\right)=${d}`));
        [a, b].forEach(x => { if (!trivial(x, v)) diffExplain(x, v, steps, depth + 1); });
        return;
      }
      case 'divide': {
        if (!hasVar(b, v)) { push('r_factor', `\\frac{1}{${texM(b)}}\\cdot\\left(${texM(a)}\\right)'`); if (!trivial(a, v)) diffExplain(a, v, steps, depth + 1); return; }
        steps.push(step(T('r_quot'), `u=${texM(a)},\\quad v=${texM(b)}\\\\ \\left(\\frac{u}{v}\\right)'=\\frac{u'v-uv'}{v^2}=\\frac{\\left(${texM(dSimp(a, v))}\\right)\\cdot ${texM(b)}-${texM(a)}\\cdot\\left(${texM(dSimp(b, v))}\\right)}{\\left(${texM(b)}\\right)^2}=${d}`));
        [a, b].forEach(x => { if (!trivial(x, v)) diffExplain(x, v, steps, depth + 1); });
        return;
      }
      case 'pow': {
        const base = strip(a);
        if (!hasVar(b, v)) {
          const n = texM(b);
          if (base.isSymbolNode) { push('r_power', `${n}\\cdot ${v}^{${n}-1}`); return; }
          steps.push(step(T('r_chain'), `\\text{${T('outer')}: } u^{${n}}\\;\\Rightarrow\\; ${n}\\,u^{${n}-1},\\quad \\text{${T('inner')}: } u=${texM(base)}\\\\ ${pre}=${n}\\left(${texM(base)}\\right)^{${n}-1}\\cdot\\left(${texM(dSimp(base, v))}\\right)=${d}`));
          if (!trivial(base, v)) diffExplain(base, v, steps, depth + 1);
          return;
        }
        if (!hasVar(a, v)) {
          const isE = base.isSymbolNode && base.name === 'e';
          push('r_exp', isE ? `e^{${texM(b)}}\\cdot\\left(${texM(b)}\\right)'` : `${texM(a)}^{${texM(b)}}\\cdot\\ln\\left(${texM(a)}\\right)\\cdot\\left(${texM(b)}\\right)'`);
          if (!trivial(b, v)) diffExplain(b, v, steps, depth + 1);
          return;
        }
        push('r_genpow', `\\left(e^{${texM(b)}\\cdot\\ln\\left(${texM(a)}\\right)}\\right)'`);
        return;
      }
    }
  }
  if (node.isFunctionNode && node.args.length === 1 && DTAB[node.fn.name]) {
    const u = strip(node.args[0]), f = node.fn.name;
    if (u.isSymbolNode && u.name === v) { push('r_table', DTAB[f](v)); return; }
    steps.push(step(T('r_chain'), `\\text{${T('outer')}: } ${texM(new math.FunctionNode(f, [new math.SymbolNode('u')]))}\\;\\Rightarrow\\;${DTAB[f]('u')},\\quad\\text{${T('inner')}: } u=${texM(u)}\\\\ ${pre}=${DTAB[f](texM(u))}\\cdot\\left(${texM(dSimp(u, v))}\\right)=${d}`));
    if (!trivial(u, v)) diffExplain(u, v, steps, depth + 1);
    return;
  }
  push('r_cas');
}

/* =========================================================
   3) Polynome & Gleichungen
   ========================================================= */
function polyCoeffs(sM, v) {
  try {
    const r = math.rationalize(sM, {}, true);
    if (r.variables.length !== 1 || r.variables[0] !== v || !r.coefficients || r.denominator) return null;
    const c = r.coefficients.map(x => toNum(x));
    if (c.some(x => !isFinite(x))) return null;
    while (c.length > 1 && c[c.length - 1] === 0) c.pop();
    return c; // aufsteigend
  } catch (e) { return null; }
}
const fr = x => { try { return math.fraction(x); } catch (e) { return null; } };
const ftex = x => { const f = fr(x); return (f && f.d < 1e6 && Math.abs(f.valueOf() - x) < 1e-12) ? fracTex(f) : fmtReal(x); };
function polyTex(c, v) {
  let s = '';
  for (let k = c.length - 1; k >= 0; k--) {
    const a = c[k]; if (a === 0) continue;
    const abs = Math.abs(a), sign = a < 0 ? '-' : (s ? '+' : '');
    const coef = (abs === 1 && k > 0) ? '' : ftex(abs);
    s += sign + coef + (k > 0 ? v + (k > 1 ? '^{' + k + '}' : '') : '');
  }
  return s || '0';
}
function solveExactN(exprN, v) {
  try {
    const r = nerdamer.solve(exprN, v).toString();
    const inner = r.replace(/^\[|\]$/g, '');
    if (!inner.trim()) return [];
    return splitTop(inner);
  } catch (e) { return null; }
}
function niceExact(s) { return s.length < 70 && !/\d{7,}/.test(s) && !/\d\.\d{6,}/.test(s); }
/* ---------- Polynom-Nullstellen (exakt + numerisch) ---------- */
function polyEval(c, x) { return c.reduceRight((acc, k) => acc * x + k, 0); }
function durandKerner(cAsc) {
  const n = cAsc.length - 1, an = cAsc[n];
  const a = cAsc.map(x => x / an);
  const R = 1 + Math.max(...a.slice(0, n).map(Math.abs));
  let z = Array.from({ length: n }, (_, k) => math.complex({ r: R * 0.9, phi: 2 * Math.PI * k / n + 0.4 }));
  const p = x => { let r = math.complex(1, 0); for (let i = n - 1; i >= 0; i--) r = math.add(math.multiply(r, x), a[i]); return r; };
  for (let it = 0; it < 800; it++) {
    let delta = 0;
    z = z.map((zi, i) => {
      let den = math.complex(1, 0);
      z.forEach((zj, j) => { if (j !== i) den = math.multiply(den, math.subtract(zi, zj)); });
      const step = math.divide(p(zi), den);
      delta = Math.max(delta, math.abs(step));
      return math.subtract(zi, step);
    });
    if (delta < 1e-15) break;
  }
  return z;
}
function sqrtTex(D) { // exakte Darstellung von sqrt(D) über nerdamer
  try { return nerdamer(`sqrt(${math.fraction(D).toFraction()})`).toString(); } catch (e) { return `sqrt(${D})`; }
}
function polyRoots(c, v = 'x') {
  c = c.slice(); while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-300) c.pop();
  const real = [], complex = [];
  const addR = (val, tex, exact = true) => { if (!real.some(r => Math.abs(r.val - val) < 1e-7 * (1 + Math.abs(val)))) real.push({ val, tex, exact }); };
  let cur = c.slice();
  while (cur.length > 1 && cur[0] === 0) { addR(0, '0'); cur = cur.slice(1); }
  // rationale Nullstellen abspalten
  if (cur.every(Number.isInteger)) {
    const divs = n => { n = Math.abs(n); const d = []; for (let i = 1; i <= Math.min(n, 20000); i++) if (n % i === 0) d.push(i); return d; };
    let guard = 0;
    while (cur.length > 3 && guard++ < 10) {
      const cands = [];
      for (const pp of divs(cur[0])) for (const q of divs(cur[cur.length - 1])) cands.push(pp / q, -pp / q);
      const r = cands.find(x => Math.abs(polyEval(cur, x)) < 1e-9);
      if (r === undefined) break;
      addR(r, ftex(r));
      const desc = cur.slice().reverse(), q = [desc[0]];
      for (let i = 1; i < desc.length - 1; i++) q.push(desc[i] + q[i - 1] * r);
      cur = q.reverse().map(x => Math.round(x * 1e9) / 1e9);
      if (!cur.every(Number.isInteger)) break;
    }
  }
  if (cur.length === 2) addR(-cur[0] / cur[1], ftex(-cur[0] / cur[1]));
  else if (cur.length === 3) {
    const [cc, b, a] = cur, D = b * b - 4 * a * cc;
    const fr2 = x => math.fraction(x).toFraction();
    if (Math.abs(D) < 1e-14) addR(-b / (2 * a), ftex(-b / (2 * a)));
    else if (D > 0) {
      const sq = Math.sqrt(D), rational = Number.isInteger(Math.round(sq * 1e9) / 1e9) && Math.abs(sq - Math.round(sq)) < 1e-9;
      for (const sg of [-1, 1]) {
        const val = (-b + sg * sq) / (2 * a);
        let tex = ftex(val);
        if (!rational) { try { const e = nerdamer(`(${fr2(-b)}${sg < 0 ? '-' : '+'}${sqrtTex(D)})/(${fr2(2 * a)})`).expand().toString(); if (niceExact(e)) tex = texN(e); } catch (er) { } }
        addR(val, tex, true);
      }
    } else {
      const re = -b / (2 * a), im = Math.sqrt(-D) / Math.abs(2 * a);
      let imT; try { const e = nerdamer(`${sqrtTex(-D)}/(${fr2(Math.abs(2 * a))})`).toString(); imT = niceExact(e) ? texN(e) : fmtReal(im); } catch (er) { imT = fmtReal(im); }
      const one = imT === '1';
      for (const sg of ['+', '-']) complex.push({ re, im: sg === '+' ? im : -im, tex: (Math.abs(re) > 1e-15 ? ftex(re) : (sg === '-' ? '' : '')) + (Math.abs(re) > 1e-15 || sg === '-' ? sg : '') + (one ? '' : imT + '\\,') + 'i' });
    }
  } else if (cur.length > 3) {
    const z = durandKerner(cur);
    for (const r of z) {
      if (Math.abs(r.im) < 1e-7 * (1 + Math.abs(r.re))) {
        let x = r.re; // Newton-Politur
        const d = cur.map((k, i) => k * i).slice(1);
        for (let i = 0; i < 30; i++) { const fd = polyEval(d, x); if (!fd) break; x -= polyEval(cur, x) / fd; }
        addR(x, fmtReal(x), false);
      } else complex.push({ re: r.re, im: r.im, tex: fmtVal(math.complex(Number(r.re.toPrecision(10)), Number(r.im.toPrecision(10)))) });
    }
  }
  real.sort((a, b) => a.val - b.val);
  return { real, complex };
}
function solTexes(exprN, sM, v, steps) {
  const c = polyCoeffs(sM, v);
  if (c && c.length >= 2 && c.length <= 16) return polyRoots(c, v);
  const f = compileFn(sM, v);
  const real = [];
  const P = S.angle === 'deg' ? 360 : 2 * Math.PI;
  const periodic = /sin|cos|tan/.test(sM) && [0.3, 1.1, 2.5, 4.2].every(x => { const a = f(x), b = f(x + P); return isFinite(a) && Math.abs(a - b) < 1e-9 * (1 + Math.abs(a)); });
  const inRange = x => !periodic || (x > -1e-9 && x < P - 1e-9);
  const exact = solveExactN(exprN, v) || [];
  for (const s of exact) {
    if (!niceExact(s)) continue;
    let val;
    try { val = math.complex(math.evaluate(fromN(s), {})); } catch (e) { continue; }
    if (Math.abs(val.im) > 1e-9 * (1 + Math.abs(val.re))) continue;
    if (!(Math.abs(f(val.re)) < 1e-8 * (1 + Math.abs(val.re)))) continue; // Probe
    let x = val.re;
    if (periodic) x = ((x % P) + P) % P;
    if (!inRange(x)) continue;
    if (!real.some(r => Math.abs(r.val - x) < 1e-7 * (1 + Math.abs(x)))) real.push({ val: x, tex: x === val.re ? texN(s) : fmtReal(x), exact: x === val.re });
  }
  let num = periodic ? findRoots(f, -1e-9, P - 1e-9, 20000) : findRoots(f, -60, 60, 12000);
  if (!periodic && !num.length && !real.length) num = findRoots(f, -2000, 2000, 20000);
  for (const x of num) {
    if (!real.some(r => Math.abs(r.val - x) < 1e-6 * (1 + Math.abs(x)))) {
      const fr0 = fr(x); let tex = fmtReal(x), exact = false;
      if (fr0 && fr0.d <= 12 && Math.abs(fr0.valueOf() - x) < 1e-11) { tex = fracTex(fr0); exact = true; }
      else if (/exp|e\^|\be\b/.test(sM) && (() => { const q = fr(Math.exp(x)); return q && q.d <= 12 && q.n < 1e6 && Math.abs(q.valueOf() - Math.exp(x)) < 1e-9 * Math.exp(x); })()) { const q = fr(Math.exp(x)); tex = '\\ln\\left(' + fracTex(q) + '\\right)'; exact = true; }
      else if (S.angle !== 'deg') { const q = fr(x / Math.PI); if (q && q.d <= 12 && Math.abs(q.valueOf() * Math.PI - x) < 1e-11) { tex = texN(`(${q.toFraction()})*pi`); exact = true; } }
      real.push({ val: x, tex, exact, numeric: !exact });
    }
  }
  real.sort((a, b) => a.val - b.val);
  return { real, complex: [], periodic };
}

/* ---------- Äquivalenzumformungen ---------- */
// math.js-Knoten → Nutzer-Syntax (log = ln) → nerdamer
const mjToN = r => toN(rewriteCalls(rewriteCalls(r.toString(), 'log', a => a.length > 1 ? `log(${a[0]},${a[1]})` : `ln(${a[0]})`), 'log10', a => `lg(${a[0]})`));
const AL = (L, R, op) => L + ' &= ' + R + (op ? ' &&\\mid\\; ' + op : '');
const chain = rows => '\\begin{aligned}' + rows.join('\\\\') + '\\end{aligned}';
const neg = t => t.startsWith('-') ? t.slice(1) : '-' + t;
const signed = (sign, t) => { // „-3“, „+3“, „-(…)“
  if (sign === '-') return t.startsWith('-') ? '+' + t.slice(1) : '-' + t;
  return t.startsWith('-') ? t : '+' + t;
};
const opMul = t => t.startsWith('-') ? '\\cdot\\left(' + t + '\\right)' : '\\cdot ' + t;
const opDiv = t => t.startsWith('-') || /\\frac/.test(t) ? ':\\left(' + t + '\\right)' : ':' + t;
function linCoeffs(sM, v) {
  const free = freeSyms(sM);
  if (!free.length) { const x = toNum(math.evaluate(sM)); return isFinite(x) ? [x] : null; }
  if (free.length !== 1 || free[0] !== v) return null;
  const c = polyCoeffs(sM, v);
  return c && c.length <= 2 ? c : null;
}
function linearSteps(lhs, rhs, v, steps) {
  const lM = toM(lhs, false), rM = toM(rhs, false);
  let cl = linCoeffs(lM, v), cr = linCoeffs(rM, v);
  if (!cl || !cr) return null;
  let [b1, a1 = 0] = cl, [b2, a2 = 0] = cr;
  if (a1 === 0 && a2 === 0) return null;
  const F = x => { const f = fr(x); return f && Math.abs(f.valueOf() - x) < 1e-12 ? f : null; };
  if ([a1, b1, a2, b2].some(x => !F(x))) return null;
  const side = (a, b) => polyTex(b !== undefined ? [b, a] : [0, a], v);
  const lin = (a, b) => polyTex([b, a], v);
  const st = [];
  const origL = K.texOf(lhs) || lin(a1, b1), origR = K.texOf(rhs) || lin(a2, b2);
  if (/\(/.test(lhs + rhs))
    st.push(step(T('eq_expand'), chain([AL(origL, origR), AL(lin(a1, b1), lin(a2, b2))])));
  // Brüche beseitigen
  const dens = [a1, b1, a2, b2].map(x => F(x).d);
  const Lc = dens.reduce((p, q) => math.lcm(p, q), 1);
  if (Lc > 1 && Lc <= 1000) {
    st.push(step(T('eq_mul', { n: Lc }), chain([AL(lin(a1, b1), lin(a2, b2), '\\cdot ' + Lc), AL(lin(a1 * Lc, b1 * Lc), lin(a2 * Lc, b2 * Lc))])));
    a1 *= Lc; b1 *= Lc; a2 *= Lc; b2 *= Lc;
    [a1, b1, a2, b2] = [a1, b1, a2, b2].map(x => Math.round(x * 1e9) / 1e9);
  }
  // Seiten tauschen, wenn x nur rechts steht oder rechts mehr x stehen
  if (a1 === 0 || (a2 !== 0 && a2 > a1 && a1 > 0)) {
    st.push(step(T('eq_swap'), chain([AL(lin(a2, b2), lin(a1, b1))])));
    [a1, b1, a2, b2] = [a2, b2, a1, b1];
  }
  // x-Terme nach links
  if (a2 !== 0) {
    const t = polyTex([0, Math.abs(a2)], v);
    st.push(step(T(a2 > 0 ? 'eq_sub' : 'eq_add', { n: t }), chain([AL(lin(a1, b1), lin(a2, b2), (a2 > 0 ? '-' : '+') + t), AL(lin(a1 - a2, b1), lin(0, b2))])));
    a1 -= a2; a2 = 0;
    if (a1 === 0) {
      const ok = Math.abs(b1 - b2) < 1e-12;
      st.push(step(T(ok ? 'eq_all' : 'eq_none'), chain([AL(ftex(b1), ftex(b2))])));
      steps.push(...st);
      return ok ? { real: [], complex: [], all: true } : { real: [], complex: [] };
    }
  }
  // Konstante nach rechts
  if (b1 !== 0) {
    const t = ftex(Math.abs(b1));
    st.push(step(T(b1 > 0 ? 'eq_sub' : 'eq_add', { n: t }), chain([AL(lin(a1, b1), ftex(b2), (b1 > 0 ? '-' : '+') + t), AL(lin(a1, 0), ftex(b2 - b1))])));
    b2 -= b1; b1 = 0;
  }
  // durch Koeffizienten teilen
  if (a1 !== 1) {
    const t = ftex(a1);
    if (a1 === -1) st.push(step(T('eq_mul', { n: '(−1)' }), chain([AL(lin(a1, 0), ftex(b2), '\\cdot(-1)'), AL(v, ftex(-b2))])));
    else st.push(step(T('eq_div', { n: t }), chain([AL(lin(a1, 0), ftex(b2), opDiv(t)), AL(v, ftex(b2 / a1))])));
  }
  steps.push(...st);
  const x = b2 / a1;
  return { real: [{ val: x, tex: ftex(x), exact: true }], complex: [] };
}
// Variable kommt genau einmal vor: Schicht für Schicht umkehren
function isolateSteps(lhs, rhs, v, steps) {
  let L = strip(math.parse(toM(lhs, false))), R = strip(math.parse(toM(rhs, false)));
  const cnt = n => n.filter(x => x.isSymbolNode && x.name === v).length;
  if (cnt(L) + cnt(R) !== 1) return null;
  const st = [];
  if (cnt(L) === 0) { [L, R] = [R, L]; st.push(step(T('eq_swap'), chain([AL(texM(L), texM(R))]))); }
  let Rs = [R];
  const C = x => new math.ConstantNode(x);
  const OP = (o, f, a, b) => new math.OperatorNode(o, f, [a, b]);
  const simp = n => n;
  const rT = r => { try { const e = nerdamer(mjToN(r)).toString(); if (niceExact(e)) return texN(e); } catch (er) { } try { return texM(math.simplify(r)); } catch (er) { return texM(r); } };
  const rTex = () => {
    if (Rs.length !== 2) return rT(Rs[0]);
    let a, b; try { a = toNum(Rs[0].evaluate()); b = toNum(Rs[1].evaluate()); } catch (e) { }
    if (isFinite(a) && Math.abs(a + b) < 1e-12) return '\\pm ' + rT(Rs[1]);
    return rT(Rs[0]) + '\\;\\vee\\; ' + rT(Rs[1]);
  };
  const apply = (key, vars, op, newL, fn) => {
    const before = AL(texM(L), rTex(), op);
    Rs = Rs.flatMap(fn).map(simp);
    L = strip(newL);
    st.push(step(T(key, vars), chain([before, AL(texM(L), rTex())])));
  };
  for (let guard = 0; guard < 12; guard++) {
    if (L.isSymbolNode && L.name === v) break;
    if (L.isOperatorNode && L.args.length === 2) {
      const [a, b] = L.args, inA = cnt(a) > 0, u = inA ? a : b, c = inA ? b : a, ct = texM(c);
      switch (L.fn) {
        case 'add': apply('eq_sub', { n: ct }, signed('-', ct), u, r => [OP('-', 'subtract', r, c)]); continue;
        case 'subtract':
          if (inA) { apply('eq_add', { n: ct }, signed('+', ct), u, r => [OP('+', 'add', r, c)]); continue; }
          apply('eq_sub', { n: ct }, signed('-', ct), new math.OperatorNode('-', 'unaryMinus', [u]), r => [OP('-', 'subtract', r, c)]); continue;
        case 'multiply': apply('eq_div', { n: ct }, opDiv(ct), u, r => [OP('/', 'divide', r, c)]); continue;
        case 'divide':
          if (inA) { apply('eq_mul', { n: ct }, opMul(ct), u, r => [OP('*', 'multiply', r, c)]); continue; }
          apply('eq_recip', null, '(\\;)^{-1}', OP('/', 'divide', u, c), r => [OP('/', 'divide', C(1), r)]); continue;
        case 'pow': {
          if (inA) {
            let n; try { n = toNum(c.evaluate()); } catch (e) { return null; }
            if (!isFinite(n) || n === 0) return null;
            if (Number.isInteger(n) && n % 2 === 0) {
              const vals = Rs.map(r => toNum(r.evaluate()));
              if (vals.some(x => x < 0)) return null; // keine reelle Lösung → allgemeiner Weg
              const rt = r => n === 2 ? new math.FunctionNode('sqrt', [r]) : OP('^', 'pow', r, OP('/', 'divide', C(1), C(n)));
              apply(n === 2 ? 'eq_sqrt' : 'eq_nroot', { n }, n === 2 ? '\\sqrt{\\;}' : '\\sqrt[' + n + ']{\\;}', u, r => {
                const p = simp(rt(r)); return toNum(p.evaluate()) === 0 ? [p] : [new math.OperatorNode('-', 'unaryMinus', [p]), p];
              });
              continue;
            }
            if (Number.isInteger(n)) { apply('eq_nroot', { n }, '\\sqrt[' + n + ']{\\;}', u, r => [new math.FunctionNode('nthRoot', [r, C(n)])]); continue; }
            const inv = OP('/', 'divide', C(1), c);
            apply('eq_pow', { n: '\\frac{1}{' + ct + '}' }, '(\\;)^{' + texM(simp(inv)) + '}', u, r => [OP('^', 'pow', r, inv)]); continue;
          }
          const isE = c.isSymbolNode && c.name === 'e';
          if (Rs.some(r => !(toNum(r.evaluate()) > 0))) return null;
          apply(isE ? 'eq_ln' : 'eq_log', { n: ct }, isE ? '\\ln' : '\\log_{' + ct + '}', u, r => [isE ? new math.FunctionNode('log', [r]) : new math.FunctionNode('log', [r, c])]); continue;
        }
      }
      return null;
    }
    if (L.isOperatorNode && L.fn === 'unaryMinus') { apply('eq_mul', { n: '(−1)' }, '\\cdot(-1)', L.args[0], r => [new math.OperatorNode('-', 'unaryMinus', [r])]); continue; }
    if (L.isFunctionNode && L.args.length === 1) {
      const u = L.args[0], f = L.fn.name;
      if (f === 'sqrt') { if (Rs.some(r => toNum(r.evaluate()) < 0)) return null; apply('eq_square', null, '(\\;)^2', u, r => [OP('^', 'pow', r, C(2))]); continue; }
      if (f === 'exp') { if (Rs.some(r => !(toNum(r.evaluate()) > 0))) return null; apply('eq_ln', null, '\\ln', u, r => [new math.FunctionNode('log', [r])]); continue; }
      if (f === 'log') { apply('eq_exp', null, 'e^{(\\;)}', u, r => [OP('^', 'pow', new math.SymbolNode('e'), r)]); continue; }
      if (f === 'log10') { apply('eq_exp10', null, '10^{(\\;)}', u, r => [OP('^', 'pow', C(10), r)]); continue; }
      if (f === 'abs') { if (Rs.some(r => toNum(r.evaluate()) < 0)) return null; apply('eq_abs', null, '\\pm', u, r => [new math.OperatorNode('-', 'unaryMinus', [r]), r]); continue; }
    }
    return null;
  }
  if (!(L.isSymbolNode && L.name === v)) return null;
  const real = [];
  const g = compileFn(`(${toM(lhs, true)})-(${toM(rhs, true)})`, v);
  for (const r of Rs) {
    let val; try { val = toNum(r.evaluate()); } catch (e) { return null; }
    if (!isFinite(val)) return null;
    if (!(Math.abs(g(val)) < 1e-8 * (1 + Math.abs(val)))) { st.push(step(T('eq_reject'), `${v}=${fmtReal(val)}`)); continue; }
    let tex = texM(r);
    try { const ex = nerdamer(mjToN(r)).toString(); if (niceExact(ex)) tex = texN(ex); } catch (e) { }
    if (!real.some(q => Math.abs(q.val - val) < 1e-12)) real.push({ val, tex, exact: true });
  }
  steps.push(...st);
  real.sort((a, b) => a.val - b.val);
  return { real, complex: [] };
}
function solveSingle(lhs, rhs, v, steps) {
  if (rhs !== '0' || true) {
    const lin = linearSteps(lhs, rhs, v, steps); if (lin) return lin;
    if (!(S.angle === 'deg' && /sin|cos|tan/.test(lhs + rhs))) { const iso = isolateSteps(lhs, rhs, v, steps); if (iso) return iso; }
  }
  const sM = rhs === '0' ? toM(lhs, false) : `(${toM(lhs, false)})-(${toM(rhs, false)})`;
  const sN = rhs === '0' ? toN(lhs) : `(${toN(lhs)})-(${toN(rhs)})`;
  if (rhs !== '0') { const rt = texM(math.parse(toM(rhs, false))); steps.push(step(T('s_move'), chain([AL(K.texOf(lhs) || texM(math.parse(toM(lhs, false))), rt, signed('-', /[+\-]/.test(rt.slice(1)) ? '\\left(' + rt + '\\right)' : rt)), AL(texM(math.simplify(math.parse(sM))), '0')]))); }
  let c = polyCoeffs(sM, v);
  // Bruchgleichung → Zähler
  if (!c) {
    try {
      const r = math.rationalize(sM, {}, true);
      if (r.denominator && r.variables.length === 1 && r.variables[0] === v) {
        steps.push(step(T('s_denominator'), decFix(r.numerator.toTex()) + '=0,\\quad ' + decFix(r.denominator.toTex()) + '\\neq 0'));
        const sols = solveSingle(r.numerator.toString(), '0', v, steps);
        const den = compileFn(r.denominator.toString(), v);
        sols.real = sols.real.filter(s => Math.abs(den(s.val)) > 1e-9);
        return sols;
      }
    } catch (e) { }
  }
  if (c && c.length === 2) {
    const [b, a] = c;
    steps.push(step(T('s_linear', { v }), `${polyTex(c, v)}=0\\;\\Rightarrow\\; ${v}=\\frac{${ftex(-b)}}{${ftex(a)}}=${ftex(-b / a)}`));
    return { real: [{ val: -b / a, tex: ftex(-b / a), exact: true }], complex: [] };
  }
  if (c && c.length === 3) return quadSteps(c, v, steps);
  if (c && c.length >= 4 && c.length <= 9) return polySteps(c, v, steps);
  if (S.angle === 'deg' && /sin|cos|tan/.test(sM)) { const r = solTexes(degWrap(sN), degWrap(toM(lhs, true) + '-(' + toM(rhs, true) + ')'), v, steps); steps.push(step(T('s_cas'), '')); return r; }
  steps.push(step(T('s_cas'), ''));
  return solTexes(sN, sM, v, steps);
}

/* ---------- Gauß / rref mit Brüchen ---------- */
function rrefSteps(A, steps, augCols = 0) {
  const M = A.map(r => r.map(x => math.fraction(x)));
  const rows = M.length, cols = M[0].length;
  const mt = () => '\\left(\\begin{array}{' + 'c'.repeat(cols - augCols) + (augCols ? '|' + 'c'.repeat(augCols) : '') + '}' + M.map(r => r.map(fracTex).join('&')).join('\\\\') + '\\end{array}\\right)';
  steps.push(step(T('m_start'), mt()));
  let lead = 0;
  for (let r = 0; r < rows && lead < cols - augCols; r++) {
    let i = r;
    while (i < rows && M[i][lead].n === 0) i++;
    if (i === rows) { lead++; r--; continue; }
    if (i !== r) { [M[i], M[r]] = [M[r], M[i]]; steps.push(step(T('m_rowop'), `\\text{Z}_{${r + 1}}\\leftrightarrow\\text{Z}_{${i + 1}}\\quad ` + mt())); }
    const p = M[r][lead];
    if (!(p.n === 1 && p.d === 1 && p.s === 1)) {
      M[r] = M[r].map(x => x.div(p));
      steps.push(step(T('m_rowop'), `\\text{Z}_{${r + 1}}\\cdot ${p.s < 0 || p.d !== 1 ? '\\left(' + fracTex(p.inverse()) + '\\right)' : fracTex(p.inverse())}\\quad ` + mt()));
    }
    const ops = [];
    for (let k = 0; k < rows; k++) {
      if (k === r || M[k][lead].n === 0) continue;
      const f = M[k][lead];
      M[k] = M[k].map((x, j) => x.sub(f.mul(M[r][j])));
      ops.push(`\\text{Z}_{${k + 1}}${f.s < 0 ? '+' : '-'}${f.abs().equals(1) ? '' : fracTex(f.abs()) + '\\cdot'}\\text{Z}_{${r + 1}}`);
    }
    if (ops.length) steps.push(step(T('m_rowop'), ops.join(',\\;') + '\\quad ' + mt()));
    lead++;
  }
  return M;
}
K.rrefSteps = rrefSteps;

/* =========================================================
   4) Kurvendiskussion
   ========================================================= */
const toX = (str, v) => v && v !== 'x' ? String(str).replace(new RegExp('\\b' + v + '\\b', 'g'), 'x') : String(str);
// math.js-Syntax → Nutzer-Syntax (log = ln, log10 = lg)
K.mjToUser = str => rewriteCalls(rewriteCalls(rewriteCalls(String(str), 'log', a => a.length > 1 ? `log(${a[0]},${a[1]})` : `ln(${a[0]})`), 'log10', a => `lg(${a[0]})`), 'nthRoot', a => `root(${a[0]},${a[1]})`);
// Seiten einer Gleichung/Ungleichung als Funktionen für die Kurvendiskussion
function sideFns(l, r) {
  let fl, fr;
  try { fl = freeSyms(toM(l, false)); fr = freeSyms(toM(r, false)); } catch (e) { return null; }
  const vars = [...new Set([...fl, ...fr])];
  if (vars.length !== 1) return null;
  const v = vars[0];
  if (fl.length && fr.length) return [toX(l, v), toX(r, v)];
  if (/^\s*0\s*$/.test(r)) return [toX(l, v)];
  try { return [toX(K.mjToUser(math.simplify(`(${toM(l, false)})-(${toM(r, false)})`).toString()), v)]; } catch (e) { return [toX(`(${l})-(${r})`, v)]; }
}
const FN_NAMES_ = ['f', 'g', 'h', 'k'];
const PT_LAB = { zero: 'N', y: 'S_y', max: 'H', min: 'T', saddle: 'S', inflect: 'W', ix: 'S' };
function ptTex(p) { return `${p.lab}\\left(${p.xt}\\,|\\,${p.yt}\\right)`; }
K.analyzeFn = function (fUser, v = 'x', name = 'f') {
  const fU = applyConsts(applyDefs(fUser));
  const fM = toM(fU, false), fN = toN(fU);
  const node = math.parse(fM);
  const f = compileFn(toM(fU, true), v);
  const d1 = dSimp(node, v), d2 = dSimp(d1, v), d3 = dSimp(d2, v);
  const f1 = compileFn(d1.toString(), v), f2 = compileFn(d2.toString(), v), f3 = compileFn(d3.toString(), v);
  const info = [], cats = { zero: [], y: [], max: [], min: [], saddle: [], inflect: [] };
  const add = (k, x, y, xt) => {
    const list = cats[k], n = list.length + 1;
    const lab = k === 'y' ? 'S_y' : PT_LAB[k] + '_{' + n + '}';
    const p = { k, x, y, xt: xt || ftex(x), yt: ftex(y), lab, fn: name };
    p.tex = ptTex(p); list.push(p); return p;
  };
  const fTex = `${name}(${v})=${texM(node)}`;
  info.push({ title: T('a_deriv1'), tex: `${name}'(${v})=${texM(d1)}` });
  info.push({ title: T('a_deriv2'), tex: `${name}''(${v})=${texM(d2)}` });
  try {
    const r = math.rationalize(fM, {}, true);
    if (r.denominator) { const g = findRoots(compileFn(r.denominator.toString(), v)); if (g.length) info.push({ title: T('a_gaps'), tex: `${v}\\neq ` + g.map(ftex).join(',\\;') }); }
  } catch (e) { }
  const xs = [0.37, 1.3, 2.71, 4.1, 0.9];
  const even = xs.every(x => Math.abs(f(x) - f(-x)) < 1e-9 * (1 + Math.abs(f(x))) && isFinite(f(x)));
  const odd = xs.every(x => Math.abs(f(x) + f(-x)) < 1e-9 * (1 + Math.abs(f(x))) && isFinite(f(x)));
  info.push({ title: T('a_sym'), text: even ? T('sym_even') : odd ? T('sym_odd') : T('sym_none') });
  const y0 = f(0);
  if (isFinite(y0)) add('y', 0, y0, '0');
  const z = solTexes(fN, fM, v, []);
  z.real.slice(0, 20).forEach(s => add('zero', s.val, 0, s.numeric ? fmtReal(s.val) : s.tex));
  const ext = solTexes(toN(d1.toString()), d1.toString(), v, []);
  for (const s of ext.real.slice(0, 20)) {
    const y = f(s.val), dd = f2(s.val);
    if (!isFinite(y)) continue;
    let kind = dd < -1e-9 ? 'max' : dd > 1e-9 ? 'min' : null;
    if (!kind) { const h = 1e-4 * (1 + Math.abs(s.val)), l = f1(s.val - h), r = f1(s.val + h); kind = l > 0 && r < 0 ? 'max' : l < 0 && r > 0 ? 'min' : 'saddle'; }
    add(kind, s.val, y, s.numeric ? fmtReal(s.val) : s.tex);
  }
  const wp = solTexes(toN(d2.toString()), d2.toString(), v, []);
  for (const s of wp.real.slice(0, 20)) {
    const y = f(s.val); if (!isFinite(y)) continue;
    const h = 1e-4 * (1 + Math.abs(s.val));
    if (Math.sign(f2(s.val - h)) === Math.sign(f2(s.val + h)) && Math.abs(f3(s.val)) < 1e-9) continue;
    if (cats.saddle.some(q => Math.abs(q.x - s.val) < 1e-9)) continue; // Sattelpunkt ist auch Wendepunkt, aber schon gelistet
    add('inflect', s.val, y, s.numeric ? fmtReal(s.val) : s.tex);
  }
  const lim = a => {
    try {
      const r = nerdamer(`limit(${fN},${v},${a})`).toString();
      if (/^\[/.test(r) && !/Infinity/.test(r)) return '\\text{' + T('l_osc') + '}';
      if (!/limit|NaN|undefined|\[/.test(r) && r.length < 60) return texN(r);
    } catch (e) { }
    const big = a === 'Infinity' ? 1e8 : -1e8, val = f(big);
    if (!isFinite(val) || Math.abs(val) > 1e7) return val > 0 ? '\\infty' : val < 0 ? '-\\infty' : '\\text{?}';
    return '\\approx ' + fmtReal(val);
  };
  info.push({ title: T('a_limits'), tex: `\\lim_{${v}\\to\\infty} ${name}(${v})=${lim('Infinity')},\\qquad \\lim_{${v}\\to-\\infty} ${name}(${v})=${lim('-Infinity')}`.replace(/=\\approx/g, '\\approx') });
  const points = [].concat(cats.zero, cats.y, cats.max, cats.min, cats.saddle, cats.inflect);
  // alte Form (Blöcke) für Kompatibilität
  const blocks = [{ title: T('a_fn'), tex: fTex }, ...info];
  return { name, fTex, info, cats, points, blocks, d1: d1.toString(), d2: d2.toString(), fM: toM(fU, true) };
};
// Schnittpunkte zweier Funktionen
K.intersect = function (fU, gU, v = 'x', steps = null) {
  const F = applyConsts(applyDefs(fU)), Gx = applyConsts(applyDefs(gU));
  const res = steps ? solveSingle(F, Gx, v, steps) : solTexes(toN(`(${F})-(${Gx})`), `(${toM(F, false)})-(${toM(Gx, false)})`, v, []);
  const f = compileFn(toM(F, true), v);
  const out = [];
  (res.real || []).slice(0, 20).forEach((s, i) => {
    const y = f(s.val); if (!isFinite(y)) return;
    const p = { k: 'ix', x: s.val, y, xt: s.numeric ? fmtReal(s.val) : s.tex, yt: ftex(y), lab: 'S_{' + (out.length + 1) + '}' };
    p.tex = ptTex(p); out.push(p);
  });
  return out;
};
function multiFns(parts) {
  const names = FN_NAMES_.slice(0, parts.length);
  const inTex = parts.map((p, i) => `${names[i]}(x)=${K.texOf(p)}`).join(',\\quad ');
  const steps = [];
  let all = [];
  if (parts.length === 2) {
    steps.push(step(T('ix_equate'), `${K.texOf(parts[0])}=${K.texOf(parts[1])}`));
    all = K.intersect(prep(parts[0]), prep(parts[1]), 'x', steps);
    if (all.length) steps.push(step(T('ix_y'), all.map(p => `${names[0]}(${p.xt})=${p.yt}`).join(',\\;')));
  } else {
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const ps = K.intersect(prep(parts[i]), prep(parts[j]));
      ps.forEach(p => { p.lab = 'S_{' + names[i] + names[j] + '}'; p.tex = ptTex(p); });
      all = all.concat(ps);
    }
  }
  const outTex = all.length ? all.slice(0, 8).map(p => p.tex).join(',\\;') : '\\text{' + T('ix_none') + '}';
  return { kind: 'fns', inTex, outTex, steps, anFns: parts.map(p => prep(p)), ixPts: all, plot: { fns: parts.map(p => K._prepM(p)), v: 'x' } };
}

/* =========================================================
   5) Befehle
   ========================================================= */
const CMDS = {};
function guessVar(s, fallback = 'x') {
  try {
    const f = freeSyms(toM(s, false));
    if (f.includes(fallback)) return fallback;
    for (const c of ['x', 't', 'y', 'z', 'n', 'k', 'a']) if (f.includes(c)) return c;
    return f[0] || fallback;
  } catch (e) { return fallback; }
}
const prep = s => applyConsts(applyDefs(s));

CMDS.diff = (a) => {
  const f = prep(a[0]), v = a[1] || guessVar(f), n = a[2] ? parseInt(a[2]) : 1;
  const steps = [];
  let node = math.parse(toM(f, false));
  steps.push(step(T('st_start'), `f(${v})=${texM(node)}`));
  for (let k = 1; k <= n; k++) {
    if (n > 1) steps.push(step(T('d_order', { k }), ''));
    diffExplain(node, v, steps);
    node = dSimp(node, v);
  }
  // hübscher mit nerdamer?
  let out = texM(node);
  try {
    const nd = nerdamer(`diff(${toN(f)},${v},${n})`);
    const alt = nerdamer(`simplify(${nd.toString()})`);
    const t2 = texN(alt.toString());
    if (t2.length < out.length * 0.9) out = t2;
  } catch (e) { }
  return { inTex: `\\frac{d${n > 1 ? '^{' + n + '}' : ''}}{d${v}${n > 1 ? '^{' + n + '}' : ''}}\\left(${K.texOf(a[0])}\\right)`, outTex: out, steps, plot: { fns: [toM(f, true), node.toString()], v }, fnFor: null };
};

function integrandRule(term, v) {
  let n = strip(term);
  let c = null;
  if (n.isOperatorNode && n.fn === 'multiply') {
    const [a, b] = n.args;
    if (!hasVar(a, v)) { c = a; n = strip(b); } else if (!hasVar(b, v)) { c = b; n = strip(a); }
  }
  if (n.isOperatorNode && n.fn === 'divide' && !hasVar(n.args[1], v) && !c) { c = n.args[1]; n = strip(n.args[0]); }
  const isLin = u => { const cs = polyCoeffs(u.toString(), v); return cs && cs.length <= 2; };
  if (!hasVar(n, v)) return 'i_const';
  if (n.isSymbolNode) return 'i_power';
  if (n.isOperatorNode && n.fn === 'pow' && strip(n.args[0]).isSymbolNode && !hasVar(n.args[1], v)) {
    try { if (math.evaluate(n.args[1].toString()) === -1) return 'i_ln'; } catch (e) { }
    return 'i_power';
  }
  if (n.isOperatorNode && n.fn === 'divide' && !hasVar(n.args[0], v) && strip(n.args[1]).isSymbolNode) return 'i_ln';
  if (n.isOperatorNode && n.fn === 'pow' && !hasVar(n.args[0], v)) return isLin(n.args[1]) ? (strip(n.args[1]).isSymbolNode ? 'i_table' : 'i_linsub') : 'i_cas';
  if (n.isFunctionNode && ['sin', 'cos', 'exp', 'sinh', 'cosh'].includes(n.fn.name)) return strip(n.args[0]).isSymbolNode ? 'i_table' : (isLin(n.args[0]) ? 'i_linsub' : 'i_cas');
  if (n.isOperatorNode && n.fn === 'multiply') {
    const kinds = n.args.map(x => { x = strip(x); return polyCoeffs(x.toString(), v) ? 'poly' : (x.isFunctionNode || (x.isOperatorNode && x.fn === 'pow')) ? 'fn' : 'o'; });
    if (kinds.includes('poly') && kinds.includes('fn')) return 'i_parts';
  }
  return 'i_cas';
}
/* ---------- Integraltabelle: Standardintegrale (rationale/wurzelförmige Quadrate, logarithmische Integration) ---------- */
function ratStr(x) {
  if (Math.abs(x) < 1e-13) return '0';
  try { const f = math.fraction(x); if (f.d <= 2000 && Math.abs(f.valueOf() - x) < 1e-10 * (1 + Math.abs(x))) return f.toFraction(); } catch (e) { }
  return String(Number(x.toPrecision(12)));
}
function fitQuad(pts) { // [[x,h]] → [γ, β, α] oder null
  const [[x1, y1], [x2, y2], [x3, y3]] = pts;
  const d = (x1 - x2) * (x1 - x3) * (x2 - x3); if (Math.abs(d) < 1e-12) return null;
  const A = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / d;
  const B = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / d;
  const Cc = (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 * (x1 - x2) * y3) / d;
  const c = [Cc, B, A].map(z => { const r = Number(ratStr(z).includes('/') ? math.fraction(ratStr(z)).valueOf() : ratStr(z)); return Math.abs(r - z) < 1e-7 * (1 + Math.abs(z)) ? r : z; });
  if (!pts.every(([x, y]) => Math.abs(c[0] + c[1] * x + c[2] * x * x - y) < 1e-7 * (1 + Math.abs(y)))) return null;
  return c;
}
function tableIntegral(f, v, fx) {
  if (freeSyms(toM(f, false)).some(s => s !== v)) return null;
  const vx = s => s.replace(/\bx\b/g, v);
  const cand = [0.37, 0.81, 1.23, 1.71, 2.29, 2.93, -0.53, -1.17, -2.41, 3.7, 4.3, 5.1, 0.11, -0.21];
  const X = cand.filter(x => { const y = fx(x); return isFinite(y) && Math.abs(y) > 1e-12; });
  if (X.length < 5) return null;
  // 1) logarithmische Integration  ∫ g'/g = ln|g|
  try {
    const node = strip(math.parse(toM(f, false)));
    if (node.isOperatorNode && node.fn === 'divide' && hasVar(node.args[1], v)) {
      const D = node.args[1], dD = math.derivative(D, v), N = compileFn(node.args[0].toString(), v), dDf = compileFn(dD.toString(), v);
      const r = X.map(x => N(x) / dDf(x)).filter(isFinite);
      if (r.length >= 4 && r.every(c => Math.abs(c - r[0]) < 1e-9 * (1 + Math.abs(r[0]))) && Math.abs(r[0]) > 1e-12) {
        const c = ratStr(r[0]), Dn = mjToN(D);
        return { F: `${c === '1' ? '' : '(' + c + ')*'}log(abs(${Dn}))`, rule: 'i_logder', formula: `\\int\\frac{g'(${v})}{g(${v})}\\,d${v}=\\ln\\left|g(${v})\\right|+C\\qquad g(${v})=${texM(D)}` };
      }
    }
  } catch (e) { }
  // 2) k·Q(x)^e mit quadratischem Q,  e ∈ {−1, −½, ½}
  for (const e of [-1, -0.5, 0.5]) {
    let s = 1;
    if (e !== -1) { s = Math.sign(fx(X[0])); if (!X.every(x => Math.sign(fx(x)) === s)) continue; }
    const pts = X.map(x => { const y = fx(x); return [x, e === -1 ? 1 / y : e === -0.5 ? 1 / (y * y) : y * y]; });
    const c = fitQuad(pts.slice(0, 3)); if (!c) continue;
    if (!pts.every(([x, h]) => Math.abs(c[0] + c[1] * x + c[2] * x * x - h) < 1e-6 * (1 + Math.abs(h)))) continue;
    const [g, b, al] = c;
    if (Math.abs(al) < 1e-12) continue; // linear → normale Regeln
    const sh = b / (2 * al), m = g / al - sh * sh;
    const u = Math.abs(sh) < 1e-13 ? 'x' : `(x${sh > 0 ? '+' : '-'}${ratStr(Math.abs(sh))})`;
    const A = ratStr(al), Mabs = ratStr(Math.abs(m)), sS = s < 0 ? '-' : '';
    const uT = Math.abs(sh) < 1e-13 ? v : `${v}${sh > 0 ? '+' : '-'}${ftex(Math.abs(sh))}`;
    const sub = Math.abs(sh) < 1e-13 ? '' : `\\qquad u=${uT}`;
    let F = null, formula = '';
    if (e === -1) {
      if (m > 1e-13) { F = `1/((${A})*sqrt(${Mabs}))*atan(${u}/sqrt(${Mabs}))`; formula = `\\int\\frac{du}{u^{2}+a^{2}}=\\frac{1}{a}\\arctan\\frac{u}{a}+C`; }
      else if (m < -1e-13) { F = `1/(2*(${A})*sqrt(${Mabs}))*log(abs((${u}-sqrt(${Mabs}))/(${u}+sqrt(${Mabs}))))`; formula = `\\int\\frac{du}{u^{2}-a^{2}}=\\frac{1}{2a}\\ln\\left|\\frac{u-a}{u+a}\\right|+C`; }
      else { F = `-1/((${A})*${u})`; formula = `\\int\\frac{du}{u^{2}}=-\\frac{1}{u}+C`; }
    } else if (e === -0.5) {
      if (al > 0) { F = `${sS}1/sqrt(${A})*log(abs(${u}+sqrt(${u}^2${m < 0 ? '-' : '+'}${Mabs})))`; formula = `\\int\\frac{du}{\\sqrt{u^{2}\\pm a^{2}}}=\\ln\\left|u+\\sqrt{u^{2}\\pm a^{2}}\\right|+C`; }
      else if (m < 0) { F = `${sS}1/sqrt(${ratStr(-al)})*asin(${u}/sqrt(${Mabs}))`; formula = `\\int\\frac{du}{\\sqrt{a^{2}-u^{2}}}=\\arcsin\\frac{u}{a}+C`; }
    } else {
      if (al > 0) { const q2 = `sqrt(${u}^2${m < 0 ? '-' : '+'}${Mabs})`; F = `${sS}sqrt(${A})/2*(${u}*${q2}${m < 0 ? '-' : '+'}${Mabs}*log(abs(${u}+${q2})))`; formula = `\\int\\sqrt{u^{2}\\pm a^{2}}\\,du=\\tfrac{1}{2}\\left(u\\sqrt{u^{2}\\pm a^{2}}\\pm a^{2}\\ln\\left|u+\\sqrt{u^{2}\\pm a^{2}}\\right|\\right)+C`; }
      else if (m < 0) { F = `${sS}sqrt(${ratStr(-al)})/2*(${u}*sqrt(${Mabs}-${u}^2)+${Mabs}*asin(${u}/sqrt(${Mabs})))`; formula = `\\int\\sqrt{a^{2}-u^{2}}\\,du=\\tfrac{1}{2}\\left(u\\sqrt{a^{2}-u^{2}}+a^{2}\\arcsin\\frac{u}{a}\\right)+C`; }
    }
    if (!F) continue;
    const quadT = polyTex([g, b, al], v);
    const cs = Math.abs(sh) < 1e-13 ? '' : `${quadT}=${A === '1' ? '' : (A === '-1' ? '-' : ftex(al))}\\left(\\left(${uT}\\right)^{2}${m < 0 ? '-' : '+'}${ftex(Math.abs(m))}\\right)`;
    return { F: vx(F), rule: 'i_stdtab', formula: formula + (cs ? '\\\\ ' + cs + sub : ''), note: Math.abs(m) > 1e-13 ? `a^{2}=${ftex(Math.abs(m))}` : null };
  }
  return null;
}
function integrateN(fN, v) {
  const r = nerdamer(`integrate(${fN},${v})`).toString();
  if (/integrate/.test(r)) throw new Error('noint');
  return r;
}
/* ---------- Polstellen im Integrationsintervall / uneigentliche Integrale ---------- */
function findPoles(fx, A, B) {
  const N = 4000, h = (B - A) / N, out = [];
  const add = p => { if (!out.some(q => Math.abs(q - p) < 1e-6 * (1 + Math.abs(p)))) out.push(p); };
  const ys = []; for (let i = 0; i <= N; i++) ys.push(fx(A + i * h));
  const ay = i => (i < 0 || i > N || !isFinite(ys[i])) ? Infinity : Math.abs(ys[i]);
  const isPole = p => { // wächst |f| zur Stelle hin unbeschränkt?
    const s = 1 + Math.abs(p), side = d => { const n = Math.abs(fx(p + d * 1e-9 * s)), f = Math.abs(fx(p + d * 1e-3 * s)); return !isFinite(n) && !isNaN(n) ? true : (isFinite(n) && isFinite(f) && n > 30 * f && n > 1); };
    return side(-1) || side(1);
  };
  const snap = p => Math.abs(p - Math.round(p)) < 1e-6 ? Math.round(p) : p;
  if (isPole(A) || (!isFinite(ys[0]) && !isNaN(ys[0]))) add(A);
  if (isPole(B) || (!isFinite(ys[N]) && !isNaN(ys[N]))) add(B);
  for (let i = 1; i < N; i++) {
    const x = A + i * h, y = ys[i];
    if (!isFinite(y)) { if (!isNaN(y) || isPole(x)) add(snap(x)); continue; }
    if (ay(i) >= ay(i - 1) && ay(i) >= ay(i + 1) && ay(i) > 2 * Math.min(ay(i - 2), ay(i + 2)) && ay(i) > 1e-9) {
      let lo = x - h, hi = x + h;
      for (let k = 0; k < 80; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (Math.abs(fx(m1)) < Math.abs(fx(m2))) lo = m1; else hi = m2; }
      const p = snap((lo + hi) / 2); if (isPole(p)) add(p);
    }
    if (isFinite(ys[i - 1]) && Math.sign(y) * Math.sign(ys[i - 1]) < 0 && ay(i) > 1.2 * ay(i + 1) && ay(i - 1) > 1.2 * ay(i - 2)) {
      let lo = x - h, hi = x; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (Math.sign(fx(m)) === Math.sign(fx(lo))) lo = m; else hi = m; }
      const p = snap((lo + hi) / 2); if (isPole(p)) add(p);
    }
  }
  return out.sort((a, b) => a - b);
}
function jumpSimpson(fx, A, B) { // Simpson mit Aufteilung an Sprungstellen
  const N = 4000, h = (B - A) / N, ys = []; for (let i = 0; i <= N; i++) ys.push(fx(A + i * h));
  const ds = []; for (let i = 1; i <= N; i++) if (isFinite(ys[i]) && isFinite(ys[i - 1])) ds.push(Math.abs(ys[i] - ys[i - 1]));
  const med = ds.slice().sort((a, b) => a - b)[Math.floor(ds.length / 2)] || 0;
  const cuts = [A];
  for (let i = 1; i <= N; i++) {
    const d = Math.abs(ys[i] - ys[i - 1]);
    if (isFinite(d) && d > 1e-6 && d > 50 * med + 1e-9) {
      let lo = A + (i - 1) * h, hi = A + i * h; const yl = ys[i - 1];
      for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (Math.abs(fx(m) - yl) < d / 2) lo = m; else hi = m; }
      cuts.push((lo + hi) / 2);
    }
  }
  cuts.push(B);
  let sum = 0; for (let i = 0; i < cuts.length - 1; i++) { const e = 1e-12 * (1 + Math.abs(cuts[i + 1] - cuts[i])); sum += simpson(fx, cuts[i] + (i ? e : 0), cuts[i + 1] - (i < cuts.length - 2 ? e : 0), 2000); }
  return sum;
}
function geomInt(fx, a, b, sa, sb, eps) { // ∫ über [a,b] ohne ε-Umgebung der singulären Ränder
  if (sa && sb) { const m = (a + b) / 2; return geomInt(fx, a, m, true, false, eps) + geomInt(fx, m, b, false, true, eps); }
  if (!sa && !sb) return simpson(fx, a, b, 400);
  // Substitution x = a + t² (bzw. b − t²) glättet Wurzel-Singularitäten
  const L = b - a, T1 = Math.sqrt(L), T0 = Math.sqrt(eps * L);
  const g = sa ? t => fx(a + t * t) * 2 * t : t => fx(b - t * t) * 2 * t;
  let sum = 0;
  let d = T1; while (d / 2 > T0) { sum += simpson(g, d / 2, d, 64); d /= 2; }
  sum += simpson(g, T0, d, 64);
  return sum;
}
function improper(fx, a, b, sa, sb) {
  const I = [1e-2, 1e-4, 1e-6, 1e-8].map(e => geomInt(fx, a, b, sa, sb, e));
  const d1 = Math.abs(I[2] - I[1]), d2 = Math.abs(I[3] - I[2]);
  if (I.every(isFinite) && d2 < 0.2 * d1 + 1e-9 * (1 + Math.abs(I[3]))) { const r = d1 > 0 ? d2 / d1 : 0; return { conv: true, val: I[3] + (r > 0 && r < 0.9 ? (I[3] - I[2]) * r / (1 - r) : 0) }; }
  return { conv: false, sign: Math.sign(I[3] - I[2]) };
}
CMDS.integrate = (a) => {
  const f = prep(a[0]), v = a[1] || guessVar(f);
  const fM = toM(f, false), fN = toN(f), node = math.parse(fM), steps = [];
  const definite = a.length >= 4;
  const lo = definite ? prep(a[2]) : null, hi = definite ? prep(a[3]) : null;
  steps.push(step(T('st_start'), `\\int ${texM(node)}\\,d${v}`));
  let impNum = null, endPoles = [];
  if (definite && !/Infinity/.test(lo + hi)) { // Polstellen im Intervall?
    const A = toNum(math.evaluate(toM(lo))), Bb = toNum(math.evaluate(toM(hi)));
    const fx0 = compileFn(toM(f, true), v), a0 = Math.min(A, Bb), b0 = Math.max(A, Bb), sgn = A <= Bb ? 1 : -1;
    const poles = isFinite(A) && isFinite(Bb) && A !== Bb ? findPoles(fx0, a0, b0) : [];
    const inner = poles.filter(p => p > a0 + 1e-9 && p < b0 - 1e-9);
    if (poles.length) {
      const cuts = [a0, ...inner, b0], parts = [];
      for (let i = 0; i < cuts.length - 1; i++) {
        const sa = poles.some(p => Math.abs(p - cuts[i]) < 1e-9), sb = poles.some(p => Math.abs(p - cuts[i + 1]) < 1e-9);
        parts.push(improper(fx0, cuts[i], cuts[i + 1], sa, sb));
      }
      const pT = poles.map(p => `${v}=${ftex(p)}`).join(',\\; ');
      const inTex = K.texOf('integrate(' + a.join(',') + ')'), plot = { fns: [toM(f, true)], v };
      if (parts.some(p => !p.conv)) {
        const sg = [...new Set(parts.filter(p => !p.conv).map(p => p.sign * sgn))];
        const outTex = sg.length === 1 && sg[0] ? (sg[0] > 0 ? '+' : '-') + '\\infty\\;(\\text{' + T('q_div') + '})' : '\\text{' + T('q_div') + '}';
        steps.push(step(T('i_pole'), `\\text{${T('i_pole_at')}}\\; ${pT}`));
        steps.push(step(T('i_improper'), `\\text{${T('i_improper_div')}}`));
        return { inTex, outTex, steps, plot, note: T('i_improper_div') };
      }
      if (inner.length) {
        const val = sgn * parts.reduce((t, p) => t + p.val, 0);
        steps.push(step(T('i_pole'), `\\text{${T('i_pole_at')}}\\; ${pT}`));
        steps.push(step(T('i_improper'), `\\text{${T('i_improper_conv')}}\\;\\approx ${fmtReal(val)}`));
        return { inTex, outTex: '\\approx ' + fmtReal(val), steps, plot };
      }
      steps.push(step(T('i_pole'), `\\text{${T('i_pole_at')}}\\; ${pT}\\;\\Rightarrow\\;\\text{${T('i_improper_conv')}}`));
      impNum = sgn * parts.reduce((t, p) => t + p.val, 0); endPoles = poles;
    }
  }
  let F = null;
  try { F = integrateN(fN, v); } catch (e) { F = null; }
  const fxC = compileFn(toM(f, true), v);
  const verify = Fs => { // numerische Probe: F' = f ?  (null = nicht prüfbar)
    let g; try { g = compileFn(fromN(Fs), v); } catch (e) { return null; }
    let n = 0;
    for (const x of [0.31, 0.77, 1.33, 1.9, 2.6, -0.45, 3.3]) {
      const y = fxC(x); if (!isFinite(y)) continue;
      const h = 1e-5 * (1 + Math.abs(x)), d = (g(x + h) - g(x - h)) / (2 * h);
      if (!isFinite(d)) continue; n++;
      if (Math.abs(d - y) > 1e-4 * (1 + Math.abs(y))) return false;
    }
    return n >= 2 ? true : null;
  };
  if (F && verify(F) === false) F = null;
  let tab = null; try { tab = tableIntegral(f, v, fxC); if (tab && verify(tab.F) !== true) tab = null; } catch (e) { tab = null; }
  const ugly = F && (/\bi\b/.test(F) || /(sin|cos|tan)\(a(sin|cos|tan)/.test(F) || (tab && F.length > tab.F.length * 1.5));
  let useTab = false;
  if (tab && (!F || ugly)) { F = tab.F; useTab = true; steps.push(step(T(tab.rule), tab.formula, tab.note)); }
  if (F) {
    // Gliedweise Erklärung
    let terms = [node], sn = strip(node);
    const flat = (n, sign = 1, out = []) => {
      n = strip(n);
      if (n.isOperatorNode && (n.fn === 'add' || n.fn === 'subtract')) { flat(n.args[0], sign, out); flat(n.args[1], n.fn === 'subtract' ? -sign : sign, out); }
      else out.push({ n, sign });
      return out;
    };
    const parts = flat(sn);
    if (parts.length > 1 && !useTab) {
      steps.push(step(T('i_linear'), parts.map((p, i) => (p.sign < 0 ? '-' : i ? '+' : '') + `\\int ${texM(p.n)}\\,d${v}`).join('')));
    }
    if (parts.length <= 8 && !useTab) for (const p of parts) {
      const rule = integrandRule(p.n, v);
      let Fi;
      try { Fi = texN(integrateN(toN(p.n.toString()), v)); } catch (e) { continue; }
      const formula = { i_power: `\\int ${v}^n\\,d${v}=\\frac{${v}^{n+1}}{n+1}`, i_ln: `\\int\\frac{1}{${v}}\\,d${v}=\\ln\\left|${v}\\right|`, i_parts: `\\int u'v\\,d${v}=uv-\\int uv'\\,d${v}`, i_linsub: `\\int g(a${v}+b)\\,d${v}=\\frac{1}{a}G(a${v}+b)` }[rule];
      steps.push(step(T(rule), (formula ? formula + '\\\\ ' : '') + `\\int ${texM(p.n)}\\,d${v}=${Fi}`));
    }
    let Ft = texN(F).replace(/\\ln\\left\((\w)\\right\)/g, '\\ln\\left|$1\\right|').split('\\ln\\left(\\left|').join('\\ln\\left|').split('\\right|\\right)').join('\\right|'); for (const [p, q] of [['\\ln\\left(\\sec\\left(x\\right)\\right)', '-\\ln\\left|\\cos\\left(x\\right)\\right|'], ['\\ln\\left(\\sin\\left(x\\right)\\right)', '\\ln\\left|\\sin\\left(x\\right)\\right|'], ['\\ln\\left(\\cosh\\left(x\\right)\\right)', '\\ln\\left(\\cosh\\left(x\\right)\\right)']]) Ft = Ft.split(p).join(q);
    if (/\b(erf|Si|Ci|Ei)\(/.test(F)) steps.push(step(T('i_special'), /erf/.test(F) ? '\\operatorname{erf}(x)=\\frac{2}{\\sqrt{\\pi}}\\int_{0}^{x}e^{-t^{2}}\\,dt' : '\\operatorname{Si}(x)=\\int_{0}^{x}\\frac{\\sin t}{t}\\,dt'));
    // Probe
    try {
      const dF = compileFn(fromN(nerdamer(`diff(${F},${v})`).toString()), v), fx = compileFn(toM(f, true), v);
      const ok = [0.31, 0.77, 1.9, 2.6].every(x => !isFinite(fx(x)) || Math.abs(dF(x) - fx(x)) < 1e-6 * (1 + Math.abs(fx(x))));
      if (ok) steps.push(step(T('i_check'), `F'(${v})=f(${v})\\;\\checkmark`));
    } catch (e) { }
    if (!definite) {
      steps.push(step(T('i_result'), `F(${v})=${Ft}+C`));
      return { inTex: K.texOf('integrate(' + a.join(',') + ')'), outTex: Ft + '+C', steps, plot: { fns: [toM(f, true)], v } };
    }
    // bestimmtes Integral
    try {
      const sub = b => {
        if (/Infinity/.test(b) || endPoles.some(q => Math.abs(q - toNum(math.evaluate(toM(b)))) < 1e-9)) return nerdamer(`limit(${F},${v},${b})`).toString();
        return nerdamer(F, { [v]: toN(b) }).toString();
      };
      const KNOWN = { 'atan(1)': '(pi/4)', 'atan(-1)': '(-pi/4)', 'atan(0)': '0', 'asin(1)': '(pi/2)', 'asin(-1)': '(-pi/2)', 'asin(0)': '0', 'asin(1/2)': '(pi/6)', 'asin(-1/2)': '(-pi/6)', 'atan(sqrt(3))': '(pi/3)', 'erf(0)': '0', 'log(1)': '0', 'Si(0)': '0' };
      const clean = t => { let o = String(t); for (const k in KNOWN) o = o.split(k).join(KNOWN[k]); return o.replace(/abs\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (m, inner) => { try { const z = toNum(math.evaluate(fromN(inner))); return isFinite(z) && z > 0 ? '(' + inner + ')' : m; } catch (e) { return m; } }); };
      const Fb = clean(sub(hi)), Fa = clean(sub(lo));
      let val = nerdamer(`(${Fb})-(${Fa})`).toString();
      try { // Wurzelpotenzen zusammenfassen: 10^(3/2) → 10·√10
        const pw = (a, n, neg) => { n = +n; const t = '(' + a + '^' + Math.floor(n / 2) + (n % 2 ? '*sqrt(' + a + ')' : '') + ')'; return neg && n % 2 ? '(-' + t + ')' : t; };
        const fx = t => t.replace(/\(-sqrt\((\d+)\)\)\^(\d+)/g, (m, a, n) => pw(a, n, true)).replace(/sqrt\((\d+)\)\^(\d+)/g, (m, a, n) => pw(a, n)).replace(/(\d+)\^\((\d+)\/2\)/g, (m, a, n) => pw(a, n));
        let v2 = val; for (let i = 0; i < 3; i++) { const f = fx(v2); if (f === v2) break; v2 = nerdamer(f).expand().toString(); }
        const n1 = toNum(math.evaluate(fromN(val))), n2 = toNum(math.evaluate(fromN(v2)));
        if (v2 !== val && Math.abs(n1 - n2) < 1e-9 * (1 + Math.abs(n1)) && v2.length <= val.length + 4) val = v2;
      } catch (e) {}
      const approx = toNum(math.evaluate(fromN(val)));
      const num = impNum != null ? impNum : simpson(compileFn(toM(f, true), v), toNum(math.evaluate(toM(lo))), toNum(math.evaluate(toM(hi))));
      if (isFinite(approx) && (Math.abs(approx - num) < 1e-4 * (1 + Math.abs(num)) || !isFinite(num) || /Infinity/.test(lo + hi))) {
        steps.push(step(T('i_bounds'), `\\left[${Ft}\\right]_{${K.texOf(a[2])}}^{${K.texOf(a[3])}}=${texN(Fb)}-\\left(${texN(Fa)}\\right)=${texN(val)}`));
        return { inTex: K.texOf('integrate(' + a.join(',') + ')'), outTex: texN(val), approx: Math.abs(approx - Number(val)) > 1e-12 || !/^-?[\d.]+$/.test(val) ? approx : null, steps, plot: { fns: [toM(f, true)], v, shade: [toNum(math.evaluate(toM(lo))), toNum(math.evaluate(toM(hi)))] } };
      }
    } catch (e) { }
  }
  if (definite) {
    const A = toNum(math.evaluate(toM(lo))), B = toNum(math.evaluate(toM(hi)));
    if (!isFinite(A) || !isFinite(B)) throw new Error(T('err_noint'));
    const val = impNum != null ? impNum : (A <= B ? 1 : -1) * jumpSimpson(compileFn(toM(f, true), v), Math.min(A, B), Math.max(A, B));
    steps.push(step(T('i_numeric'), `\\approx ${fmtReal(val)}`));
    return { inTex: K.texOf('integrate(' + a.join(',') + ')'), outTex: '\\approx ' + fmtReal(val), steps, plot: { fns: [toM(f, true)], v, shade: [A, B] } };
  }
  throw new Error(T('err_noint'));
};

CMDS.limit = (a) => {
  const f = prep(a[0]), v = a[1] || guessVar(f), at = prep(a[2] || '0'), dir = a[3] || '';
  const fM = toM(f, true), fx = compileFn(fM, v), steps = [];
  const inTex = K.texOf('limit(' + a.join(',') + ')');
  const atInf = /Infinity/.test(at);
  const p = atInf ? (at.includes('-') ? -Infinity : Infinity) : toNum(math.evaluate(toM(at)));
  let out = null;
  if (!atInf) {
    const y = fx(p);
    if (isFinite(y)) {
      steps.push(step(T('l_subst'), `f(${K.texOf(a[2] || '0')})=${ftex(y)}`));
      try { const r = nerdamer(toN(f), { [v]: toN(at) }).toString(); out = niceExact(r) ? texN(r) : ftex(y); } catch (e) { out = ftex(y); }
      return { inTex, outTex: out, steps };
    }
    const node = strip(math.parse(toM(f, false)));
    if (node.isOperatorNode && node.fn === 'divide') {
      const nu = compileFn(node.args[0].toString(), v), de = compileFn(node.args[1].toString(), v);
      if (Math.abs(nu(p)) < 1e-12 && Math.abs(de(p)) < 1e-12) {
        const dn = dSimp(node.args[0], v), dd = dSimp(node.args[1], v);
        const q = compileFn(`(${dn.toString()})/(${dd.toString()})`, v)(p);
        steps.push(step(T('l_00'), `\\lim\\frac{${texM(node.args[0])}}{${texM(node.args[1])}}=\\lim\\frac{${texM(dn)}}{${texM(dd)}}` + (isFinite(q) ? '=' + ftex(q) : '')));
      } else if (Math.abs(de(p)) < 1e-12) {
        steps.push(step(T('l_pole'), `\\lim_{${v}\\to ${ftex(p)}^-}=${fmtReal(fx(p - 1e-7))},\\;\\lim_{${v}\\to ${ftex(p)}^+}=${fmtReal(fx(p + 1e-7))}`));
      }
    }
  } else {
    const c = (() => { try { const r = math.rationalize(toM(f, false), {}, true); return r; } catch (e) { return null; } })();
    if (c && c.denominator) {
      const dn = polyCoeffs(c.numerator.toString(), v), dd = polyCoeffs(c.denominator.toString(), v);
      if (dn && dd) steps.push(step(T('l_inf'), `\\deg Z=${dn.length - 1},\\;\\deg N=${dd.length - 1}`));
    }
  }
  if (!atInf && !dir) { // beidseitiger Grenzwert: links und rechts vergleichen
    const one = s => { const vs = [1e-4, 1e-6, 1e-8].map(h => fx(p + s * h)); if (vs.some(isNaN)) return NaN; return (!isFinite(vs[2]) || (Math.abs(vs[2]) > 1e6 && Math.abs(vs[2]) > Math.abs(vs[0]))) ? (vs[2] > 0 ? Infinity : -Infinity) : vs[2]; };
    const Lm = one(-1), Rp = one(1);
    if (!isNaN(Lm) && !isNaN(Rp)) {
      const differ = isFinite(Lm) !== isFinite(Rp) || (!isFinite(Lm) && Lm !== Rp) || (isFinite(Lm) && Math.abs(Lm - Rp) > 1e-4 * (1 + Math.abs(Lm)));
      if (differ) { return { inTex, outTex: '\\text{' + T('l_none') + '}', steps: steps.concat([step(T('l_onesided'), `\\lim_{${v}\\to ${ftex(p)}^{-}}=${fmtReal(Lm)},\\quad \\lim_{${v}\\to ${ftex(p)}^{+}}=${fmtReal(Rp)}`)]), plot: { fns: [fM], v } }; out = '\\text{' + T('l_none') + '}'; steps.push(step(T('l_onesided'), `\\lim_{${v}\\to ${ftex(p)}^{-}}=${fmtReal(Lm)},\\quad \\lim_{${v}\\to ${ftex(p)}^{+}}=${fmtReal(Rp)}`)); }
    }
  }
  try {
    const r = nerdamer(`limit(${toN(f)},${v},${toN(at)})`).toString();
    if (!/limit|undefined|NaN/.test(r) && niceExact(r) && !(dir && /Infinity/.test(r) && !atInf)) out = texN(r);
  } catch (e) { }
  // numerische Kontrolle
  const side = s => { let last = NaN; for (const h of [1e-3, 1e-5, 1e-7]) last = fx(atInf ? p * 0 + Math.sign(p) / h * 1e3 : p + s * h); return last; };
  const L = dir.includes('-') ? side(-1) : side(1), R = dir.includes('+') ? side(1) : side(dir ? 1 : 1);
  const Lm = side(-1);
  if (out === null) {
    if (!atInf && !dir && isFinite(L) && isFinite(Lm) && Math.abs(L - Lm) > 1e-3 * (1 + Math.abs(L))) out = '\\text{' + T('l_none') + '}';
    else if (!isFinite(L) || Math.abs(L) > 1e8 || (!atInf && (() => { const sg = dir.includes('-') ? -1 : 1, a5 = fx(p + sg * 1e-5), a7 = fx(p + sg * 1e-7); return Math.abs(a7) > 1e5 && Math.abs(a7) > 10 * Math.abs(a5); })())) out = L > 0 ? '\\infty' : '-\\infty';
    else out = Math.abs(L) < 1e-9 ? '0' : '\\approx ' + fmtReal(L);
    steps.push(step(T('l_numeric'), ''));
  }
  return { inTex, outTex: out, steps, plot: { fns: [fM], v } };
};

function sumLike(a, isSum) {
  const f = prep(a[0]), k = a[1] || 'k', lo = prep(a[2] || '1'), hi = prep(a[3] || 'n');
  const steps = [], inTex = K.texOf((isSum ? 'sum(' : 'prod(') + a.join(',') + ')');
  const fM = toM(f, true), fx = compileFn(fM, k);
  const loN = toNum(math.evaluate(toM(lo))), symHi = freeSyms(toM(hi)).length > 0;
  const op = isSum ? '+' : '\\cdot ';
  if (!symHi) {
    const hiN = /Infinity/.test(hi) ? Infinity : toNum(math.evaluate(toM(hi)));
    if (hiN === Infinity) {
      let s = isSum ? 0 : 1, conv = false; const marks = {};
      for (let i = loN, c = 1; c <= 1e6; i++, c++) {
        const t = fx(i); s = isSum ? s + t : s * t;
        if (!isFinite(s)) break;
        if (c === 1e3 || c === 1e4 || c === 1e5 || c === 1e6) marks[c] = s;
      }
      if (marks[1e6] !== undefined) {
        const d1 = Math.abs(marks[1e5] - marks[1e4]), d2 = Math.abs(marks[1e6] - marks[1e5]);
        if (d2 < 1e-13 * (1 + Math.abs(s))) conv = true;
        else if (d2 < 0.35 * d1) { conv = true; s = marks[1e6] + (marks[1e6] - marks[1e5]) * (d2 / Math.max(d1 - d2, 1e-300)); }
      }
      let ex = null;
      try { const r = nerdamer(`${isSum ? 'sum' : 'product'}(${toN(f)},${k},${toN(lo)},Infinity)`).toString(); if (!/sum|product|Infinity|NaN/.test(r) && niceExact(r)) ex = r; } catch (e) { }
      steps.push(step(T('st_sum_partial'), `S_{10^3}\\approx ${fmtReal(marks[1e3])},\\; S_{10^6}\\approx ${fmtReal(marks[1e6])}`));
      if (!conv && !ex) return { inTex, outTex: '\\text{' + T('l_diverge') + '}', steps };
      return { inTex, outTex: ex ? texN(ex) : '\\approx ' + fmtReal(s), approx: ex ? s : null, steps };
    }
    const count = hiN - loN + 1;
    if (count <= 0) return { inTex, outTex: isSum ? '0' : '1', steps };
    const terms = [];
    for (let i = loN; i <= hiN && terms.length < 6; i++) {
      try { terms.push(texN(nerdamer(toN(f), { [k]: String(i) }).toString())); } catch (e) { terms.push(fmtReal(fx(i))); }
    }
    if (count <= 6) steps.push(step(isSum ? T('st_sum_expand') : T('st_prod_expand'), terms.join(op)));
    else steps.push(step(isSum ? T('st_sum_expand') : T('st_prod_expand'), terms.slice(0, 4).join(op) + op + '\\dots'));
    let r;
    try {
      r = nerdamer(`${isSum ? 'sum' : 'product'}(${toN(f)},${k},${loN},${hiN})`).toString();
      if (/sum|product/.test(r)) throw 0;
    } catch (e) {
      let s = isSum ? 0 : 1; for (let i = loN; i <= hiN; i++) s = isSum ? s + fx(i) : s * fx(i);
      return { inTex, outTex: fmtReal(s), steps };
    }
    let ap = null; try { ap = toNum(math.evaluate(fromN(r))); } catch (e) { }
    return { inTex, outTex: texN(r), approx: /^-?\d+$/.test(r) ? null : ap, steps };
  }
  // symbolische Obergrenze: Polynom in k → geschlossene Form durch Interpolation
  if (!isSum) throw new Error(T('err_symprod'));
  const pc = polyCoeffs(toM(f, false), k);
  if (!pc) {
    const r = nerdamer(`sum(${toN(f)},${k},${toN(lo)},${toN(hi)})`).toString();
    if (/sum\(/.test(r)) throw new Error(T('err_symsum'));
    return { inTex, outTex: texN(r), steps };
  }
  const d = pc.length - 1, pts = [];
  let acc = math.fraction(0);
  for (let i = 0; i <= d + 1; i++) {
    const kk = loN + i;
    acc = acc.add(math.fraction(nerdamer(toN(f), { [k]: String(kk) }).toString()));
    pts.push([kk, acc]);
  }
  // Lagrange in n (Variable = hi)
  const nn = 'NN';
  const lag = pts.map(([xi, yi], i) => {
    const num = pts.filter((_, j) => j !== i).map(([xj]) => `(${nn}-(${xj}))`).join('*');
    const den = pts.filter((_, j) => j !== i).reduce((p, [xj]) => p * (xi - xj), 1);
    return `(${yi.toFraction()})*${num || 1}/(${den})`;
  }).join('+');
  let poly = nerdamer(`expand(${lag})`).toString();
  let fac; try { fac = nerdamer(`factor(${poly})`).toString(); } catch (e) { fac = poly; }
  const subst = s => s.replace(/NN/g, '(' + toN(hi) + ')');
  const best = fac.length <= poly.length + 6 ? fac : poly;
  steps.push(step(T('st_sum_closed'), `\\text{${T('st_sum_poly', { d: d + 1 })}}`));
  steps.push(step(T('st_sum_values'), pts.slice(0, 4).map(([x, y]) => `S(${x})=${fracTex(y)}`).join(',\\;')));
  return { inTex, outTex: texN(nerdamer(subst(best)).toString()), steps };
}
CMDS.sum = a => sumLike(a, true);
CMDS.prod = a => sumLike(a, false);

CMDS.solve = (a) => {
  // solve(eq1, eq2, ..., var1, var2) – Variablen = Argumente ohne '=' die nur Namen sind
  const eqs = [], vars = [];
  for (const x of a) { if (/^[A-Za-z]\w*$/.test(x) && !splitEq(x)) vars.push(x); else eqs.push(x); }
  return solveEqs(eqs, vars);
};
function solveEqs(eqs, vars) {
  const steps = [];
  const pairs = eqs.map(e => { const p = splitEq(prep(e)); return p ? p : [prep(e), '0']; });
  const inTex = eqs.map(e => K.texOf(e)).join(',\\;');
  if (pairs.length === 1) {
    const [l, r] = pairs[0];
    const v = vars[0] || guessVar(`(${l})-(${r})`);
    if (!freeSyms(toM(`(${l})-(${r})`, false)).includes(v)) throw new Error(T('err_novar'));
    const others = freeSyms(toM(`(${l})-(${r})`, false)).filter(x => x !== v);
    if (others.length) {
      // symbolisch nach v auflösen
      const sols = solveExactN(toN(`(${l})-(${r})`), v) || [];
      if (!sols.length) throw new Error(T('err_unsolved'));
      steps.push(step(T('s_symbolic', { v }), ''));
      return { inTex, outTex: sols.map(s => `${v}=${texN(s)}`).join(',\\quad '), steps };
    }
    const res = solveSingle(l, r, v, steps);
    if (res.all) return { inTex, outTex: `${v}\\in\\mathbb{R}`, steps };
    if (!res.real.length && !res.complex.length) {
      steps.push(step(T('s_solution'), `\\mathbb{L}=\\{\\}`));
      return { inTex, outTex: `\\mathbb{L}=\\{\\,\\}`, steps };
    }
    // Probe
    const g = compileFn(toM(`(${l})-(${r})`, true), v);
    { // Definitionsbereich der Ausgangsgleichung prüfen (z. B. x²/x = 0 → x = 0 ausgeschlossen)
      const gl = compileFn(toM(l, true), v), gr = compileFn(toM(r, true), v);
      const bad = res.real.filter(z => !isFinite(gl(z.val)) || !isFinite(gr(z.val)));
      if (bad.length) {
        steps.push(step(T('s_domain'), bad.map(z => `${v}=${z.tex}`).join(',\\; ') + '\\;\\notin D'));
        res.real = res.real.filter(z => !bad.includes(z));
        if (!res.real.length && !res.complex.length) { steps.push(step(T('s_solution'), `\\mathbb{L}=\\{\\}`)); return { inTex, outTex: `\\mathbb{L}=\\{\\,\\}`, steps }; }
      }
    }
    if (res.real.length) steps.push(step(T('s_check'), res.real.slice(0, 4).map(s => `${v}=${s.tex}:\\; ${fmtReal(Math.abs(g(s.val)) < 1e-9 ? 0 : g(s.val))}`).join(',\\;') + '\\;\\checkmark'));
    let out = res.real.slice(0, 12).map((s, i) => `${v}_{${i + 1}}=${s.tex}` + (s.exact === false || s.numeric ? '' : (Math.abs(Number(s.tex)) === Math.abs(s.val) || /^-?[\d{},]+$/.test(s.tex) ? '' : '\\approx ' + fmtReal(s.val)))).join(',\\quad ');
    if (res.real.length === 1) out = out.replace(/_\{1\}/, '');
    if (res.real.length > 12) out += ',\\;\\dots';
    if (res.complex.length) out += (out ? '\\\\' : '') + '\\mathbb{C}:\\;' + res.complex.slice(0, 6).map(s => `${v}=${s.tex}`).join(',\\;');
    const periodic = res.periodic;
    const cpts = res.complex.length ? [...res.real.map((q, i) => ({ re: q.val, im: 0, tex: q.tex })), ...res.complex.map(q => ({ re: q.re, im: q.im, tex: q.tex }))].filter(q => isFinite(q.re)) : null;
    return { inTex, outTex: out, steps, cpts, note: periodic ? T('s_periodic', { p: S.angle === 'deg' ? '360°' : '2π' }) : null, plot: { fns: [toM(l, true), toM(r, true)], v }, marks: res.real.slice(0, 30).map(s => s.val) };
  }
  // Gleichungssystem
  const allVars = vars.length ? vars : [...new Set(pairs.flatMap(([l, r]) => freeSyms(toM(`(${l})-(${r})`, false))))].sort();
  // linear?
  const rows = [];
  let linear = true;
  for (const [l, r] of pairs) {
    const e = math.parse(toM(`(${l})-(${r})`, false));
    const row = [];
    for (const v of allVars) {
      const d = math.simplify(math.derivative(e, v));
      if (freeSyms(d.toString()).length) { linear = false; break; }
      row.push(toNum(d.evaluate()));
    }
    if (!linear) break;
    const scope = Object.fromEntries(allVars.map(v => [v, 0]));
    row.push(-toNum(e.evaluate(scope)));
    rows.push(row);
  }
  if (linear && rows.every(r => r.every(x => Number.isFinite(x) && Math.abs(x - Math.round(x * 1e6) / 1e6) < 1e-9))) {
    const gs = gaussSchool(rows.map(r => r.map(x => Math.round(x * 1e6) / 1e6)), allVars, steps);
    return { inTex, outTex: gs.out, steps };
  }
  if (false) {
    steps.push(step(T('s_system'), ''));
    const M = rrefSteps(rows.map(r => r.map(x => Math.round(x * 1e6) / 1e6)), steps, 1);
    const n = allVars.length;
    // Auswertung
    const inconsistent = M.some(r => r.slice(0, n).every(x => x.n === 0) && r[n].n !== 0);
    if (inconsistent) return { inTex, outTex: '\\mathbb{L}=\\{\\,\\}', steps };
    const rank = M.filter(r => r.slice(0, n).some(x => x.n !== 0)).length;
    if (rank < n) {
      steps.push(step(T('s_infinite'), ''));
      const sol = nerdamer.solveEquations(pairs.map(([l, r]) => toN(l) + '=' + toN(r)), allVars);
      return { inTex, outTex: '\\text{' + T('s_infinite') + '}', steps };
    }
    const out = allVars.map((v, i) => `${v}=${fracTex(M[i][n])}`).join(',\\quad ');
    return { inTex, outTex: out, steps };
  }
  steps.push(step(T('s_cas'), ''));
  const sol = nerdamer.solveEquations(pairs.map(([l, r]) => toN(l) + '=' + toN(r)), allVars);
  const arr = Array.isArray(sol) ? sol : [];
  if (!arr.length) throw new Error(T('err_unsolved'));
  return { inTex, outTex: arr.map(([v, x]) => `${v}=${texN(String(x))}`).join(',\\quad '), steps };
}

/* ---------- Matrizen ---------- */
const mExact = () => K._mf || (K._mf = math.create(math.all, { number: 'Fraction' }));
function matEval(s) {
  const sM = toM(prep(s), true);
  try { return mExact().evaluate(sM.replace(/(\d+\.\d+)/g, 'fraction("$1")')); } catch (e) { return math.evaluate(sM); }
}
const arr = m => (m.toArray ? m.toArray() : m);
const mtex = A => fmtVal(A);
CMDS.det = (a) => {
  const A = arr(matEval(a[0])), n = A.length, steps = [];
  const d = mExact().det(A);
  const e = (i, j) => fmtVal(A[i][j]);
  const p = x => { const t = fmtVal(x); return t.startsWith('-') ? '\\left(' + t + '\\right)' : t; };
  if (n === 2) steps.push(step(T('m_det2'), `\\det A=a_{11}a_{22}-a_{12}a_{21}=${p(A[0][0])}\\cdot ${p(A[1][1])}-${p(A[0][1])}\\cdot ${p(A[1][0])}=${fmtVal(d)}`));
  else if (n === 3) {
    const P = [[0, 0, 1, 1, 2, 2], [0, 1, 1, 2, 2, 0], [0, 2, 1, 0, 2, 1]];
    const plus = [[[0, 0], [1, 1], [2, 2]], [[0, 1], [1, 2], [2, 0]], [[0, 2], [1, 0], [2, 1]]];
    const minus = [[[0, 2], [1, 1], [2, 0]], [[0, 0], [1, 2], [2, 1]], [[0, 1], [1, 0], [2, 2]]];
    const pr = g => g.map(([i, j]) => p(A[i][j])).join('\\cdot ');
    steps.push(step(T('m_sarrus'), plus.map(pr).join('+') + '\\\\ -\\left(' + minus.map(pr).join('+') + '\\right)=' + fmtVal(d)));
  } else if (n <= 6) {
    const parts = A[0].map((x, j) => {
      const minor = A.slice(1).map(r => r.filter((_, k) => k !== j));
      return `${j % 2 ? '-' : '+'}${p(x)}\\cdot\\det${mtex(minor)}`;
    });
    steps.push(step(T('m_laplace'), parts.join('').replace(/^\+/, '')));
  }
  return { inTex: `\\det${mtex(A)}`, outTex: fmtVal(d), steps };
};
CMDS.inv = (a) => {
  const A = arr(matEval(a[0])), n = A.length, steps = [];
  const d = mExact().det(A);
  if (Number(d) === 0 || (d.n === 0)) { steps.push(step(T('m_singular'), `\\det A=0`)); return { inTex: mtex(A) + '^{-1}', outTex: '\\text{' + T('m_singular') + '}', steps }; }
  const I = mExact().inv(A);
  if (n === 2) {
    steps.push(step(T('m_det2'), `\\det A=${fmtVal(d)}`));
    steps.push(step(T('m_inv2'), `A^{-1}=\\frac{1}{${fmtVal(d)}}\\begin{pmatrix}${fmtVal(A[1][1])}&${fmtVal(mExact().unaryMinus(A[0][1]))}\\\\${fmtVal(mExact().unaryMinus(A[1][0]))}&${fmtVal(A[0][0])}\\end{pmatrix}`));
  } else if (A.every(r => r.every(x => Number.isFinite(Number(x))))) {
    steps.push(step(T('m_gj'), ''));
    rrefSteps(A.map((r, i) => r.map(Number).concat(Array.from({ length: n }, (_, j) => +(i === j)))), steps, n);
  }
  return { inTex: mtex(A) + '^{-1}', outTex: fmtVal(arr(I)), steps };
};
CMDS.rref = (a) => {
  const A = arr(matEval(a[0])).map(r => r.map(Number)), steps = [];
  const M = rrefSteps(A, steps);
  return { inTex: '\\operatorname{rref}' + mtex(A), outTex: '\\begin{pmatrix}' + M.map(r => r.map(fracTex).join('&')).join('\\\\') + '\\end{pmatrix}', steps };
};
CMDS.rank = (a) => {
  const A = arr(matEval(a[0])).map(r => r.map(Number)), steps = [];
  const M = rrefSteps(A, steps);
  const r = M.filter(row => row.some(x => x.n !== 0)).length;
  steps.push(step(T('m_rank'), `\\operatorname{rg}A=${r}`));
  return { inTex: '\\operatorname{rg}' + mtex(A), outTex: String(r), steps };
};
CMDS.transpose = (a) => { const A = arr(matEval(a[0])); return { inTex: mtex(A) + '^{T}', outTex: fmtVal(arr(mExact().transpose(A))), steps: [step(T('m_transp'), '')] }; };
CMDS.trace = (a) => { const A = arr(matEval(a[0])); const t = mExact().trace(A); return { inTex: '\\operatorname{sp}' + mtex(A), outTex: fmtVal(t), steps: [step(T('m_trace'), A.map((r, i) => fmtVal(r[i])).join('+') + '=' + fmtVal(t))] }; };
CMDS.cross = (a) => {
  const u = arr(matEval(a[0])).flat(), w = arr(matEval(a[1])).flat(), r = mExact().cross(u, w);
  const f = fmtVal, p = x => { const t = f(x); return t.startsWith('-') ? '(' + t + ')' : t; };
  return { inTex: mtex(u) + '\\times' + mtex(w), outTex: fmtVal(r), steps: [step(T('m_cross'), `\\begin{pmatrix}${p(u[1])}\\cdot ${p(w[2])}-${p(u[2])}\\cdot ${p(w[1])}\\\\${p(u[2])}\\cdot ${p(w[0])}-${p(u[0])}\\cdot ${p(w[2])}\\\\${p(u[0])}\\cdot ${p(w[1])}-${p(u[1])}\\cdot ${p(w[0])}\\end{pmatrix}=${fmtVal(r)}`)] };
};
CMDS.dot = (a) => {
  const u = arr(matEval(a[0])).flat(), w = arr(matEval(a[1])).flat(), r = mExact().dot(u, w);
  const p = x => { const t = fmtVal(x); return t.startsWith('-') ? '(' + t + ')' : t; };
  const steps = [step(T('m_dot'), u.map((x, i) => p(x) + '\\cdot ' + p(w[i])).join('+') + '=' + fmtVal(r))];
  // Winkel
  try {
    const nu = Math.hypot(...u.map(Number)), nw = Math.hypot(...w.map(Number));
    const ang = Math.acos(Number(r) / (nu * nw));
    steps.push(step(T('m_angle'), `\\cos\\varphi=\\frac{\\vec a\\cdot\\vec b}{|\\vec a|\\,|\\vec b|}=${fmtReal(Number(r) / (nu * nw))}\\Rightarrow\\varphi\\approx ${fmtReal(ang * 180 / Math.PI)}^\\circ`));
  } catch (e) { }
  return { inTex: mtex(u) + '\\cdot' + mtex(w), outTex: fmtVal(r), steps };
};
CMDS.angle = (a) => {
  const u = arr(matEval(a[0])).flat().map(Number), w = arr(matEval(a[1])).flat().map(Number);
  const dt = u.reduce((p, x, i) => p + x * w[i], 0), nu = Math.hypot(...u), nw = Math.hypot(...w);
  const c = dt / (nu * nw), phi = Math.acos(Math.max(-1, Math.min(1, c)));
  return { inTex: '\\angle\\left(' + mtex(u) + ',' + mtex(w) + '\\right)', outTex: fmtReal(phi * 180 / Math.PI) + '^\\circ', approx: null,
    steps: [step(T('m_dot'), `\\vec a\\cdot\\vec b=${fmtReal(dt)}`), step(T('m_norm'), `|\\vec a|=${fmtReal(nu)},\\;|\\vec b|=${fmtReal(nw)}`),
      step(T('m_angle'), `\\cos\\varphi=\\frac{${fmtReal(dt)}}{${fmtReal(nu)}\\cdot ${fmtReal(nw)}}=${fmtReal(c)}\\Rightarrow\\varphi=${fmtReal(phi * 180 / Math.PI)}^\\circ=${fmtReal(phi)}\\,\\text{rad}`)] };
};
CMDS.norm = (a) => {
  const u = arr(matEval(a[0])).flat();
  const sq = u.reduce((s, x) => s + Number(x) ** 2, 0);
  let ex; try { ex = texN(nerdamer(`sqrt(${toN(String(math.fraction(sq).toFraction()))})`).toString()); } catch (e) { ex = fmtReal(Math.sqrt(sq)); }
  return { inTex: '\\left|' + mtex(u) + '\\right|', outTex: ex, approx: Number.isInteger(Math.sqrt(sq)) ? null : Math.sqrt(sq), steps: [step(T('m_norm'), `\\sqrt{${u.map(x => { const t = fmtVal(x); return t.startsWith('-') ? '(' + t + ')^2' : t + '^2'; }).join('+')}}=\\sqrt{${ftex(sq)}}`)] };
};
function charPoly(A) { // Faddeev–LeVerrier mit Brüchen → Koeffizienten aufsteigend von det(λE − A)
  const n = A.length, F = A.map(r => r.map(x => math.fraction(x)));
  const mul = (X, Y) => X.map((r, i) => Y[0].map((_, j) => r.reduce((s, x, k) => s.add(x.mul(Y[k][j])), math.fraction(0))));
  let M = F.map((r, i) => r.map((_, j) => math.fraction(i === j ? 1 : 0)));
  const c = Array(n + 1); c[n] = math.fraction(1);
  let AM = mul(F, M);
  for (let k = 1; k <= n; k++) {
    if (k > 1) { M = AM.map((r, i) => r.map((x, j) => i === j ? x.add(c[n - k + 1]) : x)); AM = mul(F, M); }
    const tr = AM.reduce((s, r, i) => s.add(r[i]), math.fraction(0));
    c[n - k] = tr.mul(-1).div(k);
  }
  return c;
}
CMDS.eig = (a) => {
  const A = arr(matEval(a[0])), steps = [];
  const cf = charPoly(A);
  const cNum = cf.map(x => x.valueOf());
  steps.push(step(T('m_char'), `\\det(\\lambda E-A)=${polyTex(cNum, '\\lambda ')}=0`));
  const res = polyRoots(cNum, 'x');
  let out = res.real.map((s, i) => `\\lambda_{${i + 1}}=${s.tex}`).join(',\\quad ');
  if (res.complex.length) out += (out ? ',\\quad ' : '') + res.complex.map(s => `\\lambda=${s.tex}`).join(',\\;');
  try {
    const E = math.eigs(A.map(r => r.map(Number)));
    const vecs = E.eigenvectors ? E.eigenvectors.map(e => `\\lambda=${fmtVal(e.value)}:\\;\\vec v=` + fmtVal(arr(e.vector).map(x => typeof x === 'number' ? Number(x.toPrecision(6)) : x))) : [];
    if (vecs.length) steps.push(step(T('m_eigvec'), vecs.join('\\\\')));
  } catch (e) { }
  const cpts = res.complex.length ? [...res.real.map(q => ({ re: q.val, im: 0, tex: q.tex })), ...res.complex.map(q => ({ re: q.re, im: q.im, tex: q.tex }))] : null;
  return { inTex: '\\operatorname{eig}' + mtex(A), outTex: out, steps, cpts };
};

/* ---------- Kombinatorik / Statistik / Zahlentheorie ---------- */
const UNDEF = (inTex, key) => ({ inTex, outTex: '\\text{' + T('undef') + '}', steps: [step(T('ud_title'), '\\text{' + T(key) + '}')], note: T(key) });
CMDS.nCr = (a) => {
  const n = +math.evaluate(toM(prep(a[0]))), k = +math.evaluate(toM(prep(a[1])));
  if (!(Number.isInteger(n) && Number.isInteger(k) && n >= 0 && k >= 0)) return UNDEF('\\binom{' + n + '}{' + k + '}', 'ud_ncr');
  const r = bigBinom(n, k), steps = [];
  steps.push(step(T('c_binom'), `\\binom{${n}}{${k}}=\\frac{${n}!}{${k}!\\cdot(${n}-${k})!}`));
  if (k > 0 && k <= 8) steps.push(step(T('c_short'), `=\\frac{${Array.from({ length: k }, (_, i) => n - i).join('\\cdot ')}}{${Array.from({ length: k }, (_, i) => k - i).join('\\cdot ')}}=${r}`));
  return { inTex: `\\binom{${n}}{${k}}`, outTex: String(r), steps };
};
CMDS.nPr = (a) => {
  const n = +math.evaluate(toM(prep(a[0]))), k = +math.evaluate(toM(prep(a[1])));
  if (!(Number.isInteger(n) && Number.isInteger(k) && n >= 0 && k >= 0)) return UNDEF('P(' + n + ',' + k + ')', 'ud_ncr');
  const r = bigFact(n) / bigFact(n - k);
  return { inTex: `P(${n},${k})`, outTex: String(r), steps: [step(T('c_perm'), `\\frac{${n}!}{(${n}-${k})!}${k <= 8 ? '=' + Array.from({ length: k }, (_, i) => n - i).join('\\cdot ') : ''}=${r}`)] };
};
CMDS.fact = (a) => {
  const n = +math.evaluate(toM(prep(a[0])));
  const r = bigFact(n);
  return { inTex: `${n}!`, outTex: String(r), approx: n > 20 ? Number(r) : null, steps: n <= 12 ? [step(T('c_fact'), `${n}!=${Array.from({ length: n }, (_, i) => n - i).join('\\cdot ') || 1}=${r}`)] : [] };
};
CMDS.binomPdf = (a) => {
  const [n, p, k] = a.map(x => toNum(math.evaluate(toM(prep(x)))));
  const r = Number(bigBinom(n, k)) * p ** k * (1 - p) ** (n - k);
  return { inTex: `P(X=${k})`, outTex: fmtReal(r), steps: [step(T('b_pdf'), `P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}=\\binom{${n}}{${k}}\\cdot ${fmtReal(p)}^{${k}}\\cdot ${fmtReal(1 - p)}^{${n - k}}=${fmtReal(r)}`)] };
};
CMDS.binomCdf = (a) => {
  const [n, p, k] = a.map(x => toNum(math.evaluate(toM(prep(x)))));
  let s = 0; for (let i = 0; i <= k; i++) s += Number(bigBinom(n, i)) * p ** i * (1 - p) ** (n - i);
  return { inTex: `P(X\\le ${k})`, outTex: fmtReal(s), steps: [step(T('b_cdf'), `\\sum_{i=0}^{${k}}\\binom{${n}}{i}${fmtReal(p)}^{i}\\cdot ${fmtReal(1 - p)}^{${n}-i}=${fmtReal(s)}`)] };
};
CMDS.normCdf = (a) => {
  const [lo, hi, mu = 0, sd = 1] = a.map(x => toNum(math.evaluate(toM(prep(x)))));
  const Phi = z => 0.5 * (1 + math.erf(z / Math.SQRT2));
  const za = (lo - mu) / sd, zb = (hi - mu) / sd, r = Phi(zb) - Phi(za);
  return { inTex: `P(${fmtReal(lo)}\\le X\\le ${fmtReal(hi)})`, outTex: fmtReal(r), steps: [step(T('n_std'), `z_1=\\frac{${fmtReal(lo)}-${fmtReal(mu)}}{${fmtReal(sd)}}=${fmtReal(za)},\\; z_2=${fmtReal(zb)}`), step(T('n_phi'), `\\Phi(${fmtReal(zb)})-\\Phi(${fmtReal(za)})=${fmtReal(r)}`)] };
};
function listArgs(a) {
  const s = a.length === 1 && /^\[/.test(a[0]) ? splitTop(a[0].slice(1, -1)) : a;
  return s.map(x => toNum(math.evaluate(toM(prep(x)))));
}
CMDS.mean = (a) => { const x = listArgs(a), s = x.reduce((p, q) => p + q, 0); return { inTex: '\\bar x', outTex: ftex(s / x.length), steps: [step(T('stat_mean'), `\\bar x=\\frac{${x.map(fmtReal).join('+')}}{${x.length}}=\\frac{${fmtReal(s)}}{${x.length}}=${ftex(s / x.length)}`)] }; };
CMDS.median = (a) => { const x = listArgs(a).sort((p, q) => p - q), n = x.length, m = n % 2 ? x[(n - 1) / 2] : (x[n / 2 - 1] + x[n / 2]) / 2; return { inTex: '\\tilde x', outTex: ftex(m), steps: [step(T('stat_median'), x.map(fmtReal).join(',\\;'))] }; };
const varSteps = (a, sample) => {
  const x = listArgs(a), n = x.length, m = x.reduce((p, q) => p + q, 0) / n;
  const ss = x.reduce((p, q) => p + (q - m) ** 2, 0), v = ss / (sample ? n - 1 : n);
  return { x, n, m, ss, v, steps: [step(T('stat_mean'), `\\bar x=${ftex(m)}`), step(T('stat_var'), `s^2=\\frac{\\sum (x_i-\\bar x)^2}{${sample ? 'n-1' : 'n'}}=\\frac{${ftex(ss)}}{${sample ? n - 1 : n}}=${ftex(v)}`)] };
};
CMDS.var = (a) => { const r = varSteps(a, true); return { inTex: 's^2', outTex: ftex(r.v), steps: r.steps }; };
CMDS.std = (a) => { const r = varSteps(a, true); r.steps.push(step(T('stat_std'), `s=\\sqrt{${ftex(r.v)}}=${fmtReal(Math.sqrt(r.v))}`)); return { inTex: 's', outTex: fmtReal(Math.sqrt(r.v)), steps: r.steps }; };
CMDS.gcd = (a) => {
  let [x, y] = a.map(s => Math.abs(Math.round(toNum(math.evaluate(toM(prep(s))))))); const lines = [];
  const g0 = math.gcd(x, y);
  while (y !== 0 && lines.length < 25) { lines.push(`${x}=${Math.floor(x / y)}\\cdot ${y}+${x % y}`); [x, y] = [y, x % y]; }
  return { inTex: '\\operatorname{ggT}(' + a.join(',') + ')', outTex: String(g0), steps: [step(T('gcd_euclid'), lines.join('\\\\'))] };
};
CMDS.lcm = (a) => {
  const [x, y] = a.map(s => Math.abs(Math.round(toNum(math.evaluate(toM(prep(s)))))));
  const g = math.gcd(x, y), l = math.lcm(x, y);
  return { inTex: '\\operatorname{kgV}(' + a.join(',') + ')', outTex: String(l), steps: [step(T('lcm_f'), `\\frac{${x}\\cdot ${y}}{\\operatorname{ggT}=${g}}=${l}`)] };
};
CMDS.factor = (a) => {
  const s = prep(a[0]);
  if (/^\s*\d+\s*$/.test(s)) {
    let n = +s, p = 2; const f = [], lines = [];
    if (n < 2) return { inTex: s, outTex: s, steps: [] };
    while (n > 1 && p * p <= n) { if (n % p === 0) { lines.push(`${n}:${p}=${n / p}`); f.push(p); n /= p; } else p++; }
    if (n > 1) { f.push(n); lines.push(`${n}:${n}=1`); }
    const g = {}; f.forEach(x => g[x] = (g[x] || 0) + 1);
    return { inTex: s, outTex: Object.entries(g).map(([b, e]) => e > 1 ? `${b}^{${e}}` : b).join('\\cdot '), steps: [step(T('primefac'), lines.join('\\\\'))] };
  }
  const r = nerdamer(`factor(${toN(s)})`).toString();
  return { inTex: K.texOf(a[0]), outTex: texN(r), steps: [step(T('fact_'), '')] };
};
CMDS.expand = (a) => { const r = nerdamer(`expand(${toN(prep(a[0]))})`).toString(); return { inTex: K.texOf(a[0]), outTex: texN(r), steps: [step(T('expd'), '')] }; };
CMDS.simplify = (a) => { const r = nerdamer(`simplify(${toN(prep(a[0]))})`).toString(); return { inTex: K.texOf(a[0]), outTex: texN(r), steps: [step(T('simp'), '')] }; };
CMDS.apart = (a) => { const v = a[1] || guessVar(a[0]); const r = nerdamer(`partfrac(${toN(prep(a[0]))},${v})`).toString(); return { inTex: K.texOf(a[0]), outTex: texN(r), steps: [step(T('apart'), '')] }; };
CMDS.taylor = (a) => {
  const f = prep(a[0]), v = a[1] || 'x', x0 = a[2] || '0', n = Math.min(parseInt(a[3] || '5'), 12);
  let node = math.parse(toM(f, false)); const steps = [], terms = [];
  for (let k = 0; k <= n; k++) {
    let val;
    try { val = nerdamer(toN(node.toString()), { [v]: toN(x0) }).toString(); } catch (e) { val = String(node.evaluate({ [v]: toNum(math.evaluate(toM(x0))) })); }
    steps.push(step(T('taylor_k', { k }), `f^{(${k})}(${K.texOf(x0)})=${texN(val)}`));
    if (val !== '0') terms.push(`(${val})/${bigFact(k)}*(${v}-(${toN(x0)}))^${k}`);
    node = dSimp(node, v);
  }
  const poly = nerdamer(`expand(${terms.join('+') || '0'})`).toString();
  steps.push(step(T('taylor_poly'), `T_{${n}}(${v})=\\sum_{k=0}^{${n}}\\frac{f^{(k)}(${K.texOf(x0)})}{k!}(${v}-${K.texOf(x0)})^k`));
  return { inTex: `T_{${n}}\\left(${K.texOf(a[0])}\\right)`, outTex: texN(poly), steps, plot: { fns: [toM(f, true), fromN(poly)], v } };
};
// Prozent
const pnum = s => toNum(math.evaluate(toM(prep(s))));
CMDS.pctval = (a) => { const [p, G] = a.map(pnum), W = G * p / 100; return { inTex: `${fmtReal(p)}\\,\\%\\text{ ${T('of')} }${fmtReal(G)}`, outTex: fmtReal(W), steps: [step(T('pct_value'), `W=\\frac{G\\cdot p}{100}=\\frac{${fmtReal(G)}\\cdot ${fmtReal(p)}}{100}=${fmtReal(W)}`)] }; };
CMDS.pctrate = (a) => { const [W, G] = a.map(pnum), p = W / G * 100; return { inTex: `\\frac{${fmtReal(W)}}{${fmtReal(G)}}`, outTex: fmtReal(p) + '\\,\\%', steps: [step(T('pct_rate'), `p=\\frac{W}{G}\\cdot 100=\\frac{${fmtReal(W)}}{${fmtReal(G)}}\\cdot 100=${fmtReal(p)}\\,\\%`)] }; };
CMDS.pctbase = (a) => { const [W, p] = a.map(pnum), G = W * 100 / p; return { inTex: `G`, outTex: fmtReal(G), steps: [step(T('pct_base'), `G=\\frac{W\\cdot 100}{p}=\\frac{${fmtReal(W)}\\cdot 100}{${fmtReal(p)}}=${fmtReal(G)}`)] }; };
CMDS.pctchg = (a) => { const [o, n] = a.map(pnum), p = (n - o) / o * 100; return { inTex: `${fmtReal(o)}\\to ${fmtReal(n)}`, outTex: (p > 0 ? '+' : '') + fmtReal(p) + '\\,\\%', steps: [step(T('pct_change'), `\\frac{${fmtReal(n)}-${fmtReal(o)}}{${fmtReal(o)}}\\cdot 100=${fmtReal(p)}\\,\\%`)] }; };
CMDS.deg2rad = (a) => { const x = pnum(a[0]); let ex; try { ex = texN(nerdamer(`(${toN(prep(a[0]))})*pi/180`).toString()); } catch (e) { ex = fmtReal(x * Math.PI / 180); } return { inTex: `${K.texOf(a[0])}^\\circ`, outTex: ex, approx: x * Math.PI / 180, steps: [step(T('conv_d2r'), `${fmtReal(x)}^\\circ\\cdot\\frac{\\pi}{180^\\circ}`)] }; };
CMDS.rad2deg = (a) => { const x = pnum(a[0]); return { inTex: K.texOf(a[0]) + '\\,\\text{rad}', outTex: fmtReal(x * 180 / Math.PI) + '^\\circ', steps: [step(T('conv_r2d'), `${K.texOf(a[0])}\\cdot\\frac{180^\\circ}{\\pi}`)] }; };
CMDS.torad = CMDS.deg2rad; CMDS.todeg = CMDS.rad2deg;
// Tangente an f in x0
CMDS.tangent = (a) => {
  const f = prep(a[0]), v = a[1] || guessVar(f), x0s = prep(a[2] || '0');
  const node = math.parse(toM(f, false)), d = dSimp(node, v), fx = compileFn(toM(f, true), v), dx = compileFn(d.toString(), v);
  const x0 = toNum(math.evaluate(toM(x0s))), y0 = fx(x0), m = dx(x0);
  if (!isFinite(y0) || !isFinite(m)) throw new Error(T('err_unsolved'));
  const ex = s => { try { const r = nerdamer(s).toString(); return niceExact(r) ? r : null; } catch (e) { return null; } };
  const y0e = ex(toN(f).replace(new RegExp('\\b' + v + '\\b', 'g'), '(' + toN(x0s) + ')')), me = ex(toN(d.toString()).replace(new RegExp('\\b' + v + '\\b', 'g'), '(' + toN(x0s) + ')'));
  const Y0 = y0e ? texN(y0e) : ftex(y0), M = me ? texN(me) : ftex(m), X0 = K.texOf(a[2] || '0');
  let tN = `(${me || m})*(x-(${toN(x0s)}))+(${y0e || y0})`, out;
  try { out = texN(nerdamer(`expand(${tN})`).toString()); } catch (e) { out = polyTex([y0 - m * x0, m], 'x'); }
  const steps = [
    step(T('tg_point'), `f(${X0})=${Y0}\\;\\Rightarrow\\;P\\left(${X0}\\,|\\,${Y0}\\right)`),
    step(T('a_deriv1'), `f'(${v})=${texM(d)}`),
    step(T('tg_slope'), `m=f'(${X0})=${M}`),
    step(T('tg_formula'), `t(x)=m\\,(x-x_0)+f(x_0)=${M}\\left(x-${X0}\\right)+${Y0}=${out}`)
  ];
  const tM = toM(String(tN).replace(/\blog\(/g, 'ln('), true);
  return { inTex: `t:\\;f(${v})=${K.texOf(a[0])},\\;x_0=${X0}`, outTex: 't(x)=' + out, steps, plot: { fns: [toM(f, true), `(${m})*(x-(${x0}))+(${y0})`], v: 'x' }, marks: [x0] };
};
CMDS.randInt = (a) => {
  const [lo, hi] = a.map(x => Math.round(toNum(math.evaluate(toM(prep(x))))));
  const r = lo + Math.floor(Math.random() * (hi - lo + 1));
  return { inTex: `\\text{${T('rand_int')}}\\;[${lo},\\,${hi}]`, outTex: String(r), steps: [] };
};
CMDS.mode = (a) => {
  const x = listArgs(a), c = new Map(); x.forEach(v => c.set(v, (c.get(v) || 0) + 1));
  const mx = Math.max(...c.values()), ms = [...c].filter(([, n]) => n === mx).map(([v]) => v).sort((p, q) => p - q);
  return { inTex: '\\operatorname{Modus}', outTex: ms.map(ftex).join(',\\;'), steps: [step(T('stat_mode'), [...c].sort((p, q) => p[0] - q[0]).map(([v, n]) => `${ftex(v)}:\\;${n}\\times`).join(',\\;'))] };
};
CMDS.quantile = (a) => {
  const p = toNum(math.evaluate(toM(prep(a[a.length - 1])))), x = listArgs(a.slice(0, -1)).sort((u, w) => u - w);
  const r = math.quantileSeq(x, p);
  return { inTex: `Q_{${fmtReal(p)}}`, outTex: fmtReal(r), steps: [step(T('stat_sorted'), x.map(fmtReal).join(',\\;'))] };
};
/* ---------- Polynome Schritt für Schritt: Polynomdivision, pq / abc / binomisch, Substitution ---------- */
const R9 = x => Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) + 0 : x;
function monoTex(a, p, v, first) {
  if (Math.abs(a) < 1e-12) return '';
  const abs = Math.abs(a), coef = (Math.abs(abs - 1) < 1e-12 && p > 0) ? '' : ftex(abs);
  return (a < 0 ? '-' : (first ? '' : '+')) + coef + (p > 0 ? v + (p > 1 ? '^{' + p + '}' : '') : '');
}
const linTex = (r, v) => r === 0 ? v : `${v}${r < 0 ? '+' : '-'}${ftex(Math.abs(r))}`;
const parT = t => /^-/.test(t) || /[+\-]/.test(t.slice(1)) ? '\\left(' + t + '\\right)' : t;
const lines = rows => '\\begin{aligned}' + rows.map(r => '&' + r).join('\\\\') + '\\end{aligned}';
function polyLongDiv(cAsc, r, v) {
  const D = cAsc.slice().reverse(), n = D.length - 1, dv = linTex(r, v);
  const q = []; { const t = D.slice(); for (let i = 0; i < n; i++) { q.push(R9(t[i])); t[i + 1] = R9(t[i + 1] + t[i] * r); } }
  const qAsc = q.slice().reverse();
  const blank = () => Array(n + 2).fill('');
  const rows = [], sub = [];
  const r0 = blank(); let first = true;
  D.forEach((a, i) => { const t = monoTex(a, n - i, v, first); if (t) first = false; r0[i] = t; });
  r0[0] = '(' + r0[0]; r0[n] = r0[n] + ')';
  r0[n + 1] = `:\\,(${dv})=${polyTex(qAsc, v)}`;
  rows.push(r0);
  const rem = D.slice();
  for (let i = 0; i < n; i++) {
    const lead = rem[i], qi = q[i], p = n - i;
    if (Math.abs(lead) < 1e-12) continue;
    const pr = [qi, R9(-qi * r)];
    const s = blank();
    s[i] = '\\underline{-(' + monoTex(pr[0], p, v, true) + '}';
    s[i + 1] = '\\underline{' + (monoTex(pr[1], p - 1, v, false) || '+0') + ')}';
    rows.push(s);
    const before = rem[i + 1];
    rem[i] = 0; rem[i + 1] = R9(rem[i + 1] - pr[1]);
    let k = i + 1; while (k < n && Math.abs(rem[k]) < 1e-12) k++;
    const last = Math.min(k + 1, n);
    const rr = blank(); let f2 = true, remT = '';
    for (let j = i + 1; j <= last; j++) { const t = monoTex(rem[j], n - j, v, f2); if (t) { f2 = false; rr[j] = t; remT += t; } }
    if (f2) { rr[n] = '0'; remT = '0'; }
    rows.push(rr);
    const lt = monoTex(lead, p, v, true), qt = monoTex(qi, p - 1, v, true);
    const prT = monoTex(pr[0], p, v, true) + monoTex(pr[1], p - 1, v, false);
    const L = [
      [T('pd_divide'), `${lt}:${v}=${qt}`],
      [T('pd_mult'), `${parT(qt)}\\cdot(${dv})=${prT}`],
      [T('pd_sub'), `(${lt}${monoTex(before, p - 1, v, false)})-(${prT})=${monoTex(rem[i + 1], p - 1, v, true) || '0'}`]
    ];
    if (i + 2 <= n && last >= i + 2) L.push([T('pd_down'), remT]);
    sub.push({ title: T('pd_step', { k: sub.length + 1 }), rows: L });
  }
  sub.push({ title: T('pd_rest'), rows: [[T('pd_rest0'), `${polyTex(cAsc, v)}=(${dv})\\cdot(${polyTex(qAsc, v)})`]] });
  const head = `(${polyTex(cAsc, v)}):(${dv})=${polyTex(qAsc, v)}`;
  const tex = '\\begin{array}{l}' + head + '\\\\[6pt]\\begin{array}{' + 'r'.repeat(n + 1) + '}' + rows.slice(1).map(x => x.slice(0, n + 1).join(' & ')).join('\\\\') + '\\end{array}\\end{array}';
  return { tex, qAsc, sub };
}
const QM = ['pq', 'abc', 'binom'];
function sqrtExact(R) {
  const sq = Math.sqrt(R), f = fr(sq);
  if (f && f.d <= 1000 && Math.abs(f.valueOf() - sq) < 1e-12) return { tex: ftex(sq), rat: true, val: sq };
  try { const t = nerdamer(sqrtTex(R)).toString(); return { tex: texN(t), rat: false, val: sq, n: t }; } catch (e) { return { tex: `\\sqrt{${ftex(R)}}`, rat: false, val: sq }; }
}
function texForVal(res, x) { const r = res.real.find(q => Math.abs(q.val - x) < 1e-7 * (1 + Math.abs(x))); return r ? r.tex : ftex(x); }
function pmLines(v, cT, c, sq, res, frac) {
  const rows = [-1, 1].map((sg, i) => {
    const op = sg < 0 ? '-' : '+';
    let mid;
    if (frac) { const num = sq.rat ? ftex(R9(frac.nb + sg * sq.val)) : ''; mid = `\\frac{${frac.nbT}${op}${sq.tex}}{${frac.dT}}` + (sq.rat ? `=\\frac{${num}}{${frac.dT}}` : ''); }
    else mid = `${cT}${op}${sq.tex}`;
    const val = frac ? (frac.nb + sg * sq.val) / frac.d : c + sg * sq.val;
    return `${v}_{${i + 1}}&=${mid}` + (sq.rat ? `=${texForVal(res, val)}` : '');
  });
  return '\\begin{aligned}' + rows.join('\\\\') + '\\end{aligned}';
}
function quadSteps(c, v, steps) {
  c = c.map(R9);
  const [cc, b, a] = c, D = R9(b * b - 4 * a * cc);
  const res = polyRoots(c, v);
  const solT = () => res.real.length === 1 ? `${v}=${res.real[0].tex}` : res.real.map((r, i) => `${v}_{${i + 1}}=${r.tex}`).join(',\\quad ');
  const cxT = () => res.complex.map((z, i) => `${v}_{${i + 1}}=${z.tex}`).join(',\\quad ');
  const perfect = Math.abs(D) < 1e-12;
  const special = cc === 0 || b === 0 || perfect;
  let m = S.quad || 'auto';
  if (m === 'auto') m = special ? 'binom' : (a === 1 ? 'pq' : 'abc');
  const st0 = steps.length, pt = polyTex(c, v);
  if (m === 'binom') {
    if (cc === 0 && b !== 0) {
      steps.push(step(T('s_factor_x'), `${pt}=${v}\\cdot\\left(${polyTex([b, a], v)}\\right)=0`));
      steps.push(step(T('s_nullprod'), `${v}_1=0\\quad\\vee\\quad ${polyTex([b, a], v)}=0\\;\\Rightarrow\\; ${v}_2=${ftex(-b / a)}`));
    } else if (b === 0) {
      const w = R9(-cc / a), rows = [AL(pt, '0', cc ? signed('-', ftex(cc)) : null)];
      if (cc) rows.push(AL(monoTex(a, 2, v, true), ftex(-cc), a !== 1 ? opDiv(ftex(a)) : null));
      if (a !== 1 && cc) rows.push(AL(`${v}^{2}`, ftex(w)));
      steps.push(step(T('s_isolate_sq'), chain(rows)));
      const sq = Math.sqrt(Math.abs(w)), fq = fr(sq), rat = fq && fq.d < 1000 && Math.abs(fq.valueOf() - sq) < 1e-12;
      if (w > 0 && rat) {
        const k = ftex(sq);
        steps.push(step(T('s_binom3'), `${v}^{2}-${parT(ftex(w))}=\\left(${v}-${k}\\right)\\left(${v}+${k}\\right)=0`, '(a-b)(a+b)=a^{2}-b^{2}'));
        steps.push(step(T('s_nullprod'), solT()));
      } else if (w > 0) steps.push(step(T('s_root_pm'), `${v}=\\pm\\sqrt{${ftex(w)}}\\;\\Rightarrow\\; ${solT()}`));
      else if (w === 0) steps.push(step(T('s_root_pm'), `${v}=0`));
      else steps.push(step(T('s_complex'), `${v}^{2}=${ftex(w)}<0\\;\\Rightarrow\\; ${cxT()}`));
    } else if (perfect) {
      const h = b / (2 * a), inner = `${v}${h > 0 ? '+' : '-'}${ftex(Math.abs(h))}`;
      const pre = a === 1 ? '' : (a === -1 ? '-' : ftex(a));
      steps.push(step(T(h > 0 ? 's_binom1' : 's_binom2'), `${pt}=${pre}\\left(${inner}\\right)^{2}=0`, h > 0 ? '(a+b)^{2}=a^{2}+2ab+b^{2}' : '(a-b)^{2}=a^{2}-2ab+b^{2}'));
      steps.push(step(T('s_one'), `${inner}=0\\;\\Rightarrow\\; ${v}=${ftex(-h)}`));
    } else {
      const p = R9(b / a), q = R9(cc / a), h = p / 2, R = R9(h * h - q);
      const rows = [];
      if (a !== 1) rows.push(AL(pt, '0', opDiv(ftex(a))));
      rows.push(AL(polyTex([q, p, 1], v), '0', signed('-', ftex(q))));
      rows.push(AL(polyTex([0, p, 1], v), ftex(-q)));
      rows.push(AL(`${polyTex([0, p, 1], v)}+\\left(${ftex(h)}\\right)^{2}`, `${ftex(-q)}+${ftex(h * h)}`));
      steps.push(step(T('s_complete'), chain(rows), `\\left(\\frac{p}{2}\\right)^{2}=\\left(${ftex(h)}\\right)^{2}=${ftex(h * h)}\\;\\text{${T('s_complete_hint')}}`));
      const inner = `${v}${h > 0 ? '+' : '-'}${ftex(Math.abs(h))}`;
      steps.push(step(T(h > 0 ? 's_binom1' : 's_binom2'), `\\left(${inner}\\right)^{2}=${ftex(R)}`, h > 0 ? '(a+b)^{2}=a^{2}+2ab+b^{2}' : '(a-b)^{2}=a^{2}-2ab+b^{2}'));
      if (R > 0) { const sq = sqrtExact(R); steps.push(step(T('s_root_pm'), `${inner}=\\pm\\sqrt{${ftex(R)}}=\\pm ${sq.tex}`)); steps.push(step(T('s_solve_x'), pmLines(v, ftex(-h), -h, sq, res))); }
      else steps.push(step(T('s_complex'), `\\left(${inner}\\right)^{2}=${ftex(R)}<0\\;\\Rightarrow\\; ${cxT()}`));
    }
  } else if (m === 'pq') {
    const p = R9(b / a), q = R9(cc / a), h = p / 2, R = R9(h * h - q);
    if (a !== 1) steps.push(step(T('s_normalize'), chain([AL(pt, '0', opDiv(ftex(a))), AL(polyTex([q, p, 1], v), '0')])));
    steps.push(step(T('s_pq_read'), `${polyTex([q, p, 1], v)}=0\\qquad p=${ftex(p)},\\; q=${ftex(q)}`));
    steps.push(step(T('s_pq'), `\\begin{aligned}${v}_{1,2}&=-\\frac{p}{2}\\pm\\sqrt{\\left(\\frac{p}{2}\\right)^{2}-q}\\\\&=${ftex(-h)}\\pm\\sqrt{\\left(${ftex(h)}\\right)^{2}${signed('-', ftex(q))}}\\\\&=${ftex(-h)}\\pm\\sqrt{${ftex(R)}}\\end{aligned}`));
    if (R > 1e-12) { const sq = sqrtExact(R); steps.push(step(T('s_two_sol'), (sq.rat ? `\\sqrt{${ftex(R)}}=${sq.tex}\\\\ ` : '') + pmLines(v, ftex(-h), -h, sq, res))); }
    else if (Math.abs(R) <= 1e-12) steps.push(step(T('s_one'), solT()));
    else steps.push(step(T('s_complex'), cxT()));
  } else {
    steps.push(step(T('s_quad_form'), `${pt}=0\\qquad a=${ftex(a)},\\; b=${ftex(b)},\\; c=${ftex(cc)}`));
    steps.push(step(T('s_disc'), `D=b^2-4ac=\\left(${ftex(b)}\\right)^2-4\\cdot ${ftex(a)}\\cdot\\left(${ftex(cc)}\\right)=${ftex(D)}`));
    if (D > 1e-12) { const sq = sqrtExact(D); steps.push(step(T('s_two'), `${v}_{1,2}=\\frac{-b\\pm\\sqrt{D}}{2a}=\\frac{${ftex(-b)}\\pm\\sqrt{${ftex(D)}}}{${ftex(2 * a)}}`)); steps.push(step(T('s_solve_x'), pmLines(v, null, 0, sq, res, { nb: -b, nbT: ftex(-b), d: 2 * a, dT: ftex(2 * a) }))); }
    else if (perfect) steps.push(step(T('s_one'), `${v}=\\frac{-b}{2a}=\\frac{${ftex(-b)}}{${ftex(2 * a)}}=${ftex(-b / (2 * a))}`));
    else steps.push(step(T('s_complex'), `${v}_{1,2}=\\frac{${ftex(-b)}\\pm i\\sqrt{${ftex(-D)}}}{${ftex(2 * a)}}\\\\ \\Rightarrow\\; ${cxT()}`));
  }
  if (steps[st0]) { steps[st0].methods = QM; steps[st0].method = m; }
  return res;
}
function polySteps(c, v, steps) {
  let cur = c.map(R9); const res = polyRoots(c, v);
  let guard = 0;
  while (cur.length > 3 && guard++ < 8) {
    if (cur[0] === 0) {
      let k = 0; while (cur[k] === 0) k++;
      const rest = cur.slice(k), vk = v + (k > 1 ? '^{' + k + '}' : '');
      steps.push(step(T('s_factor_x'), `${polyTex(cur, v)}=${vk}\\cdot\\left(${polyTex(rest, v)}\\right)=0`));
      steps.push(step(T('s_nullprod'), `${vk}=0\\;\\Rightarrow\\; ${v}=0\\quad\\vee\\quad ${polyTex(rest, v)}=0`));
      cur = rest; continue;
    }
    if (cur.length === 5 && cur[1] === 0 && cur[3] === 0) {
      steps.push(step(T('s_subst'), `z=${v}^{2}:\\quad ${polyTex(cur, v)}=0\\;\\Rightarrow\\; ${polyTex([cur[0], cur[2], cur[4]], 'z')}=0`));
      const zr = quadSteps([cur[0], cur[2], cur[4]], 'z', steps);
      const back = zr.real.map(z => z.val > 1e-12 ? `${v}^{2}=${z.tex}\\;\\Rightarrow\\; ${v}=\\pm\\sqrt{${z.tex}}=\\pm ${sqrtExact(z.val).tex}` : Math.abs(z.val) <= 1e-12 ? `${v}^{2}=0\\;\\Rightarrow\\; ${v}=0` : `${v}^{2}=${z.tex}<0\\;\\Rightarrow\\;\\text{${T('no_real')}}`);
      if (zr.complex.length) back.push(`\\text{${T('no_real')}}`);
      const fin = res.real.length ? `\\Rightarrow\\; ${res.real.map((r, i) => `${v}_{${i + 1}}=${r.tex}`).join(',\\; ')}` : '';
      steps.push(step(T('s_resubst'), back.join('\\\\') + (fin ? '\\\\' + fin : '')));
      return res;
    }
    if (!cur.every(Number.isInteger)) break;
    const a0 = cur[0], an = cur[cur.length - 1];
    const divs = n => { n = Math.abs(n); const d = []; for (let i = 1; i <= Math.min(n, 5000); i++) if (n % i === 0) d.push(i); return d; };
    const cands = [];
    for (const p of divs(a0)) for (const q of divs(an)) for (const x of [p / q, -p / q]) if (!cands.some(y => Math.abs(y - x) < 1e-12)) cands.push(x);
    cands.sort((x, y) => Math.abs(x) - Math.abs(y) || y - x);
    const r = cands.find(x => Math.abs(polyEval(cur, x)) < 1e-9);
    if (r === undefined) break;
    const tried = cands.slice(0, cands.indexOf(r) + 1).slice(-4);
    const pv = x => R9(polyEval(cur, x));
    const cl = cands.slice(0, 10).map(ftex).join(',\\;') + (cands.length > 10 ? ',\\;\\dots' : '');
    steps.push(step(T('s_rational'), `p(${v})=${polyTex(cur, v)}\\\\ \\text{${T('cand')}}\\; ${cl}\\\\ ` + tried.map(x => `p(${ftex(x)})=${ftex(pv(x))}${Math.abs(pv(x)) < 1e-9 ? '\\;\\checkmark' : ''}`).join(',\\quad ')));
    const pd = polyLongDiv(cur, r, v);
    steps.push({ title: T('s_polydiv', { d: linTex(r, v) }), tex: pd.tex, sub: pd.sub });
    cur = pd.qAsc.map(R9);
  }
  if (cur.length === 3) quadSteps(cur, v, steps);
  else if (cur.length === 2) steps.push(step(T('s_linear', { v }), `${polyTex(cur, v)}=0\\;\\Rightarrow\\; ${v}=${ftex(-cur[0] / cur[1])}`));
  else if (cur.length > 3) steps.push(step(T('s_numeric_poly'), `${polyTex(cur, v)}=0`));
  const all = res.real.map((r, i) => `${v}_{${i + 1}}=${r.tex}`).concat(res.complex.map(z => `${z.tex}`));
  if (res.real.length) steps.push(step(T('s_all_sol'), res.real.map((r, i) => `${v}_{${i + 1}}=${r.tex}`).join(',\\quad ')));
  return res;
}

/* ---------- Folgen & Reihen ---------- */
const subV = (s, name, val) => s.replace(new RegExp('(^|[^A-Za-z_])' + name + '(?![A-Za-z_\\d])', 'g'), (m, pre) => pre + (/[\d)]\s*$/.test(pre) ? '*' : '') + (/^(\d+(\.\d+)?|[A-Za-z]\w*)$/.test(val) ? val : '(' + val + ')'));
function seqVar(f, given) {
  if (given && /^[A-Za-z]$/.test(given)) return given;
  try { const fs = freeSyms(toM(f, false)); for (const c of ['n', 'k', 'i', 'x']) if (fs.includes(c)) return c; return fs[0] || 'n'; } catch (e) { return 'n'; }
}
function exactAt(f, v, i, fx) {
  try { const r = nerdamer(toN(f), { [v]: String(i) }).toString(); if (niceExact(r) && r.length < 28) return { tex: texN(r), n: r }; } catch (e) { }
  const y = fx(i); return { tex: ftex(y), n: String(y) };
}
const seqTable = (v, idx, tt, name) => `\\begin{array}{c|${'c'.repeat(idx.length)}}${v}&${idx.join('&')}\\\\\\hline ${name}&${tt.join('&')}\\end{array}`;
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t * (1 + Math.abs(a) + Math.abs(b));
function seqLimit(fx) {
  const NS = [[1e6, 4e6], [1e4, 4e4], [300, 1200], [60, 240]];
  const [A, B] = NS.find(([p, q]) => [p, p + 1, q, q + 1].every(i => !isNaN(fx(i)))) || NS[0];
  const y1 = fx(A), y2 = fx(A + 1), y3 = fx(B), y4 = fx(B + 1);
  if ([y1, y2, y3, y4].every(isFinite) && near(y1, y2, 1e-4) && near(y3, y4, 1e-4) && near(y1, y3, 1e-3)) return { kind: 'conv', val: y3 };
  if ((!isFinite(y3) || Math.abs(y3) > 1e8) && Math.sign(y3) === Math.sign(y4) && Math.abs(y3) >= Math.abs(y1)) return { kind: y3 > 0 ? 'inf' : '-inf' };
  return { kind: 'div' };
}
function monoOf(vals) {
  const d = vals.slice(1).map((x, i) => x - vals[i]);
  if (d.every(x => Math.abs(x) < 1e-12)) return 'const';
  if (d.every(x => x > 1e-12)) return 'sinc';
  if (d.every(x => x > -1e-12)) return 'inc';
  if (d.every(x => x < -1e-12)) return 'sdec';
  if (d.every(x => x < 1e-12)) return 'dec';
  return 'none';
}
CMDS.folge = (a) => {
  const f = prep(a[0]), v = seqVar(f, a[3]), fx = compileFn(toM(f, true), v);
  const lo = a[1] ? Math.round(toNum(math.evaluate(toM(prep(a[1]))))) : 1;
  let hi = a[2] ? Math.round(toNum(math.evaluate(toM(prep(a[2]))))) : lo + 9; if (hi - lo > 29) hi = lo + 29; if (hi < lo) hi = lo;
  const steps = [], idx = [], ex = [], vals = [];
  for (let i = lo; i <= hi; i++) { idx.push(i); const e = exactAt(f, v, i, fx); ex.push(e); vals.push(fx(i)); }
  const name = `a_{${v}}`;
  steps.push(step(T('q_terms'), seqTable(v, idx, ex.map(e => e.tex), name)));
  const props = [];
  const dif = vals.slice(1).map((x, i) => R9(x - vals[i]));
  if (dif.length >= 2) {
    const arith = dif.every(x => near(x, dif[0]));
    steps.push(step(T('q_diff'), dif.slice(0, 8).map(ftex).join(',\\;') + (arith ? `\\;\\Rightarrow\\;\\text{${T('q_arith')}},\\; d=${ftex(dif[0])}` : '')));
    if (arith) props.push(T('q_arith') + ' (d = ' + fmtPlain(dif[0]) + ')');
    if (vals.every(x => Math.abs(x) > 1e-12)) {
      const qs = vals.slice(1).map((x, i) => x / vals[i]);
      const geo = qs.every(x => near(x, qs[0]));
      if (geo && !arith) { steps.push(step(T('q_ratio'), qs.slice(0, 6).map(ftex).join(',\\;') + `\\;\\Rightarrow\\;\\text{${T('q_geo')}},\\; q=${ftex(qs[0])}`)); props.push(T('q_geo') + ' (q = ' + fmtPlain(qs[0]) + ')'); }
    }
  }
  // Monotonie
  let dT = null; try { const s1 = nerdamer(`simplify((${subV(toN(f), v, v + '+1')})-(${toN(f)}))`).toString(); const chk = compileFn(fromN(s1), v); if (niceExact(s1) && !/\(-/.test(s1) && [lo + 1, lo + 3].every(i => near(chk(i), fx(i + 1) - fx(i), 1e-8))) dT = texN(s1); } catch (e) { }
  const wide = []; for (let i = lo; i <= lo + 300; i++) wide.push(fx(i));
  const mono = monoOf(wide.filter(isFinite));
  steps.push(step(T('q_mono'), (dT ? `a_{${v}+1}-a_{${v}}=${dT}\\;\\Rightarrow\\; ` : '') + `\\text{${T('q_' + mono)}}`));
  if (mono !== 'none') props.push(T('q_' + mono));
  // Grenzwert
  const L = seqLimit(fx);
  let limTex;
  if (L.kind === 'conv') { let lt = ftex(L.val); try { const r = CMDS.limit([f, v, 'Infinity']); if (r.outTex && !/approx|text|infty/.test(r.outTex)) lt = r.outTex; } catch (e) { } limTex = `\\lim_{${v}\\to\\infty} a_{${v}}=${lt}`; props.push(T('q_conv')); }
  else if (L.kind === 'div') { limTex = `\\text{${T('q_div')}}`; props.push(T('q_div')); }
  else { limTex = `\\lim_{${v}\\to\\infty} a_{${v}}=${L.kind === 'inf' ? '' : '-'}\\infty\\;(\\text{${T('q_divdet')}})`; props.push(T('q_divdet')); }
  steps.push(step(T('q_limit'), limTex));
  if (L.kind === 'conv' && (mono === 'sinc' || mono === 'inc' || mono === 'sdec' || mono === 'dec')) steps.push(step(T('q_bound'), `\\text{${T('q_bound_t')}}`));
  // Partialsumme
  try { const ps = sumLike([f, v, String(lo), String(hi)], true); steps.push(step(T('q_partial'), `s=\\sum_{${v}=${lo}}^{${hi}} a_{${v}}=${ps.outTex}`)); } catch (e) { }
  const outTex = `\\left(a_{${v}}\\right)_{${v}\\ge ${lo}}:\\; ` + ex.slice(0, 5).map(e => e.tex).join(',\\;') + ',\\;\\ldots';
  return { inTex: `a_{${v}}=${K.texOf(a[0])}`, outTex, steps, note: props.join(' · '), plot: null };
};
const fmtPlain = x => String(Number(x.toPrecision(10))).replace('.', S.dec);
CMDS.reihe = (a) => {
  const f = prep(a[0]), v = seqVar(f, a[2]), fx = compileFn(toM(f, true), v);
  const lo = a[1] ? Math.round(toNum(math.evaluate(toM(prep(a[1]))))) : 1;
  const steps = [], inTex = `\\sum_{${v}=${lo}}^{\\infty} ${K.texOf(a[0])}`;
  const idx = [], tt = [], ps = []; let acc = 0;
  for (let i = lo; i < lo + 6; i++) { idx.push(i); tt.push(exactAt(f, v, i, fx).tex); acc += fx(i); ps.push(ftex(R9(acc))); }
  steps.push(step(T('r_terms'), `\\begin{array}{c|cccccc}${v}&${idx.join('&')}\\\\\\hline a_{${v}}&${tt.join('&')}\\\\ s_{${v}}&${ps.join('&')}\\end{array}`));
  const div = (why, tex) => { steps.push(step(why, tex)); return { inTex, outTex: `\\text{${T('q_div')}}`, steps, note: T('r_div') }; };
  const conv = (why, tex, valTex, approx) => {
    steps.push(step(why, tex));
    let out = valTex;
    if (!out) { try { const r = sumLike([f, v, String(lo), 'Infinity'], true); if (!/text/.test(r.outTex)) { out = r.outTex; approx = r.approx; } } catch (e) { } }
    if (!out) { let sm = 0, ok = false; for (let i = lo; i < lo + 2e6; i++) { const t = fx(i); if (!isFinite(t)) { ok = i > lo + 20; break; } sm += t; if (i > lo + 20 && Math.abs(t) < 1e-17 * (1 + Math.abs(sm))) { ok = true; break; } } if (ok) out = '\\approx ' + fmtReal(sm); }
    return { inTex, outTex: out || `\\text{${T('q_conv')}}`, approx: approx != null ? approx : null, steps, note: T('r_conv') };
  };
  // 1) Nullfolgen-Kriterium
  const L = seqLimit(x => fx(x));
  const limT = () => { try { const r = CMDS.limit([f, v, 'Infinity']); if (r.outTex && !/approx|text/.test(r.outTex)) return r.outTex; } catch (e) { } return fmtReal(Number(L.val.toPrecision(6))); };
  if (L.kind !== 'conv' || Math.abs(L.val) > 1e-6) return div(T('r_null'), `\\lim_{${v}\\to\\infty} a_{${v}}${L.kind === 'conv' ? '=' + limT() : ''}\\neq 0\\;\\Rightarrow\\;\\text{${T('q_div')}}`);
  steps.push(step(T('r_null'), `\\lim_{${v}\\to\\infty} a_{${v}}=0\\;\\Rightarrow\\;\\text{${T('r_null_ok')}}`));
  // 2) geometrische Reihe
  const vals = [0, 1, 2, 3, 4, 5].map(i => fx(lo + i));
  if (vals.every(x => Math.abs(x) > 1e-300)) {
    const qs = vals.slice(1).map((x, i) => x / vals[i]);
    if (qs.every(x => near(x, qs[0], 1e-10))) {
      const q = qs[0], a0 = exactAt(f, v, lo, fx);
      if (Math.abs(q) < 1) {
        let vt = null; try { const r = nerdamer(`(${a0.n})/(1-(${math.fraction(q).toFraction()}))`).toString(); if (niceExact(r)) vt = texN(r); } catch (e) { }
        return conv(T('r_geo'), `q=${ftex(q)},\\;|q|<1\\;\\Rightarrow\\; s=\\frac{a_{${lo}}}{1-q}=\\frac{${a0.tex}}{1-${parT(ftex(q))}}${vt ? '=' + vt : ''}`, vt, a0 && vt ? fx(lo) / (1 - q) : null);
      }
      return div(T('r_geo'), `q=${ftex(q)},\\;|q|\\ge 1\\;\\Rightarrow\\;\\text{${T('q_div')}}`);
    }
  }
  // 3) Leibniz
  const sg = [0, 1, 2, 3, 4, 5, 6, 7].map(i => Math.sign(fx(lo + i)));
  if (sg.every((s, i) => i === 0 || s === -sg[i - 1]) && sg[0] !== 0) {
    const abs = []; for (let i = lo; i < lo + 300; i++) abs.push(Math.abs(fx(i)));
    if (monoOf(abs) === 'sdec' || monoOf(abs) === 'dec') return conv(T('r_leibniz'), `\\text{${T('r_leibniz_t')}}\\;\\Rightarrow\\;\\text{${T('q_conv')}}`);
  }
  // 4) Quotientenkriterium
  const qN = N => Math.abs(fx(N + 1) / fx(N));
  const NN = [[5e4, 1e5], [500, 1000], [100, 200], [20, 40]].find(([x, y]) => [x, x + 1, y, y + 1].every(i => isFinite(fx(i)) && fx(i) !== 0)) || [1e4, 1e5];
  const q1 = qN(NN[0]), q2r = qN(NN[1]), q2 = Math.max(0, 2 * q2r - q1);
  if (isFinite(q2) && q2 < 0.999 && q2r <= q1 + 1e-3) return conv(T('r_ratio'), `\\lim_{${v}\\to\\infty}\\left|\\frac{a_{${v}+1}}{a_{${v}}}\\right|${q2 < 0.05 * q1 || q2 < 1e-6 ? '=0' : (() => { const g = fr(q2); return g && g.d <= 20 && Math.abs(g.valueOf() - q2) < 1e-4 ? '=' + fracTex(g) : '\\approx ' + fmtReal(Number(q2.toPrecision(4))); })()}<1\\;\\Rightarrow\\;\\text{${T('q_conv')}}`);
  if (isFinite(q2) && q2 > 1.001) return div(T('r_ratio'), `\\lim_{${v}\\to\\infty}\\left|\\frac{a_{${v}+1}}{a_{${v}}}\\right|\\approx ${fmtReal(Number(q2.toPrecision(6)))}>1\\;\\Rightarrow\\;\\text{${T('q_div')}}`);
  if (isFinite(q2)) steps.push(step(T('r_ratio'), `\\lim\\left|\\frac{a_{${v}+1}}{a_{${v}}}\\right|=1\\;\\Rightarrow\\;\\text{${T('r_noinfo')}}`));
  // 5) Vergleich mit Σ 1/n^p
  const pE = N => Math.log(Math.abs(fx(N)) / Math.abs(fx(2 * N))) / Math.log(2);
  const p1 = pE(1e4), p2 = pE(1e5);
  if (isFinite(p2) && near(p1, p2, 2e-2)) {
    const p = Math.round(p2 * 100) / 100, pt = Math.abs(p - Math.round(p)) < 0.02 ? String(Math.round(p)) : fmtReal(p);
    if (p > 1.02) return conv(T('r_comp'), `|a_{${v}}|\\sim\\frac{c}{${v}^{${pt}}},\\;\\sum\\frac{1}{${v}^{${pt}}}\\;\\text{${T('r_major')}}\\;\\Rightarrow\\;\\text{${T('q_conv')}}`);
    if (p < 1.02 && fx(1e5) > 0) return div(T('r_comp'), `a_{${v}}\\sim\\frac{c}{${v}^{${pt}}},\\;\\sum\\frac{1}{${v}${pt === '1' ? '' : '^{' + pt + '}'}}\\;\\text{${T('r_minor')}}\\;\\Rightarrow\\;\\text{${T('q_div')}}`);
  }
  const r = sumLike([f, v, String(lo), 'Infinity'], true);
  r.inTex = inTex; r.steps = steps.concat(r.steps); return r;
};
CMDS.rekursiv = (a) => {
  const g = applyConsts(applyDefs(a[0], ['a', 'n']));
  const a1 = prep(a[1] || '1');
  let cnt = a[2] ? Math.round(toNum(math.evaluate(toM(prep(a[2]))))) : 10; cnt = Math.max(2, Math.min(cnt, 30));
  const gM = toM(g, true), cg = math.compile(gM), steps = [];
  const usesN = freeSyms(toM(g, false)).includes('n');
  let xN = toNum(math.evaluate(toM(a1, true))), xE = toN(a1);
  const idx = [1], tt = [ftex(xN)], vals = [xN], rows = [];
  let exactOk = true;
  for (let n = 1; n < cnt; n++) {
    const nx = toNum(cg.evaluate({ a: xN, n }));
    let ne = null;
    if (exactOk) { try { const r = nerdamer(toN(g), { a: '(' + xE + ')', n: String(n) }).toString(); if (niceExact(r) && r.length < 18) ne = r; } catch (e) { } }
    if (!ne) exactOk = false;
    const t = ne ? texN(ne) : ftex(R9(nx));
    if (n <= 4) rows.push(`a_{${n + 1}}=${K.texOf(subV(subV(g, 'a', ne || exactOk ? xE : String(Number(xN.toPrecision(10)))), 'n', String(n)))}=${t}`);
    xN = nx; xE = ne || String(nx); idx.push(n + 1); tt.push(t); vals.push(nx);
  }
  const gT = K.texOf(subV(g, 'a', 'aQQ')).replace(/a\s*Q\s*Q|\\mathrm\{aQQ\}|aQQ/g, 'a_{n}');
  steps.push(step(T('k_rule'), `a_{n+1}=${gT},\\quad a_{1}=${K.texOf(a[1] || '1')}`));
  steps.push(step(T('k_calc'), lines(rows)));
  steps.push(step(T('q_terms'), seqTable('n', idx, tt, 'a_{n}')));
  const mono = monoOf(vals); if (mono !== 'none') steps.push(step(T('q_mono'), `\\text{${T('q_' + mono)}}`));
  const props = mono !== 'none' ? [T('q_' + mono)] : [];
  // Grenzwert / Fixpunkt
  let x = vals[vals.length - 1]; const traj = [];
  for (let i = 0; i < 5000 && isFinite(x); i++) { x = toNum(cg.evaluate({ a: x, n: cnt + i })); if (i > 4980) traj.push(x); }
  const conv = traj.length && traj.every(y => near(y, traj[0], 1e-7));
  if (!usesN) {
    let fps = null; try { fps = solveExactN(`(${toN(g)})-(a)`, 'a'); } catch (e) { }
    if (fps && fps.length) steps.push(step(T('k_fix'), `a=${K.texOf(g)}\\;\\Rightarrow\\; a\\in\\left\\{${fps.filter(niceExact).map(texN).join(',\\;')}\\right\\}`));
  }
  if (conv) { steps.push(step(T('q_limit'), `\\lim_{n\\to\\infty} a_{n}\\approx ${fmtReal(traj[0])}`)); props.push(T('q_conv') + ' (≈ ' + fmtPlain(traj[0]) + ')'); }
  else props.push(T('q_div'));
  return { inTex: `a_{n+1}=${gT},\\; a_{1}=${K.texOf(a[1] || '1')}`, outTex: tt.slice(0, 6).join(',\\;') + ',\\;\\ldots', steps, note: props.join(' · ') };
};
CMDS.muster = (a) => {
  const xs = a.map(s => toNum(math.evaluate(toM(prep(s), true))));
  if (xs.length < 3 || xs.some(x => !isFinite(x))) throw new Error(T('m_need3'));
  const steps = [], n = xs.length;
  const F = x => math.fraction(x);
  const tex = xs.map(ftex);
  const nextP = (fn) => [n + 1, n + 2, n + 3].map(i => `a_{${i}}=${ftex(R9(fn(i)))}`).join(',\\;');
  // Differenzen-Schema
  const lv = [xs]; while (lv.length < n && !lv[lv.length - 1].every(x => near(x, lv[lv.length - 1][0]))) { const p = lv[lv.length - 1]; lv.push(p.slice(1).map((x, i) => R9(x - p[i]))); }
  steps.push(step(T('m_diffs'), lines(lv.map((r, i) => `${i ? '\\Delta^{' + i + '}' : 'a_{n}'}:\\; ${r.map(ftex).join(',\\;')}`))));
  const d = xs[1] - xs[0];
  if (lv.length === 2) {
    const fn = i => xs[0] + (i - 1) * d;
    const an = nerdamer(`expand(${F(xs[0]).toFraction()}+(n-1)*(${F(d).toFraction()}))`).toString();
    const sn = nerdamer(`expand(n/2*(2*(${F(xs[0]).toFraction()})+(n-1)*(${F(d).toFraction()})))`).toString();
    steps.push(step(T('q_arith'), `d=${ftex(d)}\\;\\Rightarrow\\; a_{n}=a_{1}+(n-1)\\cdot d=${ftex(xs[0])}+(n-1)\\cdot ${parT(ftex(d))}=${texN(an)}`));
    steps.push(step(T('m_rec'), `a_{n+1}=a_{n}${signed('+', ftex(d))},\\quad a_{1}=${ftex(xs[0])}`));
    steps.push(step(T('m_next'), nextP(fn)));
    steps.push(step(T('q_partial'), `s_{n}=\\frac{n}{2}\\left(2a_{1}+(n-1)d\\right)=${texN(sn)}`));
    return { inTex: tex.join(',\\;') + ',\\;\\ldots', outTex: `a_{n}=${texN(an)}`, steps, note: T('q_arith') + ' (d = ' + fmtPlain(d) + ')' };
  }
  if (xs.every(x => Math.abs(x) > 1e-12)) {
    const qs = xs.slice(1).map((x, i) => x / xs[i]);
    if (qs.every(x => near(x, qs[0], 1e-10))) {
      const q = qs[0], fq = F(q).toFraction(), f0 = F(xs[0]).toFraction();
      const fn = i => xs[0] * Math.pow(q, i - 1);
      steps.push(step(T('m_ratio'), qs.map(ftex).join(',\\;') + `\\;\\Rightarrow\\; q=${ftex(q)}`));
      const anT = `${xs[0] === 1 ? '' : ftex(xs[0]) + '\\cdot '}${parT(ftex(q))}^{n-1}`;
      steps.push(step(T('q_geo'), `a_{n}=a_{1}\\cdot q^{n-1}=${anT}`));
      steps.push(step(T('m_rec'), `a_{n+1}=${parT(ftex(q))}\\cdot a_{n},\\quad a_{1}=${ftex(xs[0])}`));
      steps.push(step(T('m_next'), nextP(fn)));
      if (!near(q, 1)) steps.push(step(T('q_partial'), `s_{n}=a_{1}\\cdot\\frac{q^{n}-1}{q-1}=${xs[0] === 1 ? '' : ftex(xs[0]) + '\\cdot '}${near(q, 2) ? `\\left(${parT(ftex(q))}^{n}-1\\right)` : `\\frac{${parT(ftex(q))}^{n}-1}{${ftex(R9(q - 1))}}`}`));
      return { inTex: tex.join(',\\;') + ',\\;\\ldots', outTex: `a_{n}=${anT}`, steps, note: T('q_geo') + ' (q = ' + fmtPlain(q) + ')' };
    }
  }
  if (lv.length - 1 <= Math.min(4, n - 2)) {
    const deg = lv.length - 1;
    const pts = xs.slice(0, deg + 1).map((y, i) => [i + 1, F(y)]);
    const lag = pts.map(([xi, yi], i) => `(${yi.toFraction()})*${pts.filter((_, j) => j !== i).map(([xj]) => `(n-(${xj}))`).join('*') || 1}/(${pts.filter((_, j) => j !== i).reduce((p, [xj]) => p * (xi - xj), 1)})`).join('+');
    const pn = nerdamer(`expand(${lag})`).toString(), pf = compileFn(fromN(pn), 'n');
    steps.push(step(T('m_poly', { d: deg }), `\\Delta^{${deg}}=${ftex(lv[deg][0])}\\;\\text{${T('m_const')}}\\;\\Rightarrow\\; a_{n}=${texN(pn)}`));
    steps.push(step(T('m_check'), xs.map((x, i) => `a_{${i + 1}}=${ftex(R9(pf(i + 1)))}`).join(',\\;') + '\\;\\checkmark'));
    steps.push(step(T('m_next'), nextP(i => pf(i))));
    return { inTex: tex.join(',\\;') + ',\\;\\ldots', outTex: `a_{n}=${texN(pn)}`, steps, note: T('m_poly', { d: deg }) };
  }
  steps.push(step(T('m_none'), ''));
  return { inTex: tex.join(',\\;') + ',\\;\\ldots', outTex: `\\text{${T('m_none')}}`, steps };
};
CMDS.seq = CMDS.folge; CMDS.series = CMDS.reihe; CMDS.recseq = CMDS.rekursiv; CMDS.pattern = CMDS.muster;

/* ---------- Stetigkeit ---------- */
function pointCont(fx, x0) {
  const s = 1 + Math.abs(x0), hs = [1e-5, 1e-7, 1e-9].map(h => h * s);
  const side = sg => { const v = hs.map(h => fx(x0 + sg * h)); if (v.some(isNaN)) return NaN; const a = v[2], d1 = v[1] - v[0], d2 = v[2] - v[1]; if (!isFinite(a) || (Math.abs(a) > 1e6 && Math.abs(a) > 10 * Math.abs(v[0])) || (Math.abs(d2) > 1e-3 && Math.abs(d2) > 0.5 * Math.abs(d1) && Math.sign(d1) === Math.sign(d2))) return (Math.abs(d2) > 1e-3 ? d2 : a) > 0 ? Infinity : -Infinity; return Math.abs(a) < 1e-10 ? 0 : a; };
  const L = side(-1), R = side(1), y = fx(x0), def = isFinite(y);
  const eq = (a, b) => isFinite(a) && isFinite(b) && Math.abs(a - b) <= 1e-5 * (1 + Math.abs(a));
  let kind;
  if (isNaN(L) && isNaN(R)) kind = 'out';
  else if (isNaN(L) || isNaN(R)) { const o = isNaN(L) ? R : L; kind = !isFinite(o) ? 'edge' : def ? (eq(o, y) ? 'edge' : 'jump') : 'hole'; }
  else if (!isFinite(L) || !isFinite(R)) kind = 'pole';
  else if (eq(L, R)) kind = def ? (eq(L, y) ? 'cont' : 'remov') : 'hole';
  else kind = 'jump';
  return { L, R, y, def, kind };
}
const xTex = x => { if (Math.abs(x) > 1e-9) { const q = fr(x / Math.PI); if (q && q.d <= 12 && Math.abs(q.valueOf() * Math.PI - x) < 1e-7 && Math.abs(x - Math.round(x)) > 1e-7) return texN(`(${q.toFraction()})*pi`); } return ftex(x); };
const shortList = xs => { const near = xs.filter(x => Math.abs(x) <= 10).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b).slice(0, 7).sort((a, b) => a - b); return near.map(xTex).join(';\\,') + (xs.length > near.length ? ';\\,\\dots' : ''); };
const fmtLim = x => isNaN(x) ? '\\text{–}' : !isFinite(x) ? (x > 0 ? '+\\infty' : '-\\infty') : fmtReal(Number(x.toPrecision(10)));
function contCandidates(fM, v, fx, lo, hi) {
  const out = [];
  const add = p => { if (p >= lo && p <= hi && !out.some(q => Math.abs(q - p) < 1e-6)) out.push(Math.abs(p - Math.round(p)) < 1e-7 ? Math.round(p) : p); };
  let node; try { node = math.parse(fM); } catch (e) { return out; }
  node.traverse(n => {
    let g = null;
    if (n.isOperatorNode && n.fn === 'divide') g = n.args[1];
    else if (n.isOperatorNode && n.fn === 'pow') { try { const e = n.args[1].evaluate(); if (typeof e === 'number' && e < 0) g = n.args[0]; } catch (er) { } }
    else if (n.isFunctionNode && ['tan', 'sec'].includes(n.fn.name)) g = new math.FunctionNode('cos', [n.args[0]]);
    else if (n.isFunctionNode && ['cot', 'csc'].includes(n.fn.name)) g = new math.FunctionNode('sin', [n.args[0]]);
    else if (n.isFunctionNode && ['floor', 'ceil', 'round', 'fix'].includes(n.fn.name)) { const a = compileFn(n.args[0].toString(), v); for (let k = Math.ceil(Math.min(a(lo), a(hi))); k <= Math.floor(Math.max(a(lo), a(hi))) && out.length < 60; k++) findRoots(x => a(x) - k, lo, hi, 4000).forEach(add); }
    else if (n.isFunctionNode && ['sign', 'abs'].includes(n.fn.name)) g = n.args[0];
    if (g && hasVar(g, v)) { try { const gf = compileFn(g.toString(), v); findRoots(gf, lo, hi, 8000).forEach(add); } catch (e) { } }
  });
  findPoles(fx, lo, hi).forEach(add);
  return out.sort((a, b) => a - b);
}
CMDS.stetig = (a) => {
  const f = prep(a[0]), v = guessVar(f), fM = toM(f, true), fx = compileFn(fM, v), steps = [];
  const inTex = `${T('c_cmd')}\\;${K.texOf(a[0])}` + (a[1] ? `\\;\\text{${T('c_at')}}\\;${v}_0=${K.texOf(a[1])}` : '');
  const KT = { cont: 'c_cont', remov: 'c_remov', jump: 'c_jump', pole: 'c_pole', hole: 'c_hole', edge: 'c_edge', out: 'c_out' };
  const row = (x0, r) => `${v}_0=${xTex(x0)}:\\;\\lim_{${v}\\to ${v}_0^-}=${fmtLim(r.L)},\\;\\lim_{${v}\\to ${v}_0^+}=${fmtLim(r.R)},\\;f(${v}_0)=${r.def ? fmtLim(r.y) : '\\text{' + T('c_undef') + '}'}`;
  if (a[1]) {
    const x0 = toNum(math.evaluate(toM(prep(a[1]), true))), r = pointCont(fx, x0);
    steps.push(step(T('c_crit'), T('c_def_tex')));
    steps.push(step(T('c_check'), row(x0, r)));
    steps.push(step(T('c_result'), `\\text{${T(KT[r.kind])}}` + (r.kind === 'hole' || r.kind === 'remov' ? `\\;(\\text{${T('c_fill')}}\\;f(${ftex(x0)}):=${fmtLim(r.L)})` : '')));
    const ok = r.kind === 'cont' || r.kind === 'edge';
    return { inTex, outTex: `\\text{${T(ok ? 'c_yes' : 'c_no')}}`, steps, note: T(KT[r.kind]), plot: { fns: [fM], v } };
  }
  const lo = -50, hi = 50, cand = contCandidates(fM, v, fx, lo, hi), bad = [];
  steps.push(step(T('c_crit'), T('c_def_tex')));
  steps.push(step(T('c_cands'), cand.length ? `${v}\\in\\{${shortList(cand)}\\}` : `\\text{${T('c_none_cand')}}`));
  for (const x0 of cand) { const r = pointCont(fx, x0); if (r.kind !== 'cont' && r.kind !== 'edge' && r.kind !== 'out') bad.push([x0, r]); }
  bad.filter(([x]) => Math.abs(x) <= 10).slice(0, 6).forEach(([x0, r]) => steps.push(step(T(KT[r.kind]), row(x0, r))));
  // Definitionsbereich prüfen (z. B. √x, ln x)
  let gaps = 0; for (let x = lo; x <= hi; x += 0.05) if (!isFinite(fx(x)) && !cand.some(c => Math.abs(c - x) < 0.05)) gaps++;
  const realBad = bad.filter(([, r]) => r.kind === 'jump' || r.kind === 'remov');
  const lucken = bad.filter(([, r]) => r.kind === 'pole' || r.kind === 'hole');
  let out;
  if (!bad.length) out = gaps ? `\\text{${T('c_on_D')}}` : `\\text{${T('c_on_R')}}`;
  else if (!realBad.length) out = `\\text{${T('c_on_D')}}\\;D=\\mathbb{R}\\setminus\\{${shortList(lucken.map(([x]) => x))}\\}`;
  else out = `\\text{${T('c_not')}}\\;${v}\\in\\{${shortList(realBad.map(([x]) => x))}\\}`;
  if (bad.length) steps.push(step(T('c_result'), out));
  return { inTex, outTex: out, steps, note: T('c_range'), plot: { fns: [fM], v } };
};
/* ---------- Kurvenintegrale / Bogenlänge ---------- */
const vecItems = s => { s = String(s).trim(); if (s.startsWith('[') && s.endsWith(']')) return splitTop(s.slice(1, -1)); return null; };
function substXYZ(exprM, comps) { // x,y,z → Komponenten von r(t)
  const names = ['x', 'y', 'z'];
  const node = math.parse(exprM).transform(n => n.isSymbolNode && names.indexOf(n.name) >= 0 && names.indexOf(n.name) < comps.length ? new math.ParenthesisNode(math.parse(comps[names.indexOf(n.name)])) : n);
  return node.toString();
}
CMDS.kurvenint = (a) => {
  if (a.length < 5) throw new Error(T('ki_syntax'));
  const t = a[2].trim(), rc = vecItems(a[1]);
  if (!rc || rc.length < 2 || rc.length > 3) throw new Error(T('ki_syntax'));
  const rM = rc.map(c => toM(prep(c), true)), steps = [];
  const dN = rM.map(c => nerdamer(`diff(${toN(K.mjToUser(c))},${t})`).toString());
  const rT = `\\vec r(${t})=\\begin{pmatrix}${rc.map(c => K.texOf(c)).join('\\\\')}\\end{pmatrix}`, dT = `\\vec r\\,'(${t})=\\begin{pmatrix}${dN.map(texN).join('\\\\')}\\end{pmatrix}`;
  const fv = vecItems(a[0]), lo = a[3], hi = a[4];
  steps.push(step(T('ki_param'), `${rT},\\quad ${t}\\in[${K.texOf(lo)};${K.texOf(hi)}]`));
  steps.push(step(T('ki_deriv'), dT));
  let integrand, inTex, kind;
  if (fv) { // Vektorfeld: ∫ F · dr
    if (fv.length !== rc.length) throw new Error(T('ki_dim'));
    kind = 'vec';
    const Fs = fv.map(c => substXYZ(toM(prep(c), true), rM));
    integrand = Fs.map((F, i) => `(${F})*(${fromN(dN[i])})`).join('+');
    inTex = `\\int_C \\vec F\\cdot d\\vec r,\\quad \\vec F=\\begin{pmatrix}${fv.map(c => K.texOf(c)).join('\\\\')}\\end{pmatrix}`;
    steps.push(step(T('ki_vec'), `\\int_C \\vec F\\cdot d\\vec r=\\int_{${K.texOf(lo)}}^{${K.texOf(hi)}}\\vec F(\\vec r(${t}))\\cdot\\vec r\\,'(${t})\\,d${t}`));
  } else { // Skalarfeld: ∫ f ds
    kind = 'sc';
    const sp = nerdamer(`sqrt(${dN.map(d => `(${d})^2`).join('+')})`);
    let speed = sp.toString(); try { const s2 = nerdamer(`simplify(${speed})`).toString(); if (s2.length <= speed.length) speed = s2; } catch (e) { }
    { const sf = compileFn(fromN(speed), t), vs = [0.3, 0.9, 1.7, 2.6].map(sf);
      if (vs.every(x => Math.abs(x - vs[0]) < 1e-10 * (1 + Math.abs(vs[0])))) { const c2 = ratStr(vs[0] * vs[0]); const c1 = ratStr(vs[0]); speed = /[\/]|^\d+$/.test(c1) || Number.isInteger(Number(c1)) ? c1.replace(/^(-?\d+)\/(\d+)$/, '($1/$2)') : `sqrt(${c2})`; } }
    steps.push(step(T('ki_speed'), `|\\vec r\\,'(${t})|=${texN(speed)}`));
    const fS = substXYZ(toM(prep(a[0]), true), rM);
    integrand = `(${fS})*(${fromN(speed)})`;
    inTex = a[0].trim() === '1' ? `L=\\int_C ds` : `\\int_C ${K.texOf(a[0])}\\,ds`;
    steps.push(step(T('ki_sc'), `\\int_C f\\,ds=\\int_{${K.texOf(lo)}}^{${K.texOf(hi)}} f(\\vec r(${t}))\\,|\\vec r\\,'(${t})|\\,d${t}`));
  }
  let iu = K.mjToUser(integrand); try { const sN = nerdamer(`simplify(${toN(iu)})`).toString(); const cand = K.mjToUser(fromN(sN)); const fa = compileFn(toM(iu, true), t), fb = compileFn(toM(cand, true), t); if ([0.3, 1.1, 2.2].every(x => Math.abs(fa(x) - fb(x)) < 1e-7 * (1 + Math.abs(fa(x))))) iu = cand; } catch (e) { }
  steps.push(step(T('ki_int'), `\\int_{${K.texOf(lo)}}^{${K.texOf(hi)}} ${K.texOf(iu)}\\,d${t}`));
  const r = CMDS.integrate([iu, t, lo, hi]);
  steps.push(step(T('ki_res'), r.outTex + (r.approx != null && isFinite(r.approx) && !/approx/.test(r.outTex) ? `\\approx ${fmtReal(r.approx)}` : '')));
  return { inTex, outTex: r.outTex, approx: r.approx, steps };
};
CMDS.bogen = (a) => { // Bogenlänge: bogen([x(t),y(t)],t,a,b) oder bogen(f(x),x,a,b)
  if (vecItems(a[0])) return CMDS.kurvenint(['1', a[0], a[1], a[2], a[3]]);
  const v = (a[1] || 'x').trim(); return CMDS.kurvenint(['1', `[${v},${a[0]}]`, v, a[2], a[3]]);
};
CMDS.lineint = CMDS.kurvenint; CMDS.arclen = CMDS.bogen; CMDS.continuous = CMDS.stetig;

/* =========================================================
   Erweiterungen: Gauß ausführlich, Polarform, Differentialgleichungen
   (wird im Build hinter engine.js eingefügt, nutzt dessen Helfer)
   ========================================================= */

/* ---------- Gauß-Verfahren, ausführlich (Stufenform + Rückwärtseinsetzen) ---------- */
function gaussSchool(rows, vars, steps) {
  const F = x => math.fraction(x), n = vars.length, m = rows.length;
  let M = rows.map(r => r.map(F));
  const ft = x => fracTex(x);
  const eqTex = r => { let s = '', first = true;  r.slice(0, n).forEach((c, j) => { if (c.n === 0) return; const a = c.abs(), one = a.equals(1); s += (c.s < 0 ? '-' : (first ? '' : '+')) + (one ? '' : ft(a)) + vars[j]; first = false; }); return (s || '0') + '=' + ft(r[n]); };
  const sysTex = A => '\\left\\{\\begin{aligned}' + A.map((r, i) => `\\text{(${['I', 'II', 'III', 'IV', 'V', 'VI'][i] || i + 1})}\\quad &${eqTex(r).replace('=', '&=')}`).join('\\\\') + '\\end{aligned}\\right.';
  const mt = () => '\\left(\\begin{array}{' + 'c'.repeat(n) + '|c}' + M.map(r => r.map(ft).join('&')).join('\\\\') + '\\end{array}\\right)';
  const RN = i => ['I', 'II', 'III', 'IV', 'V', 'VI'][i] || String(i + 1);
  steps.push(step(T('g_sys'), sysTex(M), T('g_sys_n')));
  steps.push(step(T('g_aug'), mt(), T('g_aug_n')));
  const allInt = () => M.every(r => r.every(x => x.d === 1));
  const gcdRow = r => { const nz = r.filter(x => x.n !== 0); if (!nz.length || !nz.every(x => x.d === 1)) return null; let g = nz[0].n; nz.forEach(x => { let a = g, b = x.n; while (b) [a, b] = [b, a % b]; g = a; }); return g > 1 ? g : null; };
  let row = 0; const piv = [];
  for (let col = 0; col < n && row < m; col++) {
    let p = row; while (p < m && M[p][col].n === 0) p++;
    if (p === m) continue;
    const sub = [];
    if (p !== row) { [M[p], M[row]] = [M[row], M[p]]; sub.push({ title: T('g_swap'), tex: `\\text{(${RN(row)})}\\leftrightarrow\\text{(${RN(p)})}\\qquad ` + mt() }); }
    const a = M[row][col];
    const ops = [];
    for (let k = row + 1; k < m; k++) {
      const b = M[k][col]; if (b.n === 0) continue;
      let txt, opTex;
      if (allInt()) { // ganzzahlig bleiben: (k) · a − (row) · b
        const A2 = a, B2 = b;
        M[k] = M[k].map((x, j) => x.mul(A2).sub(M[row][j].mul(B2)));
        opTex = `${A2.equals(1) ? '' : (A2.s < 0 ? '(' + ft(A2) + ')' : ft(A2)) + '\\cdot'}\\text{(${RN(k)})}${B2.s < 0 ? '+' : '-'}${B2.abs().equals(1) ? '' : ft(B2.abs()) + '\\cdot'}\\text{(${RN(row)})}`;
        const g = gcdRow(M[k]); if (g) { M[k] = M[k].map(x => x.div(g)); opTex += `\\;\\;\\text{,}\\;:${g}`; }
      } else {
        const f = b.div(a);
        M[k] = M[k].map((x, j) => x.sub(f.mul(M[row][j])));
        opTex = `\\text{(${RN(k)})}${f.s < 0 ? '+' : '-'}${f.abs().equals(1) ? '' : ft(f.abs()) + '\\cdot'}\\text{(${RN(row)})}`;
      }
      ops.push(opTex);
      sub.push({ title: T('g_elim', { r: RN(k), c: vars[col] }), tex: opTex + '\\qquad ' + mt() });
    }
    piv.push([row, col]);
    if (ops.length || sub.length) steps.push({ title: T('g_col', { c: vars[col], p: RN(row) }), tex: (ops.length ? ops.join(',\\;\\;') + '\\\\' : '') + mt(), note: T('g_col_n', { c: vars[col], p: RN(row) }), sub });
    row++;
  }
  // Stufenform als Gleichungen
  steps.push(step(T('g_echelon'), sysTex(M), T('g_echelon_n')));
  const bad = M.find(r => r.slice(0, n).every(x => x.n === 0) && r[n].n !== 0);
  if (bad) { steps.push(step(T('g_contra'), `0=${ft(bad[n])}\\;\\Rightarrow\\;\\mathbb{L}=\\{\\,\\}`, T('g_contra_n'))); return { kind: 'none', out: '\\mathbb{L}=\\{\\,\\}' }; }
  // Rückwärtseinsetzen (mit Parametern für freie Variablen)
  const pivCols = piv.map(p => p[1]), free = vars.map((v, j) => j).filter(j => !pivCols.includes(j));
  const P = free.map((j, i) => free.length === 1 ? 't' : 't_{' + (i + 1) + '}');
  // Wert jeder Variablen: [konstante, Koeff. Param1, Param2, …]
  const val = Array(n).fill(null), zero = () => Array(free.length + 1).fill(F(0));
  free.forEach((j, i) => { const v = zero(); v[i + 1] = F(1); val[j] = v; });
  const affTex = v => { let s = '', first = true; const parts = [[v[0], '']].concat(P.map((p, i) => [v[i + 1], p])); parts.forEach(([c, p]) => { if (c.n === 0) return; const a = c.abs(); s += (c.s < 0 ? '-' : (first ? '' : '+')) + (p && a.equals(1) ? '' : ft(a)) + p; first = false; }); return s || '0'; };
  if (free.length) steps.push(step(T('g_free'), free.map((j, i) => `${vars[j]}=${P[i]}`).join(',\\;') + `\\quad (${P.join(',')}\\in\\mathbb{R})`, T('g_free_n')));
  for (let q = piv.length - 1; q >= 0; q--) {
    const [r, c] = piv[q], R = M[r];
    let acc = zero(); acc[0] = R[n];
    const subs = [];
    for (let j = c + 1; j < n; j++) { if (R[j].n === 0) continue; acc = acc.map((x, i) => x.sub(R[j].mul(val[j][i]))); subs.push(`${R[j].s < 0 ? '-' : '+'}${R[j].abs().equals(1) ? '' : ft(R[j].abs()) + '\\cdot'}${val[j].slice(1).some(x => x.n) || val[j][0].s < 0 ? '\\left(' + affTex(val[j]) + '\\right)' : affTex(val[j])}`); }
    val[c] = acc.map(x => x.div(R[c]));
    const lhs = (R[c].equals(1) ? '' : R[c].equals(-1) ? '-' : ft(R[c])) + vars[c];
    const lines = [`\\text{(${RN(r)})}:\\;${lhs}${subs.join('')}=${ft(R[n])}`];
    if (subs.length) lines.push(`${lhs}=${affTex(acc)}`);
    if (!R[c].equals(1)) lines.push(`${vars[c]}=${affTex(val[c])}`);
    steps.push(step(T('g_back', { v: vars[c] }), '\\begin{aligned}' + lines.map(l => '&' + l).join('\\\\') + '\\end{aligned}'));
  }
  const out = vars.map((v, j) => `${v}=${affTex(val[j])}`).join(',\\quad ');
  // Probe
  if (!free.length) {
    const ok = rows.every(r => { const s = r.slice(0, n).reduce((t, c, j) => t + c * val[j][0].valueOf(), 0); return Math.abs(s - r[n]) < 1e-9 * (1 + Math.abs(r[n])); });
    steps.push(step(T('s_check'), `\\text{${T(ok ? 'g_check_ok' : 'g_check_bad')}}`));
    return { kind: 'unique', out };
  }
  steps.push(step(T('s_solution'), `\\mathbb{L}=\\left\\{\\left(${vars.map((v, j) => affTex(val[j])).join(';\\,')}\\right)\\,\\middle|\\,${P.join(',')}\\in\\mathbb{R}\\right\\}`));
  return { kind: 'inf', out: out + `\\quad(${P.join(',')}\\in\\mathbb{R})` };
}

/* ---------- Komplexe Zahl in Polarform ---------- */
function polarParts(re, im) {
  const r = Math.hypot(re, im), phi = Math.atan2(im, re);
  const rT = (() => { const q = fr(r); if (q && q.d <= 100 && Math.abs(q.valueOf() - r) < 1e-12) return fracTex(q); const q2 = fr(r * r); if (q2 && q2.d <= 100 && Math.abs(q2.valueOf() - r * r) < 1e-10) { try { return texN(nerdamer(`sqrt(${q2.toFraction()})`).toString()); } catch (e) { } } return fmtReal(r); })();
  const pT = (() => { if (Math.abs(phi) < 1e-14) return '0'; const q = fr(phi / Math.PI); if (q && q.d <= 12 && Math.abs(q.valueOf() * Math.PI - phi) < 1e-12) return texN(`(${q.toFraction()})*pi`); return fmtReal(phi); })();
  const deg = phi * 180 / Math.PI, dT = Math.abs(deg - Math.round(deg)) < 1e-9 ? String(Math.round(deg)) : fmtReal(Number(deg.toFixed(6)));
  return { r, phi, rT, pT, dT };
}
CMDS.polarform = (a) => {
  const z = math.evaluate(toM(prep(a[0]), true)), re = typeof z === 'number' ? z : z.re, im = typeof z === 'number' ? 0 : z.im;
  const p = polarParts(re, im), steps = [];
  steps.push(step(T('pf_r'), `r=|z|=\\sqrt{${par(fmtReal(re))}^2+${par(fmtReal(im))}^2}=${p.rT}`));
  steps.push(step(T('pf_phi'), `\\varphi=\\arg z=${p.pT}\\;\\widehat{=}\\;${p.dT}^\\circ`, T('pf_phi_n')));
  steps.push(step(T('pf_forms'), `z=${p.rT}\\left(\\cos ${p.pT}+i\\sin ${p.pT}\\right)=${p.rT}\\,e^{i${p.pT === '0' ? '0' : p.pT}}`));
  return { inTex: K.texOf(a[0]), outTex: `${p.rT}\\,e^{i\\,${p.pT}}`, steps, cpts: [{ re, im, tex: fmtReal(re) + (im ? (im < 0 ? '-' : '+') + fmtReal(Math.abs(im)) + 'i' : '') }] };
};
const par = t => String(t).startsWith('-') ? '(' + t + ')' : t;
K.polarTex = (re, im) => { if (Math.abs(im) < 1e-14) return null; const p = polarParts(re, im); return `${p.rT}\\,e^{i\\,${p.pT}}=${p.rT}\\left(\\cos ${p.pT}+i\\sin ${p.pT}\\right)`; };

/* ---------- Differentialgleichungen ---------- */
// Schreibweise: dgl(y'=k*y) · dgl(y''+y=0) · Anfangswerte: dgl(y'=2y, y(0)=3) · dgl(y''+4y=0, y(0)=1, y'(0)=0)
function dglParse(eqStr) {
  const m = String(eqStr).match(/([A-Za-z])'+/); if (!m) throw new Error(T('d_noderiv'));
  const y = m[1];
  const raw = String(eqStr);
  const rest = raw.replace(new RegExp('(^|[^A-Za-z])' + y + "'*", 'g'), '$1');
  const indep = /\bx\b/.test(rest) ? 'x' : /\bt\b/.test(rest) ? 't' : (y === 'y' ? 'x' : 't');
  const sub = s => s.replace(new RegExp(y + "''\\s*(\\(\\s*" + indep + "\\s*\\))?", 'g'), ' YY2 ').replace(new RegExp(y + "'\\s*(\\(\\s*" + indep + "\\s*\\))?", 'g'), ' YY1 ').replace(new RegExp('(^|[^A-Za-z_])' + y + '(\\(\\s*' + indep + '\\s*\\))?(?![A-Za-z_\\d])', 'g'), '$1 YY0 ');
  const p = splitEq(raw); const [l, r] = p ? p : [raw, '0'];
  const G = `(${sub(l)})-(${sub(r)})`;
  const order = /YY2/.test(G) ? 2 : 1;
  return { y, x: indep, G, order };
}
const nz = s => nerdamer(s).toString();
const eNeg = t => String(t).replace(/\\frac\{([^{}]*)\}\{e\^\{([^{}]*)\}\}/g, (m, a, b) => (a === '1' ? '' : a + '\\cdot ') + 'e^{-' + b + '}');
const cIdx = t => String(t).replace(/C_\{([12])\}/g, 'C_$1').replace(/C([12])(?!\d)/g, 'C_$1');
const sTex = s => { try { return cIdx(eNeg(texN(nz(s)))); } catch (e) { return K.texOf(K.mjToUser(fromN(s))); } };
function nSame(a, b) { // numerischer Vergleich zweier nerdamer-Ausdrücke
  try { const syms = [...new Set([...freeSyms(fromN(a)), ...freeSyms(fromN(b))])];
    for (const k of [0, 1, 2]) { const sc = Object.fromEntries(syms.map((v, i) => [v, 0.37 + 0.53 * i + 0.29 * k])); const x = math.evaluate(fromN(a), sc), y = math.evaluate(fromN(b), sc); const xr = typeof x === 'number' ? x : x.re, yr = typeof y === 'number' ? y : y.re; if (!(Math.abs(xr - yr) <= 1e-8 * (1 + Math.abs(xr)))) return false; }
    return true; } catch (e) { return false; } }
function nSimp(s) { const b = nz(s); try { const a = nerdamer(`simplify(${s})`).toString(); if (a.length <= b.length + 2 && nSame(a, b)) return a; } catch (e) { } try { const e2 = nerdamer(`expand(${s})`).toString(); if (e2.length < b.length && nSame(e2, b)) return e2; } catch (e) { } return b; }
CMDS.dgl = (a) => {
  const P = dglParse(a[0]), { y, x } = P, steps = [];
  const conds = a.slice(1).map(c => { const m = String(c).match(new RegExp('^\\s*' + y + "('*)\\s*\\(([^)]*)\\)\\s*=\\s*(.+)$")); if (!m) throw new Error(T('d_cond')); return { k: m[1].length, x0: m[2], v: m[3] }; });
  const Gp = prep(P.G.replace(/YY2/g, 'Y2_').replace(/YY1/g, 'Y1_').replace(/YY0/g, 'Y0_'));
  const GN = toN(Gp);
  const inTex = K.texOf(String(a[0]).replace(/'/g, 'PRIMEMARK')).replace(/PRIMEMARK/g, "'") + (conds.length ? ',\\quad ' + conds.map(c => `${y}${"'".repeat(c.k)}(${K.texOf(c.x0)})=${K.texOf(c.v)}`).join(',\\;') : '');
  const ev = (s, sc) => { try { const v = math.evaluate(fromN(s), sc); return typeof v === 'number' ? v : v.re; } catch (e) { return NaN; } };
  const params = freeSyms(fromN(GN)).filter(s => !['Y2_', 'Y1_', 'Y0_', x].includes(s));
  const rnd = Object.fromEntries(params.map((p, i) => [p, 1.37 + 0.71 * i]));
  let sol = null; // Lösung in nerdamer-Syntax, mit C1, C2
  if (P.order === 1) {
    // nach y' auflösen: G linear in Y1?
    const c1 = nSimp(`(${GN.replace(/Y1_/g, '1')})-(${GN.replace(/Y1_/g, '0')})`), c0 = nz(GN.replace(/Y1_/g, '0'));
    const Fr = nSimp(`-(${c0})/(${c1})`); // y' = F(x, y)
    steps.push(step(T('d_explicit'), `${y}'=${sTex(Fr.replace(/Y0_/g, y))}`));
    const Fat = (xv, yv) => ev(Fr, { ...rnd, [x]: xv, Y0_: yv });
    const lin = [0.3, 1.1, 2.4].every(xv => Math.abs(Fat(xv, 2) - 2 * Fat(xv, 1) + Fat(xv, 0)) < 1e-8 * (1 + Math.abs(Fat(xv, 1))));
    const sep = [[0.3, 0.7, 1.9, 2.3], [1.2, 0.4, -0.8, 1.6]].every(([x1, y1, x2, y2]) => { const A = Fat(x1, y1) * Fat(x2, y2), B = Fat(x1, y2) * Fat(x2, y1); return isFinite(A) && Math.abs(A - B) < 1e-8 * (1 + Math.abs(A)); });
    let q = null, pp = null; try { q = nSimp(Fr.replace(/Y0_/g, '0')); pp = nSimp(`-((${Fr.replace(/Y0_/g, '1')})-(${q}))`); } catch (e) { }
    const qZero = q !== null && [0.3, 1.1, 2.4].every(xv => Math.abs(ev(q, { ...rnd, [x]: xv })) < 1e-12);
    if (sep && (!lin || qZero || q === null)) {
      // getrennte Veränderliche: y' = g(x)·h(y)
      const x1 = 0.73, gx = nSimp(`(${Fr.replace(/Y0_/g, '(' + (lin ? 1 : 'Y0_') + ')')})`);
      let g, h;
      if (lin) { g = nSimp(`-(${pp})`); h = 'Y0_'; }
      else {
        const pts = [[1, 1], [2, 1], [1, 2], [3, 2], [2, 3]].find(([xx, yy]) => Math.abs(Fat(xx, yy)) > 1e-9) || [1, 1];
        const [x1b, y1b] = pts, F11 = nz(Fr.replace(new RegExp('\\b' + x + '\\b', 'g'), '(' + x1b + ')').replace(/Y0_/g, '(' + y1b + ')'));
        g = nSimp(Fr.replace(/Y0_/g, '(' + y1b + ')')); h = nSimp(`(${Fr.replace(new RegExp('\\b' + x + '\\b', 'g'), '(' + x1b + ')')})/(${F11})`);
      }
      steps.push(step(T('d_sep'), `\\frac{d${y}}{d${x}}=${sTex(g)}\\cdot ${sTex(h.replace(/Y0_/g, y))}\\;\\Rightarrow\\;\\int\\frac{1}{${sTex(h.replace(/Y0_/g, y))}}\\,d${y}=\\int ${sTex(g)}\\,d${x}`, T('d_sep_n')));
      const Hy = nz(`integrate(1/(${h.replace(/Y0_/g, 'yy')}),yy)`), Gx = nz(`integrate(${g},${x})`);
      steps.push(step(T('d_int'), `${sTex(Hy.replace(/yy/g, y))}=${sTex(Gx)}+C`));
      if (lin) { sol = `C1*e^(${Gx})`; steps.push(step(T('d_solve_y'), `\\ln|${y}|=${sTex(Gx)}+C\\;\\Rightarrow\\;${y}=\\pm e^{C}\\cdot e^{${sTex(Gx)}}=C\\,e^{${sTex(Gx)}}`)); }
      else {
        try { const s0 = nerdamer.solve(`${Hy}=${Gx}+C1`, 'yy').toString().replace(/^\[|\]$/g, '').split(',')[0]; if (s0 && !/yy/.test(s0)) { sol = s0; steps.push(step(T('d_solve_y'), `${y}=${sTex(s0)}`)); } } catch (e) { }
        if (!sol) return { inTex, outTex: `${sTex(Hy.replace(/yy/g, y))}=${sTex(Gx)}+C`, steps, note: T('d_implicit') };
      }
    } else if (lin && q !== null) {
      // lineare DGL: y' + p(x) y = q(x)
      steps.push(step(T('d_lin'), `${y}'+${par(sTex(pp))}\\,${y}=${sTex(q)}`, T('d_lin_n')));
      const Px = nz(`integrate(${pp},${x})`);
      steps.push(step(T('d_hom'), `${y}_h=C\\,e^{-\\int p\\,d${x}}=C\\,e^{${sTex(`-(${Px})`)}}`));
      const mu = `e^(${Px})`, inner = nz(`integrate((${q})*${mu},${x})`);
      steps.push(step(T('d_var'), `C(${x})=\\int q\\,e^{\\int p\\,d${x}}\\,d${x}=\\int ${sTex(`(${q})*${mu}`)}\\,d${x}=${sTex(inner)}`, T('d_var_n')));
      sol = nSimp(`e^(-(${Px}))*((${inner})+C1)`);
      steps.push(step(T('d_general'), `${y}=e^{${sTex(`-(${Px})`)}}\\left(${sTex(inner)}+C\\right)`));
    } else throw new Error(T('d_unsupported'));
  } else {
    // 2. Ordnung, linear mit konstanten Koeffizienten: a y'' + b y' + c y = r(x)
    const at = (Y2, Y1, Y0, xv) => ev(GN, { ...rnd, Y2_: Y2, Y1_: Y1, Y0_: Y0, [x]: xv });
    const coef = (k) => nSimp(`(${GN.replace(/Y2_/g, k === 2 ? '1' : '0').replace(/Y1_/g, k === 1 ? '1' : '0').replace(/Y0_/g, k === 0 ? '1' : '0')})-(${GN.replace(/Y[012]_/g, '0')})`);
    const A = coef(2), Bc = coef(1), Cc = coef(0), R = nSimp(`-(${GN.replace(/Y[012]_/g, '0')})`);
    const constIn = s => [0.3, 1.7].every(xv => Math.abs(ev(s, { ...rnd, [x]: xv }) - ev(s, { ...rnd, [x]: 2.9 })) < 1e-10);
    const linChk = [0.4, 1.3].every(xv => Math.abs(at(2, 3, 4, xv) - at(0, 0, 0, xv) - (2 * ev(A, { ...rnd, [x]: xv }) + 3 * ev(Bc, { ...rnd, [x]: xv }) + 4 * ev(Cc, { ...rnd, [x]: xv }))) < 1e-8);
    if (!linChk || ![A, Bc, Cc].every(constIn) || params.length) throw new Error(T('d_unsupported'));
    const a2 = ev(A, {}), b2 = ev(Bc, {}), c2 = ev(Cc, {});
    steps.push(step(T('d_lin2'), `${ftex(a2) === '1' ? '' : ftex(a2)}${y}''${b2 ? signed('+', ftex(b2)) + y + "'" : ''}${c2 ? signed('+', ftex(c2)) + y : ''}=${sTex(R)}`, T('d_lin2_n')));
    const roots = polyRoots([c2, b2, a2], 'λ');
    steps.push(step(T('d_char'), `${polyTex([c2, b2, a2], '\\lambda')}=0\\;\\Rightarrow\\;` + (roots.real.length ? roots.real.map((r0, i) => `\\lambda_{${i + 1}}=${r0.tex}`).join(',\\;') : roots.complex.map((z, i) => `\\lambda_{${i + 1}}=${z.tex}`).join(',\\;'))));
    let yh, yhT, basis;
    const nS = v => { const f0 = fr(v); return f0 && f0.d <= 1000 && Math.abs(f0.valueOf() - v) < 1e-12 ? f0.toFraction() : null; };
    const D = b2 * b2 - 4 * a2 * c2;
    if (D > 1e-12) {
      const [l1, l2] = roots.real.map(r0 => nS(r0.val) || `(${nerdamer(`(${-b2}-sqrt(${D}))/(${2 * a2})`).toString()})`);
      const L1 = nS(roots.real[0].val) || nz(`(${-b2}-sqrt(${D}))/(${2 * a2})`), L2 = nS(roots.real[1].val) || nz(`(${-b2}+sqrt(${D}))/(${2 * a2})`);
      basis = [`e^((${L1})*${x})`, `e^((${L2})*${x})`]; yhT = T('d_case_real');
    } else if (Math.abs(D) <= 1e-12) {
      const L = nS(-b2 / (2 * a2)); basis = [`e^((${L})*${x})`, `${x}*e^((${L})*${x})`]; yhT = T('d_case_double');
    } else {
      const al = nS(-b2 / (2 * a2)) || String(-b2 / (2 * a2)), be = (() => { const v = Math.sqrt(-D) / (2 * Math.abs(a2)); return nS(v) || nz(`sqrt(${-D})/(${2 * Math.abs(a2)})`); })();
      const ex = al === '0' ? '' : `e^((${al})*${x})*`;
      basis = [`${ex}cos((${be})*${x})`, `${ex}sin((${be})*${x})`]; yhT = T('d_case_cx');
    }
    yh = `C1*${basis[0]}+C2*${basis[1]}`;
    steps.push(step(T('d_hom'), `${y}_h=${sTex(yh)}`, yhT));
    sol = yh;
    const Rzero = [0.3, 1.1, 2.4].every(xv => Math.abs(ev(R, { [x]: xv })) < 1e-12);
    if (!Rzero) {
      // Ansatz vom Typ der rechten Seite (unbestimmte Koeffizienten)
      const ms = new Set(['0']), ws = new Set();
      try { math.parse(fromN(R)).traverse(nd => { if (nd.isFunctionNode && ['exp', 'sin', 'cos'].includes(nd.fn.name)) { const k = math.derivative(nd.args[0], x).evaluate(); if (typeof k === 'number' && isFinite(k)) (nd.fn.name === 'exp' ? ms : ws).add(String(k)); } if (nd.isOperatorNode && nd.fn === 'pow' && nd.args[0].isSymbolNode && nd.args[0].name === 'e') { const k = math.derivative(nd.args[1], x).evaluate(); if (typeof k === 'number') ms.add(String(k)); } }); } catch (e) { }
      const cand = [];
      for (const mm of ms) for (let k = 0; k <= 4; k++) cand.push([k, `${x}^${k}*e^((${mm})*${x})`]);
      for (const w of ws) for (let k = 0; k <= 2; k++) { cand.push([k, `${x}^${k}*cos((${w})*${x})`]); cand.push([k, `${x}^${k}*sin((${w})*${x})`]); }
      const Lop = f => nz(`(${a2})*diff(${f},${x},2)+(${b2})*diff(${f},${x})+(${c2})*(${f})`);
      const xs = [-1.3, -0.7, -0.2, 0.15, 0.4, 0.75, 1.1, 1.45, 1.8, 2.2, 2.6, -1.9, 0.95, 1.6];
      const rhs = xs.map(xv => ev(R, { [x]: xv }));
      const all = cand.map(([k, f]) => { const col = xs.map(xv => ev(Lop(f), { [x]: xv })); return { k, f, col }; }).filter(o => o.col.every(isFinite) && o.col.some(v => Math.abs(v) > 1e-9));
      let yp = null;
      for (let K = 0; K <= 4 && yp === null; K++) {
        const use = all.filter(o => o.k <= K), nU = use.length; if (!nU) continue;
        const AtA = use.map(a => use.map(b => xs.reduce((s2, _, q) => s2 + a.col[q] * b.col[q], 0))), Atb = use.map(a => xs.reduce((s2, _, q) => s2 + a.col[q] * rhs[q], 0));
        let co; try { co = math.lusolve(AtA, Atb).map(r0 => r0[0]); } catch (e) { continue; }
        if (!co.every(isFinite)) continue;
        const cr = co.map(c => { const q = nS(c); return q ? math.fraction(q).valueOf() : c; });
        const fits = xs.every((xv, q) => Math.abs(cr.reduce((s2, c, i2) => s2 + c * use[i2].col[q], 0) - rhs[q]) < 1e-7 * (1 + Math.abs(rhs[q])));
        if (fits) { const terms = cr.map((c, i2) => [c, use[i2].f]).filter(([c]) => Math.abs(c) > 1e-10).map(([c, f]) => `(${nS(c) || c})*${f}`); yp = terms.length ? nSimp(terms.join('+')) : '0'; }
      }
      if (yp === null) throw new Error(T('d_unsupported'));
      steps.push(step(T('d_part'), `${y}_p=${sTex(yp)}`, T('d_part_n')));
      sol = `${yh}+${yp}`;
      steps.push(step(T('d_general'), `${y}=${y}_h+${y}_p=${sTex(sol)}`));
    }
  }
  // Anfangswerte
  let outSol = sol;
  if (conds.length) {
    const eqs = conds.map(c => { const d = c.k ? nz(`diff(${sol},${x},${c.k})`) : sol; return `${nz(d.replace(new RegExp('\\b' + x + '\\b', 'g'), '(' + toN(prep(c.x0)) + ')'))}=${toN(prep(c.v))}`; });
    const cs = ['C1', 'C2'].filter(cn => new RegExp('\\b' + cn + '\\b').test(sol)).slice(0, conds.length);
    let res;
    try { res = cs.length === 1 ? [[cs[0], nerdamer.solve(eqs[0], cs[0]).toString().replace(/^\[|\]$/g, '').split(',')[0]]] : nerdamer.solveEquations(eqs.slice(), cs); } catch (e) { res = null; }
    if (!res || !res.length) throw new Error(T('d_awp_fail'));
    steps.push(step(T('d_awp'), eqs.map(e => sTex(e.split('=')[0]) + '=' + sTex(e.split('=')[1])).join(',\\quad ') + '\\;\\Rightarrow\\;' + res.map(([k, v]) => `${k.replace(/(\d)/, '_$1')}=${sTex(String(v))}`).join(',\\;')));
    res.forEach(([k, v]) => { outSol = outSol.replace(new RegExp('\\b' + k + '\\b', 'g'), '(' + v + ')'); });
    outSol = nSimp(outSol);
  }
  try { const ex = nerdamer(`expand(${outSol})`).toString(); if (ex.length <= nz(outSol).length + 6 && nSame(ex, nz(outSol))) outSol = ex; } catch (e) { }
  const outTex = `${y}(${x})=${sTex(outSol).replace(/C_\{([12])\}/g, 'C_$1').replace(/C([12])(?!\d)/g, 'C_$1')}`;
  const r = { inTex, outTex, steps, note: conds.length ? null : T('d_const') };
  if (conds.length) { try { const fM = fromN(outSol).replace(new RegExp('\\b' + x + '\\b', 'g'), 'x'); compileFn(fM, 'x')(0.5); r.plot = { fns: [fM], v: 'x' }; r.anFns = [K.mjToUser(fM)]; } catch (e) { } }
  return r;
};
CMDS.ode = CMDS.dgl;

/* ---------- Parameterkurven, Polarkurven, 3D-Flächen ---------- */
const numArg = (s, d) => s === undefined || String(s).trim() === '' ? d : toNum(math.evaluate(toM(prep(s), true)));
CMDS.param = (a) => {
  const rc = vecItems(a[0]); if (!rc || rc.length !== 2) throw new Error(T('pc_syntax'));
  const t = (a[1] || 't').trim(), t0 = numArg(a[2], 0), t1 = numArg(a[3], 2 * Math.PI);
  const xM = toM(prep(rc[0]), true), yM = toM(prep(rc[1]), true);
  const steps = [step(T('pc_def'), `\\vec r(${t})=\\begin{pmatrix}${K.texOf(rc[0])}\\\\${K.texOf(rc[1])}\\end{pmatrix},\\quad ${t}\\in[${K.texOf(a[2] || '0')};\\,${K.texOf(a[3] || '2pi')}]`)];
  return { inTex: `\\vec r(${t})=\\begin{pmatrix}${K.texOf(rc[0])}\\\\${K.texOf(rc[1])}\\end{pmatrix}`, outTex: `\\text{${T('pc_curve')}}`, steps, curves: [{ xM, yM, t, t0, t1, label: 'r' }] };
};
CMDS.polar = (a) => {
  const v = (a[1] || '').trim() || (/\bt\b/.test(a[0]) ? 't' : /phi|φ/.test(a[0]) ? (/φ/.test(a[0]) ? 'φ' : 'phi') : 'x');
  const t0 = numArg(a[2], 0), t1 = numArg(a[3], 2 * Math.PI);
  const rM = toM(prep(String(a[0]).replace(/φ/g, 'phi')), true), vv = v === 'φ' ? 'phi' : v;
  const xM = `(${rM})*cos(${vv})`, yM = `(${rM})*sin(${vv})`, vt = v === 'phi' || v === 'φ' ? '\\varphi' : v;
  const steps = [step(T('po_def'), `r(${vt})=${K.texOf(String(a[0]).replace(/φ/g, 'phi')).replace(/\\mathrm\{phi\}|phi/g, '\\varphi')}`), step(T('po_conv'), `x=r(${vt})\\cos ${vt},\\qquad y=r(${vt})\\sin ${vt}`)];
  return { inTex: `r(${vt})=${K.texOf(String(a[0]).replace(/φ/g, 'phi')).replace(/\\mathrm\{phi\}|phi/g, '\\varphi')}`, outTex: `\\text{${T('po_curve')}}`, steps, curves: [{ xM, yM, t: vv, t0, t1, label: 'r' }] };
};
CMDS.plot3d = (a) => {
  const fM = toM(prep(a[0]), true), R = numArg(a[1], 5);
  return { inTex: `z=${K.texOf(a[0])}`, outTex: `\\text{${T('s3_surface')}}`, steps: [], surf: { fM, R } };
};
CMDS.kurve = CMDS.param; CMDS.parametric = CMDS.param; CMDS.surface = CMDS.plot3d; CMDS.flaeche = CMDS.plot3d;

/* ---------- Mehrfachintegrale ---------- */
// int2(f, x, a, b, y, c, d) = ∫_{x=a}^{b} ∫_{y=c}^{d} f dy dx   (c, d dürfen von x abhängen)
// int3(f, x, a, b, y, c, d, z, e, g)
function innerInt(fN, v, lo, hi) { // symbolisch: ∫_lo^hi f dv  → nerdamer-String oder null
  try {
    const F = nerdamer(`integrate(${fN},${v})`).toString();
    if (/integrate/.test(F)) return null;
    const sub = b => nerdamer(F, { [v]: b }).toString();
    const r = nSimp(`(${sub(toN(prep(hi)))})-(${sub(toN(prep(lo)))})`);
    return { F, r };
  } catch (e) { return null; }
}
function multiInt(a, dims) {
  const f = a[0], specs = [];
  for (let k = 0; k < dims; k++) specs.push({ v: a[1 + 3 * k].trim(), lo: a[2 + 3 * k], hi: a[3 + 3 * k] });
  if (specs.some(s => !s.v || s.lo === undefined || s.hi === undefined)) throw new Error(T(dims === 2 ? 'mi_syntax2' : 'mi_syntax3'));
  const steps = [], ints = specs.map(s => `\\int_{${K.texOf(s.lo)}}^{${K.texOf(s.hi)}}`).join(''), ds = specs.slice().reverse().map(s => 'd' + s.v).join('\\,');
  const inTex = `${ints} ${K.texOf(f)}\\,${ds}`;
  steps.push(step(T('mi_order'), `${ints}\\, ${K.texOf(f)}\\;${ds}`, T('mi_order_n')));
  let cur = toN(prep(f));
  for (let k = dims - 1; k >= 0; k--) {
    const s = specs[k];
    if (k === 0) break;
    const r = innerInt(cur, s.v, s.lo, s.hi);
    if (!r) { cur = null; break; }
    steps.push(step(T('mi_inner', { v: s.v }), `\\int_{${K.texOf(s.lo)}}^{${K.texOf(s.hi)}} ${sTex(cur)}\\,d${s.v}=\\Big[${sTex(r.F)}\\Big]_{${s.v}=${K.texOf(s.lo)}}^{${K.texOf(s.hi)}}=${sTex(r.r)}`));
    cur = r.r;
  }
  if (cur !== null) {
    const s = specs[0], ru = K.mjToUser(fromN(cur));
    const res = CMDS.integrate([ru, s.v, s.lo, s.hi]);
    steps.push(step(T('mi_outer', { v: s.v }), `\\int_{${K.texOf(s.lo)}}^{${K.texOf(s.hi)}} ${sTex(cur)}\\,d${s.v}=${res.outTex}`));
    return { inTex, outTex: res.outTex, approx: res.approx, steps };
  }
  // numerisch (geschachtelte Simpson-Regel)
  const vars = specs.map(s => s.v), fM = toM(prep(f), true), fc = math.compile(fM);
  const bnd = specs.map(s => [math.compile(toM(prep(s.lo), true)), math.compile(toM(prep(s.hi), true))]);
  const rec = (k, scope) => {
    const lo = toNum(bnd[k][0].evaluate(scope)), hi = toNum(bnd[k][1].evaluate(scope)), n = dims === 3 ? 40 : 120;
    const g = t => { const sc = { ...scope, [vars[k]]: t }; return k === dims - 1 ? toNum(fc.evaluate(sc)) : rec(k + 1, sc); };
    const h = (hi - lo) / n; let s0 = g(lo) + g(hi);
    for (let i = 1; i < n; i++) s0 += (i % 2 ? 4 : 2) * g(lo + i * h);
    return s0 * h / 3;
  };
  const val = rec(0, {});
  steps.push(step(T('mi_num'), `\\approx ${fmtReal(val)}`));
  return { inTex, outTex: '\\approx ' + fmtReal(val), steps };
}
CMDS.int2 = a => multiInt(a, 2);
CMDS.int3 = a => multiInt(a, 3);
CMDS.iint = CMDS.int2; CMDS.iiint = CMDS.int3;

/* ---------- Vektoranalysis: grad, div, rot ---------- */
function vaVars(exprs) {
  const fs = new Set(); exprs.forEach(e => freeSyms(toM(prep(e), false)).forEach(s => fs.add(s)));
  return fs.has('z') || exprs.length === 3 ? ['x', 'y', 'z'] : ['x', 'y'];
}
const dN = (e, v) => nSimp(nz(`diff(${toN(prep(e))},${v})`));
const vecTex = arr => `\\begin{pmatrix}${arr.join('\\\\')}\\end{pmatrix}`;
function atPoint(exprsN, vars, pt) {
  if (!pt) return null;
  const p = vecItems(pt); if (!p || p.length !== vars.length) return null;
  const sc = Object.fromEntries(vars.map((v, i) => [v, toN(prep(p[i]))]));
  return { tex: '(' + p.map(x => K.texOf(x)).join('|') + ')', vals: exprsN.map(e => nSimp(nerdamer(e, sc).toString())) };
}
CMDS.grad = (a) => {
  const vars = vaVars([a[0]]), steps = [];
  const parts = vars.map(v => dN(a[0], v));
  vars.forEach((v, i) => steps.push(step(T('va_partial', { v }), `\\frac{\\partial f}{\\partial ${v}}=${sTex(parts[i])}`)));
  let out = `\\nabla f=${vecTex(parts.map(sTex))}`;
  const ap = atPoint(parts, vars, a[1]);
  if (ap) { steps.push(step(T('va_at'), `\\nabla f${ap.tex}=${vecTex(ap.vals.map(sTex))}`)); out = `\\nabla f${ap.tex}=${vecTex(ap.vals.map(sTex))}`; }
  return { inTex: `\\operatorname{grad}\\,${K.texOf(a[0])}`, outTex: out, steps };
};
CMDS.div = (a) => {
  const F = vecItems(a[0]); if (!F) throw new Error(T('va_vec'));
  const vars = vaVars(F).slice(0, F.length), steps = [];
  const parts = F.map((c, i) => dN(c, vars[i]));
  steps.push(step(T('va_divdef'), `\\operatorname{div}\\vec F=` + vars.map((v, i) => `\\frac{\\partial F_${i + 1}}{\\partial ${v}}`).join('+')));
  vars.forEach((v, i) => steps.push(step(T('va_partial', { v }), `\\frac{\\partial}{\\partial ${v}}\\left(${K.texOf(F[i])}\\right)=${sTex(parts[i])}`)));
  const sum = nSimp(parts.map(p => `(${p})`).join('+'));
  let out = `\\operatorname{div}\\vec F=${sTex(sum)}`;
  const ap = atPoint([sum], vars, a[1]); if (ap) out = `\\operatorname{div}\\vec F${ap.tex}=${sTex(ap.vals[0])}`;
  return { inTex: `\\operatorname{div}${vecTex(F.map(c => K.texOf(c)))}`, outTex: out, steps };
};
CMDS.rot = (a) => {
  let F = vecItems(a[0]); if (!F) throw new Error(T('va_vec'));
  const two = F.length === 2; if (two) F = [F[0], F[1], '0'];
  const d = (i, v) => dN(F[i], v), steps = [];
  const c = [nSimp(`(${d(2, 'y')})-(${d(1, 'z')})`), nSimp(`(${d(0, 'z')})-(${d(2, 'x')})`), nSimp(`(${d(1, 'x')})-(${d(0, 'y')})`)];
  steps.push(step(T('va_rotdef'), `\\operatorname{rot}\\vec F=\\begin{pmatrix}\\partial_y F_3-\\partial_z F_2\\\\ \\partial_z F_1-\\partial_x F_3\\\\ \\partial_x F_2-\\partial_y F_1\\end{pmatrix}`));
  steps.push(step(T('va_comp'), vecTex([`${sTex(d(2, 'y'))}-${par(sTex(d(1, 'z')))}`, `${sTex(d(0, 'z'))}-${par(sTex(d(2, 'x')))}`, `${sTex(d(1, 'x'))}-${par(sTex(d(0, 'y')))}`])));
  let out = two ? `\\operatorname{rot}\\vec F=${sTex(c[2])}` : `\\operatorname{rot}\\vec F=${vecTex(c.map(sTex))}`;
  const ap = atPoint(two ? [c[2]] : c, two ? ['x', 'y'] : ['x', 'y', 'z'], a[1]);
  if (ap) out = `\\operatorname{rot}\\vec F${ap.tex}=` + (two ? sTex(ap.vals[0]) : vecTex(ap.vals.map(sTex)));
  if (c.every(x => x === '0')) steps.push(step(T('va_conservative'), `\\text{${T('va_conservative_n')}}`));
  return { inTex: `\\operatorname{rot}${vecTex(F.slice(0, two ? 2 : 3).map(x => K.texOf(x)))}`, outTex: out, steps };
};
CMDS.laplace = (a) => {
  const vars = vaVars([a[0]]), parts = vars.map(v => nSimp(nz(`diff(${toN(prep(a[0]))},${v},2)`))), sum = nSimp(parts.map(p => `(${p})`).join('+'));
  return { inTex: `\\Delta\\,${K.texOf(a[0])}`, outTex: `\\Delta f=${sTex(sum)}`, steps: vars.map((v, i) => step(T('va_partial2', { v }), `\\frac{\\partial^2 f}{\\partial ${v}^2}=${sTex(parts[i])}`)) };
};
CMDS.curl = CMDS.rot; CMDS.gradient = CMDS.grad; CMDS.divergence = CMDS.div;

/* ---------- Extrema von f(x, y) ---------- */
const gfmtE = v => fmtReal(Number(Number(v).toPrecision(6)));
CMDS.extrema = a => CMDS.extrema2(a);
function crit2(fM, R = 5) {
  const c = math.compile(fM), f = (x, y) => { try { return toNum(c.evaluate({ x, y })); } catch (e) { return NaN; } };
  const h = 1e-4, out = [];
  const gr = (x, y) => [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
  const he = (x, y) => [(f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / (h * h), (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h), (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / (h * h)];
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    let x = -R + 2 * R * i / 8 + 0.013, y = -R + 2 * R * j / 8 - 0.017, ok = false;
    for (let k = 0; k < 40; k++) {
      const [gx, gy] = gr(x, y), [a, b, d] = he(x, y), det = a * d - b * b;
      if (![gx, gy, a, b, d].every(isFinite) || Math.abs(det) < 1e-12) break;
      const dx = (d * gx - b * gy) / det, dy = (a * gy - b * gx) / det; x -= dx; y -= dy;
      if (Math.abs(x) > 1.5 * R || Math.abs(y) > 1.5 * R) break;
      if (Math.hypot(dx, dy) < 1e-10) { ok = true; break; }
    }
    if (!ok || Math.abs(x) > R || Math.abs(y) > R) continue;
    const [gx, gy] = gr(x, y); if (Math.hypot(gx, gy) > 1e-5) continue;
    const r = v => Math.abs(v - Math.round(v * 1e6) / 1e6) < 1e-7 ? Math.round(v * 1e6) / 1e6 : v;
    x = r(x); y = r(y);
    if (out.some(p => Math.hypot(p.x - x, p.y - y) < 1e-4)) continue;
    const [a, b, d] = he(x, y), det = a * d - b * b;
    const kind = det > 1e-8 ? (a > 0 ? 'min' : 'max') : det < -1e-8 ? 'saddle' : 'flat';
    out.push({ x, y, z: r(f(x, y)), kind, fxx: a, det });
    if (out.length > 30) break;
  }
  return out.sort((p, q) => p.x - q.x || p.y - q.y);
}
K.crit2 = crit2;
CMDS.extrema2 = (a) => {
  const fM = toM(prep(a[0]), true), R = a[1] ? toNum(math.evaluate(toM(prep(a[1]), true))) : 5, pts = crit2(fM, R), steps = [];
  steps.push(step(T('e2_cond'), `f_x=${sTex(dN(a[0], 'x'))}=0,\\quad f_y=${sTex(dN(a[0], 'y'))}=0`));
  steps.push(step(T('e2_hess'), `D=f_{xx}f_{yy}-f_{xy}^2:\\quad D>0,\\,f_{xx}<0\\Rightarrow\\text{Max};\\; D>0,\\,f_{xx}>0\\Rightarrow\\text{Min};\\; D<0\\Rightarrow\\text{${T('e2_saddle')}}`));
  const lab = { max: 'H', min: 'T', saddle: 'S', flat: '?' };
  pts.forEach(p => steps.push(step(T('e2_' + p.kind), `${lab[p.kind]}(${gfmtE(p.x)}\\,|\\,${gfmtE(p.y)}\\,|\\,${gfmtE(p.z)}),\\quad D\\approx ${gfmtE(Number(p.det.toPrecision(4)))}`)));
  return { inTex: `\\text{${T('e2_cmd')}}\\;${K.texOf(a[0])}`, outTex: pts.length ? pts.map(p => `${lab[p.kind]}(${gfmtE(p.x)}|${gfmtE(p.y)}|${gfmtE(p.z)})`).join(',\\;') : `\\text{${T('e2_none')}}`, steps, surf: { fM, R } };
};

/* ---------- Regression ---------- */
const polyDec = (c, v) => { let out = '', first = true; for (let k = c.length - 1; k >= 0; k--) { const a = c[k]; if (!a) continue; const abs = Math.abs(a), num = fmtReal(abs), coef = (abs === 1 && k > 0) ? '' : num; out += (a < 0 ? '-' : first ? '' : '+') + coef + (k > 0 ? v + (k > 1 ? '^{' + k + '}' : '') : ''); first = false; } return out || '0'; };
function regData(a) {
  let X, Y;
  if (a.length >= 2 && vecItems(a[0]) && vecItems(a[1]) && !vecItems(vecItems(a[0])[0])) { X = vecItems(a[0]).map(s => toNum(math.evaluate(toM(prep(s), true)))); Y = vecItems(a[1]).map(s => toNum(math.evaluate(toM(prep(s), true)))); }
  else { const M = arr(matEval(a[0])).map(r => (Array.isArray(r) ? r : [r]).map(v => Number(v.valueOf ? v.valueOf() : v))); X = M.map(r => r[0]); Y = M.map(r => r[1]); }
  if (X.length !== Y.length || X.length < 3 || ![...X, ...Y].every(isFinite)) throw new Error(T('rg_data'));
  return { X, Y };
}
function linFit(X, Y) { const n = X.length, mx = X.reduce((s, v) => s + v, 0) / n, my = Y.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0; X.forEach((x, i) => { sxy += (x - mx) * (Y[i] - my); sxx += (x - mx) ** 2; }); const b = sxy / sxx; return { a: my - b * mx, b, mx, my, sxy, sxx }; }
function r2(Y, P) { const n = Y.length, my = Y.reduce((s, v) => s + v, 0) / n; let ss = 0, st = 0; Y.forEach((y, i) => { ss += (y - P[i]) ** 2; st += (y - my) ** 2; }); return st === 0 ? 1 : 1 - ss / st; }
const n4 = v => Number(Number(v).toPrecision(5));
const n8 = v => { const r = Number(Number(v).toPrecision(8)); return Math.abs(r) < 1e-12 ? 0 : r; };
function regModel(kind, X, Y) {
  const ok = { exp: Y.every(y => y > 0), log: X.every(x => x > 0), pow: X.every(x => x > 0) && Y.every(y => y > 0) };
  if (ok[kind] === false) return null;
  if (kind === 'lin') { const L = linFit(X, Y); return { kind, p: [L.a, L.b], f: x => L.a + L.b * x, fM: `${n8(L.a)}+(${n8(L.b)})*x`, tex: 'y=' + polyDec([Math.abs(L.a) < 1e-12 ? 0 : n4(L.a), n4(L.b)], 'x'), L }; }
  if (kind === 'quad') {
    const S = k => X.reduce((s, x) => s + x ** k, 0), T2 = k => X.reduce((s, x, i) => s + x ** k * Y[i], 0);
    const A = [[X.length, S(1), S(2)], [S(1), S(2), S(3)], [S(2), S(3), S(4)]], bb = [T2(0), T2(1), T2(2)];
    let c; try { c = math.lusolve(A, bb).map(r => r[0]); } catch (e) { return null; }
    const cr = c.map(v => Math.abs(v) < 1e-9 * (1 + Math.abs(c[2])) ? 0 : n4(v)); return { kind, p: c, f: x => c[0] + c[1] * x + c[2] * x * x, fM: `${n8(c[0])}+(${n8(c[1])})*x+(${n8(c[2])})*x^2`, tex: 'y=' + polyDec(cr, 'x') };
  }
  if (kind === 'exp') { const L = linFit(X, Y.map(Math.log)), A = Math.exp(L.a); return { kind, p: [A, L.b], f: x => A * Math.exp(L.b * x), fM: `${n8(A)}*e^((${n8(L.b)})*x)`, tex: `y=${fmtReal(n4(A))}\\cdot e^{${fmtReal(n4(L.b))}x}` }; }
  if (kind === 'log') { const L = linFit(X.map(Math.log), Y); return { kind, p: [L.a, L.b], f: x => L.a + L.b * Math.log(x), fM: `${n8(L.a)}+(${n8(L.b)})*log(x)`, tex: `y=${fmtReal(n4(L.a))}${signed('+', fmtReal(n4(L.b)))}\\ln x` }; }
  if (kind === 'pow') { const L = linFit(X.map(Math.log), Y.map(Math.log)), A = Math.exp(L.a); return { kind, p: [A, L.b], f: x => A * Math.pow(x, L.b), fM: `${n8(A)}*x^(${n8(L.b)})`, tex: `y=${fmtReal(n4(A))}\\cdot x^{${fmtReal(n4(L.b))}}` }; }
  return null;
}
const REG_KINDS = ['lin', 'quad', 'exp', 'log', 'pow'];
CMDS.regr = (a) => {
  const args = a.slice(); let kind = 'auto';
  const last = String(args[args.length - 1] || '').trim().toLowerCase();
  const alias = { auto: 'auto', lin: 'lin', linear: 'lin', quad: 'quad', quadratisch: 'quad', exp: 'exp', exponentiell: 'exp', log: 'log', ln: 'log', logarithmisch: 'log', pow: 'pow', potenz: 'pow', power: 'pow' };
  if (alias[last]) { kind = alias[last]; args.pop(); }
  const { X, Y } = regData(args), steps = [];
  steps.push(step(T('rg_tab'), `\\begin{array}{c|${'c'.repeat(Math.min(X.length, 12))}}x&${X.slice(0, 12).map(v => fmtReal(v)).join('&')}\\\\\\hline y&${Y.slice(0, 12).map(v => fmtReal(v)).join('&')}\\end{array}`));
  const all = REG_KINDS.map(k => regModel(k, X, Y)).filter(Boolean).map(m => ({ ...m, R2: r2(Y, X.map(m.f)) }));
  let m;
  if (kind === 'auto') { const pen = { lin: 0, quad: 0.004, exp: 0.001, log: 0.001, pow: 0.001 }; m = all.slice().sort((p, q) => (q.R2 - pen[q.kind]) - (p.R2 - pen[p.kind]))[0]; }
  else m = all.find(x => x.kind === kind);
  if (!m) throw new Error(T('rg_model_na'));
  if (m.kind === 'lin') steps.push(step(T('rg_ls'), `\\bar x=${fmtReal(n4(m.L.mx))},\\;\\bar y=${fmtReal(n4(m.L.my))},\\quad b=\\frac{\\sum(x_i-\\bar x)(y_i-\\bar y)}{\\sum(x_i-\\bar x)^2}=${fmtReal(n4(m.L.b))},\\quad a=\\bar y-b\\bar x=${fmtReal(n4(m.L.a))}`, T('rg_ls_n')));
  else if (m.kind === 'exp') steps.push(step(T('rg_lin_exp'), `\\ln y=\\ln A+b\\,x\\;\\Rightarrow\\;\\text{${T('rg_linfit')}}`));
  else if (m.kind === 'log') steps.push(step(T('rg_lin_log'), `y=a+b\\,\\ln x\\;\\Rightarrow\\;\\text{${T('rg_linfit')}}`));
  else if (m.kind === 'pow') steps.push(step(T('rg_lin_pow'), `\\ln y=\\ln A+b\\ln x\\;\\Rightarrow\\;\\text{${T('rg_linfit')}}`));
  else steps.push(step(T('rg_quad'), `\\text{${T('rg_quad_n')}}`));
  steps.push(step(T('rg_model'), m.tex));
  steps.push(step(T('rg_r2'), `R^2=1-\\frac{\\sum (y_i-\\hat y_i)^2}{\\sum (y_i-\\bar y)^2}=${fmtReal(Number(m.R2.toFixed(5)))}`, T('rg_r2_n')));
  steps.push(step(T('rg_cmp'), '\\begin{array}{l|r}' + all.map(x => `\\text{${T('rgm_' + x.kind)}}&R^2=${fmtReal(Number(x.R2.toFixed(4)))}`).join('\\\\') + '\\end{array}'));
  const pts = X.map((x, i) => ({ k: 'data', x, y: Y[i], xt: fmtReal(x), yt: fmtReal(Y[i]), lab: 'P_{' + (i + 1) + '}', fi: -1 }));
  return { inTex: `\\text{${T('rg_cmd')}}\\;(${X.length}\\;\\text{${T('rg_points')}})`, outTex: m.tex + `,\\quad R^2=${fmtReal(Number(m.R2.toFixed(4)))}`, steps, plot: { fns: [m.fM], v: 'x' }, regPts: pts, reg: { kinds: all.map(x => x.kind), cur: m.kind, args } };
};
CMDS.regression = CMDS.regr; CMDS.fit = CMDS.regr;

K.CMDS = CMDS;

/* ---------- Ungleichungen ---------- */
const CMP_TEX = { '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ', '!=': '\\ne ' };
const holds = (y, op) => op === '<' ? y < 0 : op === '>' ? y > 0 : op === '<=' ? y <= 0 : op === '>=' ? y >= 0 : y !== 0;
function solveIneq(l, op, r) {
  const L = prep(l), R = prep(r), inTex = K.texOf(l) + CMP_TEX[op] + K.texOf(r);
  const gM = `(${toM(L, false)})-(${toM(R, false)})`;
  const free = freeSyms(gM);
  if (!free.length) {
    const a = toNum(math.evaluate(toM(L))), b = toNum(math.evaluate(toM(R)));
    const ok = holds(a - b, op);
    return { inTex, outTex: '\\text{' + T(ok ? 'true' : 'false') + '}', steps: [step(T('st_start'), fmtReal(a) + CMP_TEX[op] + fmtReal(b))] };
  }
  const v = free.includes('x') ? 'x' : free[0];
  if (free.length > 1) throw new Error(T('err_novar'));
  const steps = [];
  const gS = math.simplify(math.parse(gM));
  steps.push(step(T('s_move'), texM(gS) + CMP_TEX[op] + '0'));
  const g = compileFn(toM(`(${L})-(${R})`, true), v);
  const zs = solTexes(toN(`(${L})-(${R})`), gM, v, []);
  const pts = zs.real.map(z => ({ x: z.val, tex: z.tex, pole: false }));
  try {
    const rz = math.rationalize(gM, {}, true);
    if (rz.denominator) {
      const c = polyCoeffs(rz.denominator.toString(), v);
      const pr = c ? polyRoots(c, v).real : findRoots(compileFn(rz.denominator.toString(), v)).map(x => ({ val: x, tex: ftex(x) }));
      pr.forEach(q => { if (!pts.some(p => Math.abs(p.x - q.val) < 1e-9)) pts.push({ x: q.val, tex: q.tex, pole: true }); });
    }
  } catch (e) { }
  // Ränder des Definitionsbereichs (z. B. ln(x) erst ab x > 0)
  { const N = 12000, lo = -60, hi = 60, hh = (hi - lo) / N; let prev = isFinite(g(lo));
    for (let i = 1; i <= N; i++) { const x = lo + i * hh, cur = isFinite(g(x));
      if (cur !== prev) { let a0 = x - hh, b0 = x; for (let k = 0; k < 70; k++) { const m = (a0 + b0) / 2; if (isFinite(g(m)) === prev) a0 = m; else b0 = m; }
        let e = (a0 + b0) / 2; if (Math.abs(e - Math.round(e * 1e6) / 1e6) < 1e-7) e = Math.round(e * 1e6) / 1e6;
        if (!pts.some(p => Math.abs(p.x - e) < 1e-7)) pts.push({ x: e, tex: ftex(e), pole: false, dom: true }); }
      prev = cur; } }
  pts.sort((a, b) => a.x - b.x);
  if (pts.length) steps.push(step(T('ineq_crit'), pts.map(p => `${v}=${p.tex}` + (p.pole ? '\\;(' + T('ineq_pole') + ')' : p.dom ? '\\;(' + T('ineq_dom') + ')' : '')).join(',\\;')));
  // Intervalle testen
  const iv = [];
  const edges = [-Infinity, ...pts.map(p => p.x), Infinity];
  const tests = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const a = edges[k], b = edges[k + 1];
    let t = !isFinite(a) && !isFinite(b) ? 0 : !isFinite(a) ? b - 1 : !isFinite(b) ? a + 1 : (a + b) / 2;
    let y = g(t);
    if (!isFinite(y) && isFinite(a) && isFinite(b)) for (const fr2 of [0.25, 0.75, 0.1, 0.9]) { const t2 = a + (b - a) * fr2; if (isFinite(g(t2))) { t = t2; y = g(t2); break; } }
    const ok = isFinite(y) && holds(y, op);
    iv.push({ a, b, ok });
    tests.push(`${v}=${fmtReal(t)}:\\; ${fmtReal(y)}${ok ? '\\;\\checkmark' : '\\;\\times'}`);
  }
  steps.push(step(T('ineq_test'), tests.slice(0, 10).join('\\\\')));
  // Randpunkte
  const incl = pts.map(p => !p.pole && (p.dom ? isFinite(g(p.x)) && holds(g(p.x), op) : (op === '<=' || op === '>=') && isFinite(g(p.x))));
  // zusammenführen
  const parts = []; let cur = null;
  for (let k = 0; k < iv.length; k++) {
    const I = iv[k];
    if (I.ok) {
      if (cur && k > 0 && incl[k - 1]) cur.b = I.b, cur.bi = false, cur.bTex = null;
      else { if (cur) parts.push(cur); cur = { a: I.a, ai: k > 0 && incl[k - 1], aTex: k > 0 ? pts[k - 1].tex : null, b: I.b, bi: false }; }
      cur.b = I.b; cur.bTex = k < pts.length ? pts[k].tex : null; cur.bi = k < pts.length && incl[k];
    } else {
      if (cur) { parts.push(cur); cur = null; }
      // isolierter Punkt (z. B. (x-1)^2 <= 0)
      if (k < pts.length && incl[k] && !(iv[k + 1] && iv[k + 1].ok)) parts.push({ point: pts[k].tex });
    }
  }
  if (cur) parts.push(cur);
  const T2 = parts.map(P => {
    if (P.point) return '\\{' + P.point + '\\}';
    const a = isFinite(P.a) ? P.aTex : '-\\infty', b = isFinite(P.b) ? P.bTex : '\\infty';
    return (P.ai ? '\\left[' : '\\left(') + a + ',\\;' + b + (P.bi ? '\\right]' : '\\right)');
  });
  let out;
  if (!parts.length) out = '\\mathbb{L}=\\{\\,\\}';
  else if (parts.length === 1 && !parts[0].point && !isFinite(parts[0].a) && !isFinite(parts[0].b)) out = v + '\\in\\mathbb{R}';
  else out = v + '\\in ' + T2.join('\\cup ');
  steps.push(step(T('s_solution'), out));
  return { inTex, outTex: out, steps, note: zs.periodic ? T('ineq_periodic') : null, plot: { fns: [toM(`(${L})-(${R})`, true)], v }, marks: pts.filter(p => !p.pole).map(p => p.x) };
}

/* =========================================================
   6) Hauptauswertung
   ========================================================= */
/* ---------- Definitionsbereich: nicht definierte und nicht reelle Ausdrücke ---------- */
function undefCheck(sM) {
  let node; try { node = math.parse(sM); } catch (e) { return null; }
  let hit = null, notReal = null, note = null;
  const ev = n => { try { return n.evaluate(); } catch (e) { return undefined; } };
  const num = v => { if (v && v.isComplex) return Math.abs(v.im) < 1e-12 ? v.re : NaN; if (v && v.isFraction) return v.valueOf(); if (v && v.isBigNumber) return v.toNumber(); return typeof v === 'number' ? v : NaN; };
  const zero = x => Math.abs(x) < 1e-13;
  node.traverse(n => {
    if (hit) return;
    const isFn = n.isFunctionNode, f = isFn ? n.fn.name : null;
    if (n.isOperatorNode && n.fn === 'divide') { const d = num(ev(n.args[1])); if (zero(d)) hit = { key: zero(num(ev(n.args[0]))) ? 'ud_00' : 'ud_div0', tex: `${texM(n.args[1])}=0` }; }
    if (n.isOperatorNode && n.fn === 'pow') { const b = num(ev(n.args[0])), x = num(ev(n.args[1])); if (zero(b) && x < 0) hit = { key: 'ud_div0', tex: `0^{${fmtReal(x)}}=\\frac{1}{0^{${fmtReal(-x)}}}` }; else if (zero(b) && zero(x)) note = 'ud_00pow'; }
    if ((n.isOperatorNode && n.fn === 'factorial') || f === 'factorial') { const a = num(ev(n.args[0])); if (a < 0 && Number.isInteger(a)) hit = { key: 'ud_fact', tex: `${fmtReal(a)}!` }; }
    if (!isFn) return;
    const a = n.args.map(x => num(ev(x)));
    if (f === 'log' || f === 'log10' || f === 'log2') {
      if (n.args.length === 2 && isFinite(a[1]) && (!(a[1] > 0) || zero(a[1] - 1))) { hit = { key: 'ud_logbase', tex: `b=${fmtReal(a[1])}` }; return; }
      if (zero(a[0])) hit = { key: 'ud_log0', tex: '' }; else if (a[0] < 0) notReal = 'ud_logneg';
    }
    if ((f === 'tan' || f === 'sec') && isFinite(a[0]) && zero(Math.cos(a[0]))) hit = { key: 'ud_tan', tex: '' };
    if ((f === 'cot' || f === 'csc') && isFinite(a[0]) && zero(Math.sin(a[0]))) hit = { key: 'ud_cot', tex: '' };
    if ((f === 'atanh' || f === 'acoth') && zero(Math.abs(a[0]) - 1)) hit = { key: 'ud_atanh', tex: '' };
    if (f === 'acoth' && Math.abs(a[0]) < 1) notReal = 'not_real';
    if (f === 'mod' && zero(a[1])) hit = { key: 'ud_mod0', tex: '' };
    if ((f === 'combinations' || f === 'permutations') && a.some(x => x < 0 || !Number.isInteger(x))) hit = { key: 'ud_ncr', tex: '' };
    if ((f === 'asin' || f === 'acos') && Math.abs(a[0]) > 1) notReal = 'ud_arcsin';
    if (f === 'acosh' && a[0] < 1) notReal = 'not_real';
    if (f === 'atanh' && Math.abs(a[0]) > 1) notReal = 'not_real';
    if (f === 'sqrt' && a[0] < 0) notReal = 'ud_sqrt';
    if (f === 'nthRoot' && a[0] < 0 && Number.isInteger(a[1]) && a[1] % 2 === 0) notReal = 'ud_sqrt';
  });
  return { hit, notReal, note };
}
const MBIG = () => K._mb || (K._mb = math.create(math.all, { number: 'BigNumber', precision: 64 }));
function bigTex(bv) {
  const [m, ex] = bv.toExponential(S.digits - 1).split('e');
  const mant = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
  return decFix(mant) + '\\cdot 10^{' + parseInt(ex) + '}';
}
K.run = function (raw) {
  const s = K.normalize(raw);
  if (!s) return null;
  // Definitionen
  let m = s.match(/^([A-Za-z]\w*)\s*\(([^)]*)\)\s*:=\s*(.+)$/);
  if (m) {
    const params = m[2].split(',').map(x => x.trim()).filter(Boolean);
    const body = applyDefs(m[3], [m[1]]);
    math.parse(toM(body, false));
    K.funcs[m[1]] = { params, body };
    const one = params.length === 1;
    return { kind: 'def', inTex: `${m[1]}(${params.join(',')}):=${K.texOf(m[3])}`, outTex: `\\text{${T('def_var', { n: m[1] })}}`, steps: [], fnName: one ? m[1] : null, fnExpr: one && params[0] === 'x' ? body : (one ? body.replace(new RegExp('\\b' + params[0] + '\\b', 'g'), 'x') : null) };
  }
  m = s.match(/^([A-Za-z]\w*)\s*:=\s*(.+)$/);
  if (m) {
    const body = applyDefs(m[2], [m[1]]);
    let shown = K.texOf(body);
    try { const v = math.evaluate(toM(applyConsts(body), true)); if (!v.isMatrix && typeof v !== 'object') shown = fmtVal(v); } catch (e) { }
    K.vars[m[1]] = body;
    return { kind: 'def', inTex: `${m[1]}:=${K.texOf(m[2])}`, outTex: `${m[1]}=${shown}`, steps: [] };
  }
  // Befehl
  const c = topCall(s);
  if (c && CMDS[c.name]) {
    const r = CMDS[c.name](c.args);
    r.kind = c.name;
    if (r.plot && r.plot.fns && ['diff', 'integrate', 'limit', 'taylor', 'tangent'].includes(c.name)) r.anFns = [toX(K.mjToUser(r.plot.fns[0]), r.plot.v || 'x')];
    return r;
  }
  // Funktionsform  y = …  /  f(x) = …
  m = s.match(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*(.+)$/);
  if (m && !splitEq(m[1])) return K.run('f(x):=' + m[1]);
  // Ungleichung
  const cmp = splitCmp(s);
  if (cmp) { const r = solveIneq(cmp[0], cmp[1], cmp[2]); r.kind = 'ineq'; r.anFns = sideFns(prep(cmp[0]), prep(cmp[2])); return r; }
  // mehrere Funktionen: f; g (Schnittpunkte)
  const parts = splitTop(s, ',');
  if (parts.length >= 2 && parts.length <= 4 && !/[\[\]]/.test(s)) {
    const ok = parts.every(p => { try { const fs = freeSyms(toM(prep(p), false)); return fs.every(q => q === 'x'); } catch (er) { return false; } });
    if (ok && parts.some(p => freeSyms(toM(prep(p), false)).length)) return multiFns(parts);
  }
  // Gleichung
  const eq = splitEq(s);
  if (eq) { const r = solveEqs([s], []); r.kind = 'solve'; const pe = splitEq(prep(s)); if (pe) r.anFns = sideFns(pe[0], pe[1]); return r; }
  // Ausdruck
  const e = prep(s);
  const free = freeSyms(toM(e, false));
  const hasMat = /\[/.test(e);
  if (hasMat) {
    const v = matEval(e);
    const steps = [];
    // Matrixprodukt erklären
    const pc = topCallOp(e);
    return { kind: 'matrix', inTex: K.texOf(s), outTex: fmtVal(v), steps };
  }
  if (free.length === 0) {
    const uc = undefCheck(degWrap(toM(e, true)));
    if (uc && uc.hit) return { kind: 'num', inTex: K.texOf(s), outTex: `\\text{${T('undef')}}`, steps: [step(T('ud_title'), `\\text{${T(uc.hit.key)}}` + (uc.hit.tex ? '\\\\ ' + uc.hit.tex : ''))], note: T(uc.hit.key) };
    const sN = degWrap(toN(e)), sM = degWrap(toM(e, true));
    let startTex; try { startTex = texM(math.parse(toM(e, true))); } catch (er) { startTex = K.texOf(s); }
    const steps = [step(T('st_start'), startTex)];
    try { steps.push(...K.arithSteps(degWrap(toM(e, true)))); } catch (err) { if (/0/.test(err.message) && err.message === T('err_div0')) throw err; }
    let exact = null;
    try {
      const n = nerdamer(sN);
      const str = n.toString();
      if (!/NaN|undefined|Infinity/.test(str) || /Infinity/.test(sN)) exact = str;
    } catch (err) { }
    let approx;
    try { approx = math.evaluate(sM); } catch (err) { if (exact === null) throw err; }
    if (approx && approx.isFraction) approx = approx.valueOf();
    if (typeof approx === 'number' && isFinite(approx) && Math.abs(approx) < 1e12 && Math.abs(approx - Math.round(approx)) < 1e-11 * (1 + Math.abs(approx)) && exact !== null && /log|\^|sqrt|sin|cos|tan/.test(exact)) exact = String(Math.round(approx));
    if (typeof approx === 'number' && !isFinite(approx) && /\/\s*0(?![.\d])/.test(sM)) throw new Error(T('err_div0'));
    const hasDec = /\d\.\d/.test(e);
    let outTex, approxOut = null;
    if (exact === '0' && typeof approx === 'number' && approx !== 0) exact = null;
    if (/\bmod\(/.test(e)) exact = null;
    const exactNum = exact !== null && /^-?\d+(\/\d+)?$/.test(exact);
    if (/\b(re|im|conj|sign|max|min|hypot|identity)\s*\(/.test(e)) exact = null;
    if (exact !== null && /\b(a?(sin|cos|tan|cot|sec|csc)h?|re|im|arg|conj|sign|max|min|hypot|identity)\(/.test(exact)) exact = null;
    let bigOut = null;
    if (typeof approx === 'number' && !isFinite(approx)) { try { const bv = MBIG().evaluate(sM); if (bv && bv.isBigNumber && bv.isFinite()) { bigOut = bigTex(bv); exact = null; } } catch (er) { } }
    if (bigOut) { outTex = bigOut; }
    else if (exact !== null && (niceExact(exact) || /^-?\d{1,40}$/.test(exact)) && !hasDec) {
      outTex = texN(exact);
      const ap = toNum(approx);
      if (!/^-?\d+$/.test(exact) && approx !== undefined) approxOut = approx;
      if (typeof approx === 'object' && approx && approx.im) approxOut = approx;
    } else outTex = fmtVal(approx);
    if (approxOut !== null && fmtVal(approxOut) === outTex) approxOut = null;
    try { const ansV = exact !== null && niceExact(exact) && !hasDec ? exact.replace(/\blog10\(/g, 'lg(').replace(/\blog\(/g, 'ln(') : (typeof approx === 'number' ? String(approx) : null); if (ansV && !/\bi\b/.test(ansV)) K.vars.ans = ansV; } catch (err) { }
    if (steps.length <= 1) steps.length = 0;
    else if (exact && !hasDec && !exactNum && niceExact(exact)) steps.push(step(T('st_exact'), '=' + texN(exact)));
    let cpts = null;
    try { const c = math.complex(approx); if (Math.abs(c.im) > 1e-12) cpts = [{ re: c.re, im: c.im, tex: outTex }]; } catch (er) { }
    // exakte Werte der Arkusfunktionen (Vielfache von π)
    if (S.angle !== 'deg' && typeof approx === 'number' && isFinite(approx) && approx !== 0 && /\ba(sin|cos|tan|cot|sec|csc)\(/.test(sM) && !/\\pi/.test(outTex)) {
      const q = fr(approx / Math.PI); if (q && q.d <= 12 && Math.abs(q.valueOf() * Math.PI - approx) < 1e-12) { outTex = texN(`(${q.toFraction()})*pi`); approxOut = approx; }
    }
    const notes = [];
    if (S.angle === 'deg' && /sin|cos|tan/.test(e)) notes.push(T('deg_note'));
    if (uc && uc.notReal) notes.push(T(uc.notReal));
    else if (cpts && !/\bi\b/.test(e)) notes.push(T('not_real'));
    if (uc && uc.note) notes.push(T(uc.note));
    return { kind: 'num', inTex: K.texOf(s), outTex, approx: approxOut, steps, cpts, note: notes.join(' ') || null };
  }
  // symbolischer Ausdruck
  const sN = toN(e);
  const simp = nerdamer(`simplify(${sN})`).toString();
  const steps = [];
  const alts = [];
  try { const ex = nerdamer(`expand(${sN})`).toString(); if (ex !== simp) alts.push({ k: 'expd', t: texN(ex) }); } catch (err) { }
  try { const fa = nerdamer(`factor(${sN})`).toString(); if (fa !== simp && !alts.some(x => x.t === texN(fa))) alts.push({ k: 'fact_', t: texN(fa) }); } catch (err) { }
  alts.forEach(x => steps.push(step(T(x.k), '=' + x.t)));
  const res = { kind: 'expr', inTex: K.texOf(s), outTex: texN(simp), steps, free };
  if (free.length === 1) res.fnExpr = free[0] === 'x' ? e : e.replace(new RegExp('\\b' + free[0] + '\\b', 'g'), 'x');
  return res;
};
function topCallOp() { return null; }

K._prepM = s => toM(applyConsts(applyDefs(s)), true);
if (typeof module !== 'undefined') module.exports = K;
