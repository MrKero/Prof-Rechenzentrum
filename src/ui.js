/* ================= Prof Rechenzentrum – Oberfläche ================= */
const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('profrz.' + k) ?? localStorage.getItem('kalkuel.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('profrz.' + k, JSON.stringify(v)); } catch (e) { } }
};
const ss = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } } };
const TOUCH = window.matchMedia('(pointer: coarse)').matches;

/* ---------- Einstellungen ---------- */
(function initSettings() {
  const saved = store.get('settings', null);
  if (saved) Object.assign(S, saved);
  else {
    const nav = (navigator.language || 'de').toLowerCase();
    let code = 'en';
    if (/^zh-(tw|hk|mo|hant)/.test(nav)) code = 'zh-Hant';
    else if (/^zh/.test(nav)) code = 'zh-Hans';
    else { const m = LANGS.find(l => nav.startsWith(l[0])); if (m) code = m[0]; }
    S.lang = code;
    S.dec = ['de', 'tr', 'es', 'ru', 'fr', 'it', 'fa'].includes(code) ? ',' : '.';
  }
  if (S.autoUpdate === undefined) S.autoUpdate = true;
  if (!S.cfg || S.cfg < 2) { S.logo = 'brille'; S.cfg = 2; }
  if (!LOGO_ORDER.includes(S.logo)) S.logo = 'brille';
  if (!LOGOS[S.logo]) S.logo = 'hut';
  const v = store.get('vars', null);
  if (v) { K.vars = v.vars || {}; K.funcs = v.funcs || {}; }
})();
const saveSettings = () => store.set('settings', S);
const saveVars = () => store.set('vars', { vars: K.vars, funcs: K.funcs });
const toCanon = s => S.dec === ',' ? s.replace(/,/g, '§').replace(/;/g, ',').replace(/§/g, '.') : s;
const toDisp = s => S.dec === ',' ? s.replace(/,/g, '§').replace(/\./g, ',').replace(/§/g, ';') : s;

/* ---------- MathJax ---------- */
let MJ_READY = false;
const pending = new Set();
function render(el, tex, display = true) {
  el._tex = tex; el._display = display;
  if (!MJ_READY) { el.textContent = tex; el.classList.add('math-raw'); pending.add(el); return; }
  el.classList.remove('math-raw');
  try {
    const outer = tex.replace(/\\begin\{(\w+)\}[\s\S]*?\\end\{\1\}/g, '');
    if (/\\\\/.test(outer)) tex = '\\begin{array}{l}' + tex + '\\end{array}';
    el.replaceChildren(MathJax.tex2svg(tex, { display }));
  } catch (e) { el.textContent = tex; }
}
function whenMathJax() {
  const s = document.getElementById('mjx');
  const ready = () => MathJax.startup.promise.then(() => {
    try { document.head.appendChild(MathJax.svgStylesheet()); } catch (e) { }
    MJ_READY = true; pending.forEach(el => { if (el.isConnected) render(el, el._tex, el._display); }); pending.clear();
  });
  if (window.MathJax && MathJax.startup && MathJax.startup.promise) ready(); else s.addEventListener('load', ready);
}

/* =========================================================
   Formel-Editor (MathQuill)
   ========================================================= */
const MQ = MathQuill.getInterface(2);
const mqEl = $('#mq');
const mqCfg = handlers => ({
  spaceBehavesLikeTab: true, supSubsRequireOperand: true, autoSubscriptNumerals: false,
  charsThatBreakOutOfSupSub: '+-=<>', restrictMismatchedBrackets: false,
  autoCommands: 'pi sqrt nthroot sum prod infty alpha beta gamma delta theta lambda mu sigma omega phi rho tau',
  autoOperatorNames: ED.OPNAMES.join(' '),
  substituteTextarea() {
    const t = document.createElement('textarea');
    ['autocapitalize', 'autocomplete', 'autocorrect'].forEach(a => t.setAttribute(a, 'off'));
    t.setAttribute('spellcheck', 'false'); t.setAttribute('aria-label', 'Eingabe');
    if (TOUCH) t.setAttribute('inputmode', 'none');
    return t;
  },
  handlers
});
// Matrizen/Vektoren erscheinen im Eingabefeld als echte Struktur (Embed), bearbeitet im Matrix-Editor
const escH = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
MQ.registerEmbed('mx', id => {
  const m = ED.MX[id] || { rows: [['?']] }, cols = m.rows[0].length;
  return {
    htmlString: `<span class="mx-emb${m.vec ? ' vec' : ''}" data-mx="${id}"><span class="mx-g" style="grid-template-columns:repeat(${cols},auto)">${m.rows.flat().map(c => `<span class="mx-c">${escH(c || '0')}</span>`).join('')}</span></span>`,
    text: () => ED.latexToText(ED.mxBracket(m), S.dec),
    latex: () => '\\embed{mx}[' + id + ']'
  };
});
function renderMx(root = mqEl) { root.querySelectorAll('.mx-c:not([data-r])').forEach(c => { c.dataset.r = '1'; const t = c.textContent; c.textContent = ''; try { render(c, K.decFix(t), false); } catch (e) { c.textContent = t; } }); }
const mf = MQ.MathField(mqEl, mqCfg({ enter: () => compute(), edit: () => onEdit() }));
// Weitere Formelfelder (Graph): das Tastenfeld schreibt immer ins aktive Feld
let ACTIVE = mf;
const taOf = F => F.el().querySelector('textarea');
function setActive(F) {
  if (ACTIVE && ACTIVE !== F) { try { const c = ACTIVE.__controller.cursor; c.hide(); } catch (e) { } } // nur ein blinkender Cursor
  ACTIVE = F;
  document.querySelectorAll('.mini').forEach(m => m.classList.toggle('active', F !== mf && m === F.el()));
  $('#display').classList.toggle('inactive', F !== mf);
}
function makeMini(el, onEnter) {
  const F = MQ.MathField(el, mqCfg({ enter: () => onEnter() }));
  F._enter = onEnter;
  taOf(F).addEventListener('focus', () => { if (ACTIVE !== F) setActive(F); keepCursor(); });
  taOf(F).addEventListener('blur', () => setTimeout(() => { if (ACTIVE === F) keepCursor(); }, 0));
  el.addEventListener('pointerdown', () => { if (ACTIVE !== F) setActive(F); try { taOf(F).focus({ preventScroll: true }); } catch (e) { } setTimeout(keepCursor, 0); });
  el.addEventListener('pointerup', () => setTimeout(keepCursor, 0));
  return F;
}
const mqAdd = makeMini($('#mqAdd'), () => submitAddFn());
const mqA = makeMini($('#mqA'), () => applyBounds());
const mqB = makeMini($('#mqB'), () => applyBounds());
const mqR = ['#mqX0', '#mqX1', '#mqY0', '#mqY1'].map(id => makeMini($(id), () => applyRange()));
taOf(mf).addEventListener('focus', () => setActive(mf));
function fieldGroup(F) { if (MXE && MXE.minis && MXE.minis.includes(F)) return MXE.minis; if (mqR.includes(F)) return mqR; if (F === mqA || F === mqB) return [mqA, mqB]; return null; }
function onEdit() {
  keepCursor(); renderMx();
  $('#ph').hidden = mf.latex() !== '';
  const w = $('#mqWrap'), cur = mqEl.querySelector('.mq-cursor');
  if (cur) { const r = cur.getBoundingClientRect(), wr = w.getBoundingClientRect(); if (r.right > wr.right - 8) w.scrollLeft += r.right - wr.right + 24; if (r.left < wr.left + 8) w.scrollLeft -= wr.left - r.left + 24; }
}
function keepCursor() { try { const c = ACTIVE.__controller.cursor; if (!c.intervalId) c.show(); } catch (e) { } }
const focusEd = () => { const ta = taOf(ACTIVE); if (document.activeElement !== ta) { try { ta.focus({ preventScroll: true }); } catch (e) { ACTIVE.focus(); } } keepCursor(); };
[mf, mqAdd, mqA, mqB, ...mqR].forEach(F => taOf(F).addEventListener('blur', () => setTimeout(() => {
  const a = document.activeElement;
  if (ACTIVE === F && (!a || !/INPUT|SELECT|TEXTAREA/.test(a.tagName) || a.closest('.mq-editable-field'))) keepCursor();
}, 0)));
$('#display').addEventListener('pointerdown', e => { setActive(mf); if (!e.target.closest('#mq')) { e.preventDefault(); focusEd(); mf.moveToRightEnd(); } });
function setEditorText(canon) { mf.latex(ED.toEmbeds(ED.textToLatex(canon))); onEdit(); }
function editorCanon() { return ED.latexToText(mf.latex(), S.dec); }

/* ---------- Matrix-Editor ---------- */
let MXE = null; // { vec, r, c, cells: [latex], minis: [], editId }
function mxOpen(spec, editId) {
  const old = editId && ED.MX[editId];
  MXE = { vec: !!spec.vec, reg: !!spec.reg, r: spec.r, c: spec.vec ? 1 : spec.c, cells: old ? old.rows.flat() : [], editId: editId || null };
  if (old) { MXE.r = old.rows.length; MXE.c = old.rows[0].length; }
  $('#mxEd').hidden = false; mxBuild();
  $('#mxEd').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function mxSave() { if (MXE) MXE.cells = MXE.minis.map(F => F.latex()); }
function mxBuild() {
  const box = $('#mxGrid'); box.replaceChildren();
  $('#mxTitle').textContent = MXE.reg ? T('rg_data_t') + ' · ' + MXE.r : T(MXE.vec ? 'mx_vec' : 'mx_mat') + ' ' + (MXE.vec ? MXE.r + 'D' : MXE.r + '×' + MXE.c);
  $('#mxCols').hidden = MXE.vec || MXE.reg;
  $('#mxEd').classList.toggle('reg', MXE.reg);
  $('#mxRn').textContent = MXE.r; $('#mxCn').textContent = MXE.c;
  box.style.gridTemplateColumns = `repeat(${MXE.c}, minmax(54px, 1fr))`;
  box.classList.toggle('vec', MXE.vec);
  const old = MXE.cells, oc = MXE.oc || MXE.c; MXE.minis = [];
  if (MXE.reg) ['x', 'y'].forEach(t => box.appendChild(el('span', 'mx-colh', t)));
  for (let i = 0; i < MXE.r; i++) for (let j = 0; j < MXE.c; j++) {
    const sp = el('span', 'mini mx-cell'); box.appendChild(sp);
    const k = MXE.minis.length;
    const F = makeMini(sp, () => { const nx = MXE.minis[k + 1]; if (nx) { setActive(nx); focusEd(); } else mxInsert(); });
    const prev = old[i * oc + j]; if (prev) F.latex(prev);
    MXE.minis.push(F);
  }
  MXE.oc = MXE.c;
  setActive(MXE.minis[0]); focusEd();
}
function mxResize(dr, dc) {
  mxSave(); const r = Math.max(1, Math.min(6, MXE.r + dr)), c = Math.max(1, Math.min(6, MXE.c + dc));
  if (MXE.vec && r < 2) return;
  const cells = []; for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) cells.push(i < MXE.r && j < MXE.c ? MXE.cells[i * MXE.c + j] : '');
  MXE.r = r; MXE.c = c; MXE.cells = cells; MXE.oc = c; mxBuild();
}
function mxClose() { $('#mxEd').hidden = true; MXE = null; setActive(mf); focusEd(); }
function mxInsert() {
  mxSave();
  if (MXE.reg) { // Messdaten → Regression berechnen
    const tx = c => { try { return ED.latexToText(c, S.dec).trim(); } catch (e) { return ''; } };
    const rows = []; for (let i = 0; i < MXE.r; i++) { const x = tx(MXE.cells[i * 2] || ''), y = tx(MXE.cells[i * 2 + 1] || ''); if (x && y) rows.push(`[${x},${y}]`); }
    $('#mxEd').hidden = true; MXE = null; setActive(mf);
    if (rows.length < 3) { toast(T('rg_data')); return; }
    return compute(`regr([${rows.join(',')}],auto)`);
  }
  const rows = []; for (let i = 0; i < MXE.r; i++) rows.push(MXE.cells.slice(i * MXE.c, (i + 1) * MXE.c).map(c => c.trim() || '0'));
  const id = ED.mxNew({ vec: MXE.vec, rows }), tag = '\\embed{mx}[' + id + ']', editId = MXE.editId;
  $('#mxEd').hidden = true; MXE = null; setActive(mf);
  if (editId) mf.latex(mf.latex().split('\\embed{mx}[' + editId + ']').join(tag)); else { focusEd(); mf.write(tag); }
  focusEd(); onEdit();
}
$('#mxRm').onclick = () => mxResize(-1, 0); $('#mxRp').onclick = () => mxResize(1, 0);
$('#mxCm').onclick = () => mxResize(0, -1); $('#mxCp').onclick = () => mxResize(0, 1);
$('#mxOk').onclick = mxInsert; wireTable(); wireSurf(); $('#mxX').onclick = mxClose;
// Antippen einer Matrix im Eingabefeld → bearbeiten
mqEl.addEventListener('pointerup', e => { const m = e.target.closest('.mx-emb'); if (m && ED.MX[m.dataset.mx]) { const o = ED.MX[m.dataset.mx]; mxOpen({ vec: o.vec, r: o.rows.length, c: o.rows[0].length }, m.dataset.mx); } });

// Kopieren → Textform, Einfügen → schöne Form
function selectionLatex() {
  try { const c = mf.__controller.cursor; return c.selection ? c.selection.join('latex') : ''; } catch (e) { return ''; }
}
$('#mqWrap').addEventListener('copy', e => {
  const l = selectionLatex(); if (!l) return;
  e.preventDefault(); e.stopPropagation();
  let txt; try { txt = toDisp(ED.latexToText(l)); } catch (er) { txt = l; }
  e.clipboardData.setData('text/plain', txt);
}, true);
$('#mqWrap').addEventListener('cut', e => {
  const l = selectionLatex(); if (!l) return;
  e.preventDefault(); e.stopPropagation();
  let txt; try { txt = toDisp(ED.latexToText(l)); } catch (er) { txt = l; }
  e.clipboardData.setData('text/plain', txt); mf.keystroke('Backspace');
}, true);
function pasteText(txt) {
  const clean = String(txt || '').trim().replace(/^\$+|\$+$/g, '');
  if (!clean) return;
  focusEd();
  try {
    if (/\\[a-zA-Z]/.test(clean)) ACTIVE.write(clean);
    else ACTIVE.write(ED.textToLatex(ED.cleanPasted(clean)));
  } catch (e) { ACTIVE.typedText(clean); }
  onEdit(); toast(T('pasted'));
}
$('#mqWrap').addEventListener('paste', e => {
  const txt = (e.clipboardData || window.clipboardData).getData('text/plain');
  if (!txt) return;
  e.preventDefault(); e.stopPropagation(); pasteText(txt);
}, true);
// Einfügen-Taste: erst direkt aus der Zwischenablage, sonst über ein kleines Feld (gedrückt halten → Einfügen)
async function pasteKey() {
  try { if (navigator.clipboard && navigator.clipboard.readText) { const t = await navigator.clipboard.readText(); if (t && t.trim()) return pasteText(t); } } catch (e) { }
  const box = $('#pasteBox'); box.hidden = false;
  const inp = $('#pasteIn'); inp.value = ''; try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
}
$('#pasteIn').addEventListener('input', e => {
  const v = $('#pasteIn').value;
  if (v && (!e.inputType || /paste|replacement|insertText/.test(e.inputType))) { $('#pasteBox').hidden = true; $('#pasteIn').value = ''; pasteText(v); }
});
$('#pasteBtn').addEventListener('pointerdown', e => e.preventDefault());
$('#pasteBtn').onclick = pasteKey;
$('#pasteIn').addEventListener('paste', e => {
  const t = (e.clipboardData || window.clipboardData).getData('text/plain');
  if (!t) return; e.preventDefault(); $('#pasteBox').hidden = true; pasteText(t);
});
$('#pasteOk').onclick = () => { const v = $('#pasteIn').value; $('#pasteBox').hidden = true; pasteText(v); };
$('#pasteIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#pasteOk').click(); } if (e.key === 'Escape') $('#pasteBox').hidden = true; });
$('#pasteX').onclick = () => { $('#pasteBox').hidden = true; };

/* =========================================================
   Tastenfeld
   ========================================================= */
// Aktion: 't:text' (tippen) | 'c:\\cmd' (Befehl) | 'w:latex' (schreiben) | 'f:name' (Funktion mit Klammer) |
//         'p:name|args' (Vorlage, Cursor im 1. Argument) | Spezial: GO BACK LEFT RIGHT CLEAR DEC ARG SHIFT ABC RECENT
// Taste: [Beschriftung, Aktion, Klasse, Unterzeile, Varianten[[Beschriftung, Aktion], …]]
const SQRT3 = 'w:\\sqrt[3]{}|L';
const P = {
  paren: ['( )', 'c:(', 'op m', null, [['(', 't:('], [')', 't:)'], ['[ ]', 'c:['], ['|x|', 'c:|']]],
  pow: ['xⁿ', 'c:^', 'op m', null, [['x²', 'w:^{2}'], ['x³', 'w:^{3}'], ['xⁿ', 'c:^'], ['x⁻¹', 'w:^{-1}']]],
  sqrt: ['√', 'c:\\sqrt', 'fn m', null, [['√', 'c:\\sqrt'], ['∛', SQRT3], ['ⁿ√', 'c:\\nthroot']]],
  frac: ['a⁄b', 't:/', 'fn m'],
  x: ['x', 't:x', 'fn m', null, [['x', 't:x'], ['y', 't:y'], ['z', 't:z'], ['t', 't:t'], ['n', 't:n'], ['k', 't:k']]],
  pi: ['π', 'c:\\pi', 'fn m', null, [['π', 'c:\\pi'], ['π⁄2', 'w:\\frac{\\pi}{2}'], ['π⁄3', 'w:\\frac{\\pi}{3}'], ['π⁄4', 'w:\\frac{\\pi}{4}'], ['2π', 'w:2\\pi']]],
  cmp: ['>', 't:>', 'op m', null, [['>', 't:>'], ['<', 't:<'], ['≥', 'c:\\ge'], ['≤', 'c:\\le'], ['≠', 'c:\\ne']]],
  eq: ['=', 't:=', 'op m', null, [['=', 't:='], [':=', 't::=']]],
  e: ['e', 't:e', 'fn m', 'ln · log', [['e', 't:e'], ['eˣ', 'w:e^{}|L'], ['ln', 'f:ln'], ['log₁₀', 'f:log'], ['logₐ', 'p:log|,']]],
  sci: ['×10ⁿ', 'w:\\cdot10^{}|L', 'op m'],
  go: ['↵', 'GO', 'go'],
  dec: ['DEC', 'DEC', ''], arg: ['ARG', 'ARG', 'op']
};
const d = n => [String(n), 't:' + n, ''];
const OPS = { div: ['÷', 'c:\\div', 'op m'], mul: ['×', 'c:\\cdot', 'op m'], add: ['+', 't:+', 'op m'], sub: ['−', 't:-', 'op m'] };
// Rechenzeichen in einer Taste (2×2: + − / × ÷) und Funktionstaste (2×4: f/g × Definition, Wert, f′, f″)
const OPS4 = ['OPS4', 't:+', 'op m', null, [['+', 't:+'], ['−', 't:-'], ['×', 'c:\\cdot'], ['÷', 'c:\\div']], null, 2];
const fnRow = n => [[n + '(x):=', 'w:' + n + '\\left(x\\right):='], [n + '( )', 'w:' + n + '\\left(\\right)|L'], [n + '′( )', 'w:' + n + "'\\left(\\right)|L"], [n + '″( )', 'w:' + n + "''\\left(\\right)|L"], [n + '⁽ⁿ⁾( )', 'w:' + n + '^{\\left(\\right)}\\left(\\right)|L|L|L|L']];
const FNKEY = ['f( )', 'w:f\\left(\\right)|L', 'fn', 'f′ f″ g h', [...fnRow('f'), ...fnRow('g'), ...fnRow('h')], null, 5];
const DECK = ['DEC', 'DEC', '', null, [['DEC', 'DEC'], ['ARG', 'ARG']]];
// Ziffernblock immer unten links (Zeilen 2–5, Spalten 1–3); oben 6 Tasten, rechts 3×4 Tasten
const DIG = [[d(7), d(8), d(9)], [d(4), d(5), d(6)], [d(1), d(2), d(3)], [DECK, d(0), P.x]];
function layout(top, right) {
  const out = [...top];
  for (let r = 0; r < 4; r++) out.push(...DIG[r], ...right.slice(r * 3, r * 3 + 3));
  return out;
}
const TRIG_NAMES = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'arccot', 'arcsec', 'arccsc',
  'sinh', 'cosh', 'tanh', 'coth', 'sech', 'csch', 'arsinh', 'arcosh', 'artanh', 'arcoth', 'arsech', 'arcsch'];
const SKEY = ['s', 'f:std', 'fn m', 'std', [['s', 'f:std'], ['s²', 'f:var']]];
const KEYS = {
  tab_basic: layout(
    [['ans', 'w:\\operatorname{ans}', 'fn'], ['%', 't:%', 'op'], ['n!', 't:!', 'fn m'], P.e, P.pow, P.paren],
    [OPS.add, P.frac, P.sqrt, OPS.sub, P.sci, P.pi, OPS.mul, P.cmp, P.eq, OPS.div, ['↵', 'GO', 'go wide']]),
  tab_func: layout(
    [['ln', 'f:ln', 'fn'], ['log', 'f:log', 'fn', 'log₁₀', [['log₁₀', 'f:log'], ['logₐ', 'p:log|,2']]], ['eˣ', 'w:e^{}|L', 'fn m', null, [['eˣ', 'w:e^{}|L'], ['10ˣ', 'w:10^{}|L'], ['2ˣ', 'w:2^{}|L']]],
      ['|x|', 'c:|', 'fn m'], ['mod', 'p:mod|,', 'fn'], ['⌊x⌉', 'f:round', 'fn', 'round', [['round', 'f:round'], ['⌊x⌋', 'f:floor'], ['⌈x⌉', 'f:ceil']]]],
    [P.pow, P.paren, P.sqrt, P.frac, P.pi, P.e,
      ['°→rad', 'f:torad', 'fn', null, [['°→rad', 'f:torad'], ['rad→°', 'f:todeg']]], ['i', 't:i', 'fn m'], P.sci,
      ['Re', 'f:re', 'fn', 'Im · arg', [['Re', 'f:re'], ['Im', 'f:im'], ['arg', 'f:arg'], ['z̄', 'f:conj']]],
      ['sgn', 'f:sgn', 'fn', 'max · min', [['sgn', 'f:sgn'], ['max', 'p:max|,'], ['min', 'p:min|,']]], P.go]),
  tab_trig: [...TRIG_NAMES.map(n => [n, 'f:' + n, 'fn sm']), P.paren, P.x, P.pi, ['°', 'w:^{\\circ}', 'op m', 'Grad'], ['hypot', 'p:hypot|,', 'fn sm', '√(a²+b²)'], P.go],
  tab_calc: layout(
    [['d⁄dx', 'w:\\frac{d}{dx}\\left(\\right)|L', 'fn m', 'DGL', [['d⁄dx', 'w:\\frac{d}{dx}\\left(\\right)|L'], ['d²⁄dx²', 'w:\\frac{d^{2}}{dx^{2}}\\left(\\right)|L'], ['dgl( )', 'p:dgl|'], ["y′", "w:y'"], ["y″", "w:y''"]]],
      ['∫', 'w:\\int_{ }^{ }dx|L|L', 'fn m', 'F(x)', [['∫', 'w:\\int_{ }^{ }dx|L|L'], ['∫ₐᵇ', 'w:\\int_{ }^{ }dx|L|L|L|D'], ['∫_C ds', 'p:kurvenint|,,t,0,1'], ['Bogen', 'p:bogen|,x,0,1'], ['∬', 'p:iint|,x,0,1,y,0,1'], ['∭', 'p:iiint|,x,0,1,y,0,1,z,0,1']]],
      ['lim', 'w:\\lim_{x\\to 0}\\left(\\right)|L', 'fn', 'x→a', [['x→a', 'w:\\lim_{x\\to 0}\\left(\\right)|L'], ['x→∞', 'w:\\lim_{x\\to\\infty}\\left(\\right)|L'], ['x→0⁺', 'w:\\lim_{x\\to 0^{+}}\\left(\\right)|L'], ['stetig?', 'p:stetig|'], ['stetig x₀', 'p:stetig|,0']]],
      ['Σ', 'w:\\sum_{k=1}^{n}\\left(\\right)|L', 'fn m', null, [['Σ', 'w:\\sum_{k=1}^{n}\\left(\\right)|L'], ['Σ∞', 'w:\\sum_{k=1}^{\\infty}\\left(\\right)|L']]],
      ['Π', 'w:\\prod_{k=1}^{n}\\left(\\right)|L', 'fn m'], ['Taylor', 'p:taylor|,x,0,5', 'fn', 'Kurven', [['Taylor', 'p:taylor|,x,0,5'], ['param', 'p:param|,t,0,2pi'], ['polar', 'p:polar|,t'], ['3D', 'p:surface|'], ['r·e^iφ', 'p:polarform|']]]],
    [OPS4, FNKEY, ['∞', 'c:\\infty', 'fn m'],
      P.pow, P.paren, P.sqrt, P.frac, P.pi, P.e, ['ln', 'f:ln', 'fn'], ['t(x)', 'p:tangent|,x,1', 'fn', 'f′(x₀)'], P.go]),
  tab_seq: layout(
    [['aₙ', 'p:folge|,1,10', 'fn m', 'Folge', [['aₙ', 'p:folge|,1,10'], ['aₙ (n₀…n₁)', 'p:folge|,,']]],
      ['Σ∞', 'p:reihe|', 'fn m', 'Reihe', [['Σ∞', 'p:reihe|'], ['Σₖ₌ₙ₀', 'p:reihe|,0']]],
      ['aₙ₊₁', 'p:rekursiv|,1,10', 'fn m', 'rekursiv'],
      ['1,4,9', 'p:muster|', 'fn sm', 'Muster'],
      ['lim', 'w:\\lim_{n\\to\\infty}\\left(\\right)|L', 'fn', 'n→∞'],
      ['Σ', 'w:\\sum_{k=1}^{n}\\left(\\right)|L', 'fn m', null, [['Σ', 'w:\\sum_{k=1}^{n}\\left(\\right)|L'], ['Σ∞', 'w:\\sum_{k=1}^{\\infty}\\left(\\right)|L']]]],
    [['n', 't:n', 'fn m', null, [['n', 't:n'], ['k', 't:k'], ['a', 't:a'], ['q', 't:q'], ['d', 't:d']]], P.pow, P.paren,
      P.frac, P.sqrt, ['n!', 't:!', 'fn m'],
      ['(−1)ⁿ', 'w:\\left(-1\\right)^{n}', 'fn sm', null, [['(−1)ⁿ', 'w:\\left(-1\\right)^{n}'], ['(−1)ⁿ⁺¹', 'w:\\left(-1\\right)^{n+1}']]], P.e, ['∞', 'c:\\infty', 'fn m'],
      P.cmp, ['|x|', 'c:|', 'fn m'], P.go]),
  tab_alg: layout(
    [['solve', 'p:solve|,x', 'fn', null, [['solve', 'p:solve|,x'], ['LGS', 'p:solve|,']]], ['expand', 'f:expand', 'fn'], ['factor', 'f:factor', 'fn'],
      ['simplify', 'f:simplify', 'fn', null, [['simplify', 'f:simplify'], ['apart', 'p:apart|,x']]], ['ggT', 'p:gcd|,', 'fn', 'gcd', [['ggT', 'p:gcd|,'], ['kgV', 'p:lcm|,']]], P.paren],
    [OPS.add, P.pow, P.sqrt, OPS.sub, P.pi, P.cmp, OPS.mul, ['a', 't:a', 'fn m', null, [['a', 't:a'], ['b', 't:b'], ['c', 't:c']]], P.eq, OPS.div, P.frac, P.go]),
  tab_mat: layout(
    [['2×2', 'MX:2x2', 'fn', 'Matrix', [['2×2', 'MX:2x2'], ['3×3', 'MX:3x3'], ['2×3', 'MX:2x3'], ['3×2', 'MX:3x2']]],
      ['v', 'MX:v3', 'fn m', 'Vektor 3D', [['3D', 'MX:v3'], ['2D', 'MX:v2'], ['4D', 'MX:v4']]],
      ['det', 'f:det', 'fn'], ['tr', 'f:trace', 'fn', 'Spur'], ['A⁻¹', 'f:inv', 'fn'], ['[ ]', 'c:[', 'op m']],
    [['E', 'p:identity|3', 'fn m', 'E₃', [['E₂', 'p:identity|2'], ['E₃', 'p:identity|3'], ['E₄', 'p:identity|4']]], ['Aᵀ', 'f:transpose', 'fn'], ['rref', 'f:rref', 'fn', 'Gauß'],
      ['rang', 'f:rank', 'fn', 'rank'], ['eig', 'f:eig', 'fn', 'λ'], ['A·B', 'c:\\cdot', 'fn m', '+ − · × ⟨⟩', [['·', 'c:\\cdot'], ['+', 't:+'], ['−', 't:-'], ['a·b', 'p:dot|,'], ['a×b', 'p:cross|,']]],
      ['∠', 'p:angle|,', 'fn m', 'Winkel'], ['|v|', 'f:norm', 'fn', 'Länge'], [':=', 't::=', 'op m', null, [[':=', 't::='], ['=', 't:=']]],
      ['A', 't:A', 'fn m', null, [['A', 't:A'], ['B', 't:B'], ['C', 't:C']]], ['∇', 'p:grad|', 'fn m', 'grad div rot', [['grad', 'p:grad|'], ['div', 'p:div|'], ['rot', 'p:rot|'], ['Δ', 'p:laplace|'], ['diag', 'f:diag']]], P.go]),
  tab_stat: layout(
    [['(ⁿₖ)', 'c:\\binom', 'fn m', 'nCr', [['nCr', 'c:\\binom'], ['nPr', 'p:nPr|,']]], ['n!', 't:!', 'fn m'],
      ['B(n,p,k)', 'p:binomPdf|,,', 'fn', 'P(X=k)', [['P(X=k)', 'p:binomPdf|,,'], ['P(X≤k)', 'p:binomCdf|,,']]],
      ['Φ', 'p:normCdf|,,0,1', 'fn m', 'N(μ,σ)'], ['x̄', 'f:mean', 'fn m', 'mean', [['x̄', 'f:mean'], ['x̃', 'f:median']]], P.paren],
    [['W', 'p:pctval|,', 'fn', 'p % v. G'], ['p %', 'p:pctrate|,', 'fn', 'W / G'], ['%', 't:%', 'op'], ['Δ %', 'p:pctchg|,', 'fn', 'alt→neu'], ['G', 'p:pctbase|,', 'fn', 'W, p'], P.sqrt,
      SKEY, P.frac, ['Modus', 'f:mode', 'fn sm', 'mode'], ['Q', 'p:quantile|,0.25', 'fn m', 'Quantil'], ['Regr.', 'MX:reg', 'fn', 'y = f(x)', [['Regr.', 'MX:reg'], ['rand', 'p:randInt|1,6']]], P.go]),
  tab_const: [
    ['π', 'c:\\pi', 'fn m', '3,14159…'], ['e', 't:e', 'fn m', '2,71828…'], ['i', 't:i', 'fn m', '√−1'], ['φ', 'w:\\text{φ}', 'fn m', '1,618…'], ['c', 'w:\\text{c}', 'fn m', 'm/s'], ['g', 'w:\\text{g}', 'fn m', 'm/s²', [['g', 'w:\\text{g}'], ['G', 'w:\\text{G}']]],
    ['Nₐ', 'w:\\text{N}_{\\text{A}}', 'fn m', '1/mol'], ['k_B', 'w:\\text{k}_{\\text{B}}', 'fn m', 'J/K'], ['R', 'w:\\text{R}', 'fn m', 'J/(mol·K)'], ['F', 'w:\\text{F}', 'fn m', 'C/mol'], ['e⁻', 'w:\\text{e}', 'fn m', 'C'], ['h', 'w:\\text{h}', 'fn m', 'J·s', [['h', 'w:\\text{h}'], ['ħ', 'w:\\text{ħ}']]],
    ['mₑ', 'w:\\text{m}_{\\text{e}}', 'fn m', 'kg', [['mₑ', 'w:\\text{m}_{\\text{e}}'], ['mₚ', 'w:\\text{m}_{\\text{p}}'], ['u', 'w:\\text{u}']]], ['ε₀', 'w:\\text{ε}_{\\text{0}}', 'fn m', 'F/m'], ['μ₀', 'w:\\text{μ}_{\\text{0}}', 'fn m', 'N/A²'],
    ['Vₘ', 'w:\\text{V}_{\\text{m}}', 'fn m', 'm³/mol'], ['p₀', 'w:\\text{p}_{\\text{0}}', 'fn m', 'Pa'], ['σ', 'w:\\text{σ}', 'fn m', 'W/(m²K⁴)'],
    ['T₀', 'w:\\text{T}_{\\text{0}}', 'fn m', 'K'], ['a₀', 'w:\\text{a}_{\\text{0}}', 'fn m', 'm'], P.pow, P.paren, P.frac, P.go
  ],
  tab_custom: []
};
const TABS = Object.keys(KEYS);

/* ---------- Buchstaben-Tastatur (lateinisch / griechisch, letzte Wahl wird gemerkt) ---------- */
const GR_LOWER = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'varepsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ο: null, π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'varphi', χ: 'chi', ψ: 'psi', ω: 'omega' };
const GR_UPPER = { Α: 'A', Β: 'B', Γ: '\\Gamma', Δ: '\\Delta', Ε: 'E', Ζ: 'Z', Η: 'H', Θ: '\\Theta', Ι: 'I', Κ: 'K', Λ: '\\Lambda', Μ: 'M', Ν: 'N', Ξ: '\\Xi', Ο: 'O', Π: '\\Pi', Ρ: 'P', Σ: '\\Sigma', Τ: 'T', Υ: '\\Upsilon', Φ: '\\Phi', Χ: 'X', Ψ: '\\Psi', Ω: '\\Omega' };
let abcLang = store.get('abcLang', 'lat');
function grKey(ch) {
  if (shift) {
    const U = ch.toUpperCase(), m = GR_UPPER[U];
    return [U, m && m.startsWith('\\') ? 'c:' + m : 't:' + (m || U), ''];
  }
  const m = GR_LOWER[ch];
  return [ch, m ? 'c:\\' + m : 't:o', ''];
}
function abcRows() {
  const rows = [];
  const bottom = [
    [abcLang === 'gr' ? 'abc' : 'αβγ', 'GREEK', 'op lang'], ['( )', 'c:(', 'op m', null, P.paren[4]], P.eq, DECK,
    OPS.add, OPS.sub, ['·', 'c:\\cdot', 'op m'], ['^', 'c:^', 'op m'], ['/', 't:/', 'op m'], P.go];
  if (abcLang === 'gr') {
    'αβγδεζηθικ'.split('').forEach(c => rows.push(grKey(c)));
    'λμνξοπρστυ'.split('').forEach(c => rows.push(grKey(c)));
    rows.push(['⇧', 'SHIFT', 'op wide' + (shift ? ' on' : '')]);
    'φχψω'.split('').forEach(c => rows.push(grKey(c)));
    rows.push(['∞', 'c:\\infty', 'op m'], ["'", "t:'", 'op'], ['_', 't:_', 'op'], ['!', 't:!', 'op']);
  } else {
    const L = S.lang === 'de' ? ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'] : S.lang === 'fr' ? ['azertyuiop', 'qsdfghjklm', 'wxcvbn'] : ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    const k = ch => { const c = shift ? ch.toUpperCase() : ch; return [c, 't:' + c, '']; };
    L[0].split('').forEach(c => rows.push(k(c)));
    const r2 = L[1].split('').map(k); if (r2.length < 10) r2.push(['_', 't:_', 'op']); rows.push(...r2);
    rows.push(['⇧', 'SHIFT', 'op wide' + (shift ? ' on' : '')]);
    rows.push(...L[2].split('').map(k));
    const pad = [["'", "t:'", 'op'], ['_', 't:_', 'op'], ['!', 't:!', 'op']].filter(p => !rows.some(r => r[1] === p[1]));
    let used = rows.reduce((n, r) => n + (/\bwide\b/.test(r[2] || '') ? 2 : 1), 0);
    while (used % 10 && pad.length) { rows.push(pad.shift()); used++; }
  }
  return rows.concat(bottom);
}
let curTab = store.get('tab', 'tab_basic'); if (!KEYS[curTab]) curTab = 'tab_basic';
let mode = 'tab'; // tab | abc | recent
let shift = false;
let RECENT = store.get('recentKeys', []);
let CUSTOM = store.get('customKeys', []);
let KEYORDER = store.get('keyOrder', {});
if (!store.get('kpLayout19', false)) { delete KEYORDER.tab_basic; delete KEYORDER.tab_alg; delete KEYORDER.tab_calc; store.set('keyOrder', KEYORDER); store.set('kpLayout19', true); }
if (!store.get('kpLayout18', false)) { KEYORDER = KEYORDER.tab_custom ? { tab_custom: KEYORDER.tab_custom } : {}; store.set('keyOrder', KEYORDER); store.set('kpLayout18', true); }
let editMode = false, editSel = -1;
function getOrder(tab, n) {
  const o = KEYORDER[tab];
  if (Array.isArray(o) && o.length === n && o.every(i => i >= 0 && i < n) && new Set(o).size === n) return o.slice();
  return [...Array(n).keys()];
}
function swapKeys(p1, p2) {
  const base = curTab === 'tab_custom' ? customList() : KEYS[curTab];
  const o = getOrder(curTab, base.length);
  [o[p1], o[p2]] = [o[p2], o[p1]];
  KEYORDER[curTab] = o; store.set('keyOrder', KEYORDER);
}

const ICON_RECENT = '<svg viewBox="0 0 24 24"><path d="M4.2 13.2A8 8 0 1 0 6.3 6.3"/><path d="M6.6 2.8v3.8h3.8"/><path d="M12 8v4.2l2.8 1.8"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 24 24"><path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7Z"/><path d="m11.5 9.5 5 5m0-5-5 5"/></svg>';
const TOOLS = [
  ['abc', 'ABC', 'tool'], ['', 'RECENT', 'tool', ICON_RECENT], ['←', 'LEFT', 'tool rep'], ['→', 'RIGHT', 'tool rep'], ['AC', 'CLEAR', 'tool'], ['', 'BACK', 'tool rep', ICON_BACK]
];
function makeKey(def) {
  const [lbl, act, cls = '', sub, vars, tex] = def;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'key ' + (cls || '').replace(/\bm\b/, '') + (vars && vars.length ? ' more' : '');
  b._def = def;
  let label = lbl;
  if (act === 'DEC') label = S.dec;
  if (act === 'ARG') label = S.dec === ',' ? ';' : ',';
  const l = document.createElement('span'); l.className = 'lbl' + (/\bm\b/.test(cls || '') ? ' m' : '');
  b.appendChild(l);
  if (!label && tex) { l.classList.add('tex'); render(l, K.decFix(tex), false); }
  else if (label === 'a⁄b') l.innerHTML = FRAC_HTML;
  else if (label === 'OPS4') l.innerHTML = '<span class="kops4"><i>+</i><i>−</i><i>×</i><i>÷</i></span>';
  else l.textContent = label;
  if (sub) { const s = document.createElement('small'); s.textContent = S.dec === '.' ? sub.replace(/(\d),(\d)/g, '$1.$2') : sub; b.appendChild(s); }
  return b;
}
const FRAC_HTML = '<span class="kfrac"><i>a</i><i>b</i></span>';
const varLabel = (l, a) => a === 'DEC' ? S.dec : a === 'ARG' ? (S.dec === ',' ? ';' : ',') : l;
function buildTools() {
  const el = $('#tools'); el.replaceChildren();
  TOOLS.forEach(([lbl, act, cls, icon]) => {
    const b = makeKey([lbl, act, cls]);
    if (icon) b.firstChild.innerHTML = icon;
    if (act === 'ABC') { b.firstChild.textContent = mode === 'abc' ? '123' : (abcLang === 'gr' ? 'αβγ' : 'abc'); b.classList.toggle('on', mode === 'abc'); b.ariaLabel = T('letters'); }
    if (act === 'RECENT') { b.classList.toggle('on', mode === 'recent'); b.ariaLabel = b.title = T('recent_keys'); }
    if (act === 'LEFT') b.ariaLabel = '←'; if (act === 'RIGHT') b.ariaLabel = '→'; if (act === 'BACK') b.ariaLabel = '⌫';
    el.appendChild(b);
  });
}
function buildTabs() {
  const el = $('#tabs'); el.replaceChildren();
  TABS.forEach(k => {
    const b = document.createElement('button');
    b.className = 'tab'; b.type = 'button'; b.role = 'tab'; b.textContent = T(k);
    b.setAttribute('aria-selected', mode === 'tab' && k === curTab);
    b.onclick = () => { switchTab(k); };
    el.appendChild(b);
  });
  const sel = el.querySelector('[aria-selected="true"]');
  if (sel) { const r = sel.getBoundingClientRect(), er = el.getBoundingClientRect(); if (r.left < er.left || r.right > er.right) el.scrollLeft += r.left - er.left - 30; }
}
function customList() {
  const list = CUSTOM.map((c, i) => [c[0], c[1], c[2] || 'fn', c[3], [...(c[4] && c[4].length ? c[4] : [[c[0] || 'ƒ', c[1]]]), ['✕', 'DELKEY:' + i]], c[5]]);
  while (list.length < 29) list.push(['+', 'ADDKEY', 'addkey']);
  return list.slice(0, 29).concat([P.go]);
}
function buildKeys() {
  const el = $('#keys'); el.replaceChildren();
  el.classList.toggle('abc', mode === 'abc');
  let list;
  if (mode === 'abc') list = abcRows();
  else if (mode === 'recent') {
    list = RECENT.slice(0, 23);
    if (!list.length) { const n = document.createElement('div'); n.className = 'empty-note'; n.textContent = T('recent_empty'); el.appendChild(n); return; }
    list = list.concat([P.go]);
  } else {
    const base = curTab === 'tab_custom' ? customList() : KEYS[curTab];
    list = getOrder(curTab, base.length).map(i => base[i]);
  }
  el.classList.toggle('editing', editMode && mode === 'tab');
  list.forEach((def, i) => { const k = makeKey(def); if (editMode && i === editSel) k.classList.add('pick'); el.appendChild(k); });
}
function switchTab(k, dir = 0) {
  mode = 'tab'; curTab = k; store.set('tab', k); editSel = -1;
  const el = $('#keys');
  if (dir && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.remove('slide'); el.style.transform = `translateX(${dir * 40}px)`; el.style.opacity = '.3';
    buildKeys(); void el.offsetWidth; el.classList.add('slide'); el.style.transform = ''; el.style.opacity = '';
  } else { el.style.transform = ''; buildKeys(); }
  buildTools(); buildTabs();
}

/* ---------- Eingaben ausführen ---------- */
function exec(act) {
  if (!act) return;
  const F = ACTIVE;
  if (act.startsWith('W:')) { focusEd(); F.write(act.slice(2)); return onEdit(); }
  if (act === 'MX:reg') return mxOpen({ r: 5, c: 2, reg: true });
  if (act.startsWith('MX:')) { const m = act.slice(3); return mxOpen(m[0] === 'v' ? { vec: true, r: +m.slice(1), c: 1 } : { r: +m.split('x')[0], c: +m.split('x')[1] }); }
  if (act.startsWith('DELKEY:')) { CUSTOM.splice(+act.slice(7), 1); store.set('customKeys', CUSTOM); delete KEYORDER.tab_custom; store.set('keyOrder', KEYORDER); return buildKeys(); }
  switch (act) {
    case 'GO': if (F !== mf && F._enter) return F._enter(); return compute();
    case 'BACK': focusEd(); F.keystroke('Backspace'); return onEdit();
    case 'LEFT': case 'RIGHT': {
      // am Rand eines Feldes in das Nachbarfeld springen (Matrix-Zellen, Bereichs- und Grenzfelder)
      const dir = act === 'LEFT' ? -1 : 1, grp = fieldGroup(F), cur = F.__controller.cursor;
      const atEdge = cur.parent === F.__controller.root && !cur[dir];
      if (grp && atEdge) { const nb = grp[grp.indexOf(F) + dir]; if (nb) { setActive(nb); focusEd(); dir < 0 ? nb.moveToRightEnd() : nb.moveToLeftEnd(); keepCursor(); return; } }
      focusEd(); F.keystroke(dir < 0 ? 'Left' : 'Right'); return onEdit();
    }
    case 'CLEAR': F.latex(''); focusEd(); return onEdit();
    case 'SHIFT': shift = !shift; return buildKeys();
    case 'GREEK': abcLang = abcLang === 'gr' ? 'lat' : 'gr'; store.set('abcLang', abcLang); shift = false; buildTools(); return buildKeys();
    case 'ABC': mode = mode === 'abc' ? 'tab' : 'abc'; shift = false; setEdit(false); buildTools(); buildTabs(); return buildKeys();
    case 'RECENT': mode = mode === 'recent' ? 'tab' : 'recent'; setEdit(false); buildTools(); buildTabs(); return buildKeys();
    case 'ADDKEY': return openAddKey(arguments[1]);
    case 'DEC': focusEd(); F.typedText(S.dec); return onEdit();
    case 'ARG': focusEd(); F.typedText(S.dec === ',' ? ';' : ','); return onEdit();
  }
  focusEd();
  const [main, ...moves] = act.split('|');
  const kind = main.slice(0, 1), body = main.slice(2);
  if (kind === 't') F.typedText(body);
  else if (kind === 'c') F.cmd(body);
  else if (kind === 'w') F.write(body);
  else if (kind === 'f') { writeFn(body, F); F.cmd('('); }
  else if (kind === 'p') {
    writeFn(body, F);
    const a = moves[0] || '';
    F.write('\\left(' + (S.dec === ',' ? a.replace(/,/g, ';') : a) + '\\right)');
    F.keystroke('Left'); F.keystroke('Home');
    onEdit(); return;
  }
  for (const m of moves) F.keystroke({ L: 'Left', R: 'Right', H: 'Home', D: 'Down', U: 'Up' }[m] || m);
  if (shift && (kind === 't' || kind === 'c') && mode === 'abc') { shift = false; buildKeys(); }
  onEdit();
}
function writeFn(name, F = ACTIVE) {
  if (['sin', 'cos', 'tan', 'ln', 'log', 'exp', 'det', 'sinh', 'cosh', 'tanh'].includes(name)) F.cmd('\\' + name);
  else F.write('\\operatorname{' + name + '}');
}
function remember(def) {
  const [, act] = def;
  if (!act || /^(GO|BACK|LEFT|RIGHT|CLEAR|SHIFT|ABC|RECENT|DEC|ARG|GREEK|ADDKEY)$/.test(act) || /^(DELKEY|W:)/.test(act) || /^t:\d$/.test(act) || mode === 'abc') return;
  RECENT = [def, ...RECENT.filter(x => x[1] !== act)].slice(0, 23);
  store.set('recentKeys', RECENT);
}

/* ---------- Eigene Tasten anlegen ---------- */
function placeNewCustom(pos) {
  if (pos === undefined || pos < 0) return;
  const base = customList(), o = getOrder('tab_custom', base.length), c = CUSTOM.length - 1, q = o.indexOf(c);
  if (q >= 0 && q !== pos) { [o[pos], o[q]] = [o[q], o[pos]]; KEYORDER.tab_custom = o; store.set('keyOrder', KEYORDER); }
}
function openAddKey(pos) {
  openSheet(T('add_key'), body => {
    const tex = mf.latex();
    const f1 = el('div', 'field'); f1.appendChild(el('div', 'flabel', T('use_input')));
    if (tex.trim()) {
      const pv = el('div', 'key-preview'); f1.appendChild(pv); render(pv, K.decFix(tex), false);
      const inp = el('input', 'txt'); inp.id = 'keyLabel'; inp.placeholder = T('key_label'); inp.maxLength = 12; f1.appendChild(inp);
      f1.appendChild(btn(T('save_key'), null, () => {
        CUSTOM.push([inp.value.trim(), 'W:' + tex, 'fn', null, null, tex]); store.set('customKeys', CUSTOM); placeNewCustom(pos);
        closeSheet(); switchTab('tab_custom');
      }, 'btn primary'));
    } else f1.appendChild(el('div', 'sub', T('input_empty')));
    body.appendChild(f1);
    body.appendChild(el('p', 'ex-note', T('from_catalog')));
    const seen = new Set();
    for (const tab of TABS) {
      if (tab === 'tab_custom') continue;
      const defs = KEYS[tab].filter(k => !/^(GO|DEC|ARG)$/.test(k[1]) && !/^t:\d$/.test(k[1]) && !seen.has(k[1]));
      if (tab === 'tab_basic') defs.push(P.x);
      if (!defs.length) continue;
      const g = el('div', 'ex-group'); g.appendChild(el('h3', null, T(tab)));
      const wrap = el('div', 'ex cat');
      defs.forEach(k => {
        seen.add(k[1]);
        const b = el('button', null, varLabel(k[0], k[1])); b.type = 'button';
        if (k[0] === 'a⁄b') b.innerHTML = FRAC_HTML;
        b.onclick = () => { CUSTOM.push([k[0], k[1], k[2], k[3], k[4]]); store.set('customKeys', CUSTOM); placeNewCustom(pos); closeSheet(); switchTab('tab_custom'); };
        wrap.appendChild(b);
      });
      g.appendChild(wrap); body.appendChild(g);
    }
  });
}

function setEdit(on) {
  editMode = on; editSel = -1;
  $('#editBtn').classList.toggle('on', on); $('#editBtn').setAttribute('aria-pressed', on);
  $('#resetOrder').hidden = !on;
  if (on) { if (mode !== 'tab') { mode = 'tab'; buildTools(); buildTabs(); } toast(T('edit_hint')); }
  buildKeys();
}
$('#editBtn').onclick = () => setEdit(!editMode);
$('#resetOrder').onclick = () => { delete KEYORDER[curTab]; store.set('keyOrder', KEYORDER); editSel = -1; buildKeys(); };

/* ---------- Zeiger: Tippen, Gedrückthalten (Menü), Wischen ---------- */
(function pointer() {
  const pad = $('#keypad'), pop = $('#pop');
  let st = null; // { key, def, x, y, t0, timer, popOpen, opts, hi, swipe, rep }
  const HOLD = 380;
  pad.addEventListener('contextmenu', e => e.preventDefault());
  pad.addEventListener('touchmove', e => { if (st) e.preventDefault(); }, { passive: false });
  pad.addEventListener('pointerdown', e => {
    const key = e.target.closest('.key');
    if (!key || e.button > 0) return;
    e.preventDefault(); // Fokus im Editor behalten
    try { pad.setPointerCapture(e.pointerId); } catch (er) { }
    key.classList.add('down');
    st = { key, def: key._def, x: e.clientX, y: e.clientY, id: e.pointerId, inKeys: !!key.closest('#keys') };
    if (editMode && st.inKeys && mode === 'tab') { st.edit = true; st.pos = [...$('#keys').children].indexOf(key); key.classList.add('pick'); return; }
    const vars = st.def[4];
    if (vars && vars.length) st.timer = setTimeout(() => openPop(), HOLD);
    else if (/\brep\b/.test(st.def[2] || '')) {
      exec(st.def[1]); st.fired = true;
      st.timer = setTimeout(() => { st && (st.rep = setInterval(() => exec(st.def[1]), 70)); }, 420);
    }
  });
  function openPop() {
    if (!st) return;
    const vars = st.def[4];
    pop.replaceChildren();
    vars.forEach(([l, a]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = varLabel(l, a); if (/^DELKEY/.test(a)) b.classList.add('del'); pop.appendChild(b); });
    const cols = st.def[6] || 0; st.grid = cols > 0;
    pop.classList.toggle('grid', st.grid); pop.style.gridTemplateColumns = st.grid ? `repeat(${cols}, auto)` : '';
    pop.hidden = false;
    const kr = st.key.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = kr.left + kr.width / 2 - pw / 2;
    left = Math.max(8, Math.min(window.innerWidth - pw - 8, left));
    pop.style.left = left + 'px'; pop.style.top = Math.max(8, kr.top - ph - 8) + 'px';
    st.popOpen = true; st.opts = [...pop.children];
    // Hauptvariante vorauswählen
    let hi = vars.findIndex(v => v[1] === st.def[1]); if (hi < 0) hi = 0;
    highlight(hi);
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) { }
  }
  function highlight(i) { st.hi = i; st.opts.forEach((o, j) => o.classList.toggle('hi', j === i)); }
  pad.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    if (st.edit) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10) st.dragged = true;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const tk = t && t.closest('#keys .key');
      $('#keys').querySelectorAll('.target').forEach(x => x.classList.remove('target'));
      if (tk && tk !== st.key && st.dragged) { tk.classList.add('target'); st.target = tk; } else st.target = null;
      return;
    }
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (st.popOpen) {
      if (st.grid) { // zweidimensional: nächstgelegene Zelle in x und y (Finger-Versatz nach oben)
        if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 10 && !st.slid) return;
        st.slid = true;
        let best = st.hi, bd = Infinity;
        st.opts.forEach((o, j) => { const r = o.getBoundingClientRect(); const dd = Math.hypot(e.clientX - (r.left + r.width / 2), (e.clientY - 34) - (r.top + r.height / 2)); if (dd < bd) { bd = dd; best = j; } });
        if (best !== st.hi && navigator.vibrate) try { navigator.vibrate(4); } catch (er) { }
        highlight(best); return;
      }
      if (Math.abs(e.clientX - st.x) < 12 && !st.slid) return; // nur hoch/runter: Auswahl bleibt
      st.slid = true;
      let best = st.hi, bd = Infinity;
      st.opts.forEach((o, j) => { const r = o.getBoundingClientRect(); const c = r.left + r.width / 2; const dd = Math.abs(e.clientX - c); if (dd < bd) { bd = dd; best = j; } });
      highlight(best);
      return;
    }
    if (!st.swipe && st.inKeys && mode === 'tab' && !editMode && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      st.swipe = true; clearTimeout(st.timer); st.key.classList.remove('down');
      $('#keys').classList.remove('slide');
    }
    if (st.swipe) { $('#keys').style.transform = `translateX(${dx * 0.6}px)`; $('#keys').style.opacity = String(Math.max(.4, 1 - Math.abs(dx) / 400)); return; }
    if (Math.hypot(dx, dy) > 18 && !st.fired) { clearTimeout(st.timer); st.moved = true; }
  });
  const end = e => {
    if (!st || e.pointerId !== st.id) return;
    clearTimeout(st.timer); clearInterval(st.rep);
    st.key.classList.remove('down');
    if (st.edit) {
      const s2 = st; st = null;
      const kids = [...$('#keys').children];
      if (s2.target && e.type === 'pointerup') { swapKeys(s2.pos, kids.indexOf(s2.target)); editSel = -1; }
      else if (!s2.dragged && e.type === 'pointerup') {
        if (editSel >= 0 && editSel !== s2.pos) { swapKeys(editSel, s2.pos); editSel = -1; }
        else editSel = editSel === s2.pos ? -1 : s2.pos;
      }
      return buildKeys();
    }
    const s = st; st = null;
    if (s.popOpen) {
      pop.hidden = true;
      if (s.hi >= 0 && e.type === 'pointerup') { const v = s.def[4][s.hi]; exec(v[1]); remember([v[0], v[1], s.def[2], null, null]); }
      return;
    }
    if (s.swipe) {
      const dx = e.clientX - s.x, i = TABS.indexOf(curTab), el = $('#keys');
      el.classList.add('slide');
      if (Math.abs(dx) > 60 && e.type === 'pointerup') {
        const dir = dx < 0 ? 1 : -1, rtl = document.documentElement.dir === 'rtl';
        const ni = (i + (rtl ? -dir : dir) + TABS.length) % TABS.length;
        switchTab(TABS[ni], dx < 0 ? 1 : -1);
      } else { el.style.transform = ''; el.style.opacity = ''; }
      return;
    }
    if (s.fired || s.moved || e.type !== 'pointerup') return;
    if (s.def[1] === 'ADDKEY') return exec('ADDKEY', [...$('#keys').children].indexOf(s.key));
    exec(s.def[1]); remember(s.def);
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  // Tastatur-Bedienung (Enter/Leertaste auf fokussierter Taste)
  pad.addEventListener('click', e => { if (e.detail !== 0) return; const key = e.target.closest('.key'); if (key) { exec(key._def[1]); remember(key._def); } });
})();

/* =========================================================
   Rechnen
   ========================================================= */
let LAST = null, stepsOpen = S.stepsAuto, forceSteps = false;
const ENGINE_TEX = new Set(['iint', 'iiint', 'int2', 'int3', 'grad', 'div', 'rot', 'curl', 'laplace', 'regr', 'regression', 'fit', 'extrema', 'extrema2', 'dgl', 'ode', 'polarform', 'param', 'polar', 'plot3d', 'surface', 'kurve', 'stetig', 'kurvenint', 'bogen', 'lineint', 'arclen', 'continuous', 'folge', 'reihe', 'rekursiv', 'muster', 'seq', 'series', 'recseq', 'pattern', 'tangent', 'det', 'inv', 'rref', 'rank', 'transpose', 'trace', 'cross', 'dot', 'norm', 'eig', 'matrix', 'diff', 'integrate', 'limit', 'sum', 'prod', 'taylor', 'nCr', 'nPr', 'fact', 'binomPdf', 'binomCdf', 'normCdf', 'mean', 'median', 'var', 'std', 'gcd', 'lcm', 'pctval', 'pctrate', 'pctbase', 'pctchg', 'deg2rad', 'rad2deg', 'torad', 'todeg']);
function compute(canonIn, texIn) {
  let canon, tex;
  if (canonIn !== undefined) { canon = canonIn; setEditorText(canon); tex = texIn || ED.embedTo(mf.latex(), ED.mxPmat); }
  else {
    tex = ED.embedTo(mf.latex(), ED.mxPmat);
    if (!tex.trim()) return;
    try { canon = ED.latexToText(tex, S.dec); } catch (e) { return showError(tex, e); }
  }
  if (!canon.trim()) return;
  let res;
  try { res = K.run(toDisp(canon)); if (!res) return; } catch (e) { return showError(tex, e); }
  res.raw = canon; res.edTex = tex;
  if (!ENGINE_TEX.has(res.kind) && res.kind !== 'def') res.inTex = K.decFix(tex);
  if (res.kind === 'def') saveVars();
  LAST = res; stepsOpen = S.stepsAuto || forceSteps; forceSteps = false;
  showResult(res);
  addHistory(canon, tex, res);
  renderRecent();
  $('#analysis').hidden = true;
  if (!res.surf) $('#surfcard').hidden = true;
  if (res.regPts) openGraph({ plot: res.plot, pts: res.regPts.map(p => ({ ...p, tex: `${p.lab}(${p.xt}|${p.yt})` })) });
  else if (res.curves) openGraph(res);
  else if (res.surf) { if (/extrema/.test(res.raw || '')) SF.opt.ext = true; openSurf(res.surf.fM, res.surf.R); }
  else if (res.kind === 'fns') openGraph(res);
  else if (!$('#graphcard').hidden && (res.plot || anFnsOf(res))) openGraph(res);
  else if (!$('#graphcard').hidden && G.mode === 'cx' && res.cpts) openComplex(res.cpts);
  if (window.matchMedia('(max-width: 979px)').matches) $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(label, icon, onclick, cls = 'btn') {
  const b = el('button', cls); b.type = 'button';
  if (icon) b.insertAdjacentHTML('afterbegin', icon);
  b.appendChild(el('span', null, label)); b.onclick = onclick; return b;
}
const IC = {
  graph: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M6 15c2.5-7 4.5-7 6 0s4 5 6-6"/></svg>',
  an: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/><path d="M8.5 12.5c1-3 2-3 3 0s1.8 2 2.6-1"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  steps: '<svg viewBox="0 0 24 24"><path d="M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10"/></svg>',
  cx: '<svg viewBox="0 0 24 24"><path d="M3 12h18M12 3v18"/><path d="M12 12l5-6"/><circle cx="17" cy="6" r="1.6" fill="currentColor"/></svg>'
};
function showResult(res, example = false) {
  const box = $('#result'); box.classList.remove('err'); box.replaceChildren();
  const head = el('div', 'res-head');
  head.appendChild(el('span', 'label', T('result')));
  if (example) head.appendChild(el('span', 'badge', T('examples')));
  if (res.fnExpr) head.appendChild(el('span', 'badge', T('fn_detected')));
  box.appendChild(head);
  const inT = el('div', 'in-tex'); box.appendChild(inT); render(inT, res.inTex || '', true);
  const row = el('div', 'out-row'); row.appendChild(el('span', 'eq', res.kind === 'def' ? '✓' : '='));
  const multi = /\\\\|pmatrix|aligned|array|\\begin/.test(res.outTex || '');
  const out = el('div', 'out-tex'); const hl = el('span', multi ? 'hl multi' : 'hl'); out.appendChild(hl); row.appendChild(out); box.appendChild(row);
  render(hl, res.outTex || '', true);
  if (res.reg) { const lab = k => T('rgm_' + k); const sg = seg(res.reg.kinds.map(k => [k, lab(k)]), res.reg.cur, k => compute(`regr(${res.reg.args.join(',')},${k})`)); sg.classList.add('scroll', 'rg-seg'); box.appendChild(sg); }
  if (res.approx != null) { const ap = el('div', 'approx'); box.appendChild(ap); render(ap, '\\approx ' + K.fmtVal(res.approx), false); }
  if (res.cpts && res.cpts.length === 1 && Math.abs(res.cpts[0].im) > 1e-14 && !res.noPolar) { const pt = K.polarTex(res.cpts[0].re, res.cpts[0].im); if (pt) { const ap = el('div', 'approx'); box.appendChild(ap); render(ap, '=' + pt, false); } }
  if (res.note) box.appendChild(el('div', 'note', res.note));
  const acts = el('div', 'res-actions');
  const hasSteps = res.steps && res.steps.length;
  const list = el('ol', 'steps');
  let rendered = false;
  const renderSteps = () => {
    if (rendered) return; rendered = true;
    for (const s of res.steps) {
      const li = el('li'); li.appendChild(el('div', 'st-title', s.title));
      if (s.methods) {
        const lab = { pq: T('m_pq'), abc: T('m_abc'), binom: T('m_binom') };
        const sg = seg(s.methods.map(m => [m, lab[m]]), s.method, m => { S.quad = m; saveSettings(); forceSteps = true; if (LAST) compute(LAST.raw); });
        sg.classList.add('st-methods'); li.appendChild(sg);
      }
      if (s.tex) { const t = el('div', 'st-tex'); li.appendChild(t); render(t, s.tex, true); }
      if (s.note) { const d2 = el('div', 'st-detail'); li.appendChild(d2); if (/[\\^_{}]/.test(s.note)) render(d2, s.note, true); else { d2.classList.add('plain'); d2.textContent = s.note; } }
      if (s.sub && s.sub.length) {
        const wrap = el('div', 'st-sub'), ol = el('ol'); let shown = 0;
        const bar = el('div', 'st-subbar');
        const nextB = el('button', 'btn ghost sm', T('sub_explain')); nextB.type = 'button';
        const allB = el('button', 'linkbtn', T('sub_all')); allB.type = 'button';
        const showN = n => {
          while (shown < Math.min(n, s.sub.length)) {
            const u = s.sub[shown++], li2 = el('li'); li2.appendChild(el('div', 'st-title', u.title));
            if (u.tex) { const t2 = el('div', 'st-tex'); li2.appendChild(t2); render(t2, u.tex, true); }
            (u.rows || []).forEach(([lb, tx]) => { const r = el('div', 'sub-row'); r.appendChild(el('span', 'sub-k', lb)); const t3 = el('div', 'st-tex'); r.appendChild(t3); render(t3, tx, false); li2.appendChild(r); });
            ol.appendChild(li2);
          }
          nextB.textContent = T('sub_next') + ' (' + shown + '/' + s.sub.length + ')';
          if (shown >= s.sub.length) { nextB.hidden = true; allB.hidden = true; }
        };
        nextB.onclick = () => showN(shown + 1); allB.onclick = () => showN(s.sub.length);
        bar.appendChild(nextB); bar.appendChild(allB);
        wrap.appendChild(ol); wrap.appendChild(bar); li.appendChild(wrap);
      }
      list.appendChild(li);
    }
  };
  if (hasSteps) {
    const sb = btn(T('steps') + ' · ' + res.steps.length, IC.steps, () => {
      stepsOpen = !stepsOpen; list.hidden = !stepsOpen; if (stepsOpen) renderSteps(); sb.setAttribute('aria-pressed', stepsOpen);
    }, 'btn ghost');
    sb.setAttribute('aria-pressed', stepsOpen); acts.appendChild(sb);
  }
  const an = anFnsOf(res);
  const tg = [];
  const sync = () => tg.forEach(([b, on]) => b.setAttribute('aria-pressed', !!on()));
  const anOn = () => !$('#analysis').hidden, gOn = () => !$('#graphcard').hidden && G.mode === 'fn', cOn = () => !$('#graphcard').hidden && G.mode === 'cx';
  const hideGraph = () => { $('#graphcard').hidden = true; if (ACTIVE !== mf) setActive(mf); };
  if (an) { const b = btn(T('analyze'), IC.an, () => { if (anOn()) { $('#analysis').hidden = true; } else runAnalysis(an, res.fnName ? [res.fnName] : null); sync(); }); tg.push([b, anOn]); acts.appendChild(b); }
  if (res.curves) { const b = btn(T('graph'), IC.graph, () => { if (gOn()) hideGraph(); else openGraph(res); sync(); }); tg.push([b, gOn]); acts.appendChild(b); }
  { let fs3 = null; try { fs3 = res.surf ? res.surf.fM : null; if (!fs3 && res.kind !== 'error') { const c0 = res.raw; const pm = c0 && !/[=<>]|:=/.test(c0) ? K.prepM(c0) : null; if (pm) { const syms = K.freeSyms(pm).sort().join(','); if (syms === 'x,y') fs3 = pm; } } } catch (e) { }
    if (fs3) { const s3 = () => !$('#surfcard').hidden; const b = btn(T('s3_btn'), IC.graph, () => { if (s3()) $('#surfcard').hidden = true; else openSurf(fs3); sync(); }); tg.push([b, s3]); acts.appendChild(b); } }
  if (res.plot || an) { const b = btn(T('graph'), IC.graph, () => { if (gOn()) { hideGraph(); $('#analysis').hidden = true; } else openGraph(res); sync(); }); tg.push([b, gOn]); acts.appendChild(b); }
  if (res.cpts && res.cpts.length) { const b = btn(T('complex_plane'), IC.cx, () => { if (cOn()) hideGraph(); else openComplex(res.cpts); sync(); }); tg.push([b, cOn]); acts.appendChild(b); }
  RESULT_SYNC = sync; setTimeout(sync, 0);
  acts.appendChild(btn(T('copy'), IC.copy, () => copyResult(res)));
  box.appendChild(acts);
  list.hidden = !stepsOpen || !hasSteps; box.appendChild(list);
  if (stepsOpen && hasSteps) renderSteps();
}
let RESULT_SYNC = () => { };
function showError(tex, e) {
  const box = $('#result'); box.classList.add('err'); box.replaceChildren();
  box.appendChild(el('div', 'label', T('error')));
  const inT = el('div', 'in-tex'); box.appendChild(inT); render(inT, K.decFix(tex || ''), true);
  let msg = (e && e.message) || String(e);
  if (/Undefined symbol|Unexpected|Parenthesis|Value expected|Unknown function|is not a function|Char|parse|prefix operator|undefined|null|Cannot read/i.test(msg)) msg = T('err_hint');
  box.appendChild(el('p', 'msg', msg));
  if (msg !== T('err_hint')) box.appendChild(el('p', 'hint', T('err_hint')));
  LAST = null;
}
// Ergebnis als Text: LaTeX → Text
function texToPlain(t) {
  try {
    let s = String(t).replace(/\{,\}/g, '.').replace(/\\cdot 10\^\{(-?\d+)\}/g, 'e$1').replace(/\\approx/g, '≈').replace(/\\quad/g, ' ').replace(/\\;|\\,/g, ' ')
      .replace(/\\mathbb\{L\}=\\\{\\,?\\\}/g, '{}').replace(/\\in/g, ' ∈ ').replace(/\\mathbb\{R\}/g, 'ℝ').replace(/\\cup/g, ' ∪ ').replace(/\\infty/g, '∞').replace(/\\le/g, '<=').replace(/\\ge/g, '>=');
    if (/\\begin\{pmatrix\}/.test(s)) {
      const rows = s.replace(/.*\\begin\{pmatrix\}|\\end\{pmatrix\}.*/g, '').split('\\\\').map(r => r.split('&').map(c => ED.latexToText(c, '.')));
      return toDisp(rows.length > 1 && rows[0].length === 1 ? '[' + rows.map(r => r[0]).join(',') + ']' : '[' + rows.map(r => '[' + r.join(',') + ']').join(',') + ']');
    }
    const parts = s.split(/,\s*(?=[A-Za-z\\λ]+(?:_\{?\d+\}?)?\s*=)/);
    return parts.map(p => toDisp(ED.latexToText(p.replace(/\\text\{([^}]*)\}/g, '$1').replace(/\\left\[/g, '[').replace(/\\right\]/g, ']'), '.')).replace(/\*/g, '·')).join(', ');
  } catch (e) { return String(t); }
}
function copyResult(res) {
  const text = res.approx != null && typeof res.approx === 'number' && /\\(sqrt|frac|pi|ln|log)/.test(res.outTex) === false ? K.fmtReal(res.approx).replace(/\{,\}/g, ',') : texToPlain(res.outTex);
  const done = () => toast(T('copied'));
  try { navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done)); } catch (e) { fallbackCopy(text, done); }
}
function fallbackCopy(text, done) {
  const t = el('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); done(); } catch (e) { } t.remove();
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 1700); }

/* ---------- Kurvendiskussion ---------- */
const anFnsOf = res => res.anFns || (res.fnExpr ? [res.fnExpr] : null);
const KIND_ORDER = [['zero', 'a_zeros_s'], ['y', 'a_yint'], ['max', 'a_max_s'], ['min', 'a_min_s'], ['saddle', 'a_saddle_s'], ['inflect', 'a_inflect']];
function ptChip(p) {
  const b = el('button', 'pt-chip'); b.type = 'button'; b.dataset.pid = p.id;
  b.setAttribute('aria-pressed', !!p.sel);
  b.style.setProperty('--c', `var(${p.fi >= 0 && G.fns[p.fi] ? G.fns[p.fi].color : '--g2'})`);
  render(b, K.decFix(p.tex), false);
  b.onclick = () => togglePt(p.id);
  return b;
}
function togglePt(id, force) {
  const p = G.pts.find(q => q.id === id); if (!p) return;
  p.sel = force !== undefined ? force : !p.sel;
  if (p.sel) G.focus = p;
  document.querySelectorAll(`.pt-chip[data-pid="${id}"]`).forEach(c => c.setAttribute('aria-pressed', p.sel));
  draw(); if (p.sel) showPointInfo(p); else if (G.focus === p) { G.focus = null; showInfo(); }
}
function runAnalysis(list, given) {
  if (!Array.isArray(list)) list = [list];
  list = list.slice(0, 4);
  const NM = nameList(list, given);
  const box = $('#analysis'); box.hidden = false; box.replaceChildren();
  const head = el('div', 'an-head'); head.appendChild(el('h2', null, T('analysis_title')));
  const allBtn = el('button', 'linkbtn', T('mark_all')); allBtn.type = 'button'; head.appendChild(allBtn);
  box.appendChild(head);
  box.appendChild(el('p', 'an-hint', T('pts_hint')));
  const results = [];
  list.forEach((fu, i) => {
    try { results.push(K.analyzeFn(fu, 'x', NM[i])); } catch (e) { results.push(null); }
  });
  // Graph zuerst aufbauen, damit Punkte ihre IDs bekommen
  const pts = [];
  results.forEach((a, i) => a && a.points.forEach(p => pts.push({ ...p, fi: i })));
  let ix = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    try { K.intersect(list[i], list[j]).forEach(p => { if (list.length > 2) { p.lab = 'S_{' + NM[i] + NM[j] + '}'; p.tex = `${p.lab}\\left(${p.xt}\\,|\\,${p.yt}\\right)`; } ix.push({ ...p, fi: -1 }); }); } catch (e) { }
  }
  openGraph({ fnsUser: list, names: NM, pts: pts.concat(ix), keepPts: true }, true);
  results.forEach((a, i) => {
    const sec = el('div', 'an-fn');
    const h = el('div', 'an-fhead'); const dot = el('i'); dot.style.background = `var(${COLORS[i % 4]})`; h.appendChild(dot);
    const ft = el('div', 'an-tex'); h.appendChild(ft); sec.appendChild(h);
    if (!a) { ft.textContent = list[i]; sec.appendChild(el('p', 'msg', T('error'))); box.appendChild(sec); return; }
    render(ft, K.decFix(a.fTex), true);
    for (const [k, key] of KIND_ORDER) {
      const row = el('div', 'an-row'); row.appendChild(el('div', 'k', T(key)));
      const chips = el('div', 'chips');
      const mine = G.pts.filter(p => p.fi === i && p.k === k);
      if (mine.length) mine.forEach(p => chips.appendChild(ptChip(p))); else chips.appendChild(el('span', 'none', T('none')));
      row.appendChild(chips);
      if (k === 'max' && mine.length + G.pts.filter(p => p.fi === i && p.k === 'min').length) row.appendChild(el('div', 'n', T('a_ext_note')));
      sec.appendChild(row);
    }
    for (const b of a.info) {
      const row = el('div', 'an-row'); row.appendChild(el('div', 'k', b.title));
      const v = el('div', 'an-tex'); row.appendChild(v);
      if (b.tex) render(v, K.decFix(b.tex), true); else v.textContent = b.text || '';
      sec.appendChild(row);
    }
    box.appendChild(sec);
  });
  if (list.length > 1) {
    const sec = el('div', 'an-fn');
    const row = el('div', 'an-row'); row.appendChild(el('div', 'k', T('a_ix')));
    const chips = el('div', 'chips');
    const ixs = G.pts.filter(p => p.k === 'ix');
    if (ixs.length) ixs.forEach(p => chips.appendChild(ptChip(p))); else chips.appendChild(el('span', 'none', T('ix_none')));
    row.appendChild(chips); sec.appendChild(row); box.appendChild(sec);
  }
  allBtn.onclick = () => {
    const on = !G.pts.every(p => p.sel);
    G.pts.forEach(p => { p.sel = on; }); G.focus = null;
    document.querySelectorAll('.pt-chip').forEach(c => c.setAttribute('aria-pressed', on));
    allBtn.textContent = on ? T('mark_none') : T('mark_all'); draw(); showInfo();
  };
  $('#graphcard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* =========================================================
   Graph: Funktionen, Punkte, Spur, Flächen, Zahlenebene
   ========================================================= */
const FN_LETTERS = ['f', 'g', 'h', 'k', 'p', 'q'];
const G = { mode: 'fn', fns: [], pts: [], cpts: [], area: null, areaCfg: { fi: 0, gi: -1 }, view: null, tool: 'move', trace: null, focus: null, cfocus: null };
const COLORS = ['--g1', '--g2', '--g3', '--g4'];
const KIND_NAME = { zero: 'k_zero', y: 'a_yint', max: 'a_max', min: 'a_min', saddle: 'a_saddle', inflect: 'k_inflect', ix: 'k_ix' };
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const SUBD = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const plainLab = lab => lab === 'S_y' ? 'Sᵧ' : lab.replace(/_\{(\w+)\}/, (m, d) => /^\d+$/.test(d) ? d.split('').map(c => SUBD[c]).join('') : d);
const gfmt = v => { const s = Math.abs(v) < 1e-12 ? '0' : String(Number(v.toPrecision(5))); return S.dec === ',' ? s.replace('.', ',') : s; };
let PID = 0;
function fnNameFor(user, taken) {
  const u = String(user || '').replace(/\s+/g, '');
  const m = u.match(/^([A-Za-z]\w*)\(x\)$/); if (m && K.funcs[m[1]] && !taken.includes(m[1])) return m[1];
  let up = null; try { up = u && K.prepM(u); } catch (e) { }
  for (const [n, f] of Object.entries(K.funcs)) {
    if (f.params.length !== 1 || taken.includes(n)) continue;
    const b = f.body.replace(new RegExp('\\b' + f.params[0] + '\\b', 'g'), 'x').replace(/\s+/g, '');
    if (b === u) return n;
    try { if (up && K.prepM(b) === up) return n; } catch (e) { }
  }
  const used = new Set([...taken, ...Object.keys(K.funcs)]);
  return FN_LETTERS.find(l => !used.has(l)) || FN_LETTERS.find(l => !taken.includes(l)) || ('f' + taken.length);
}
function nameList(users, given) { const out = []; users.forEach((u, i) => out.push((given && given[i]) || fnNameFor(u, out))); return out; }
function makeFn(user, src, name) {
  const prepared = src || K.prepM(String(user));
  const vars = K.freeSyms(prepared), v = vars.includes('x') ? 'x' : (vars[0] || 'x');
  const f = K.compileFn(prepared, v);
  const i = G.fns.length;
  return { user: user || K.mjToUser(prepared), src: prepared, f, color: COLORS[i % 4], name: name || fnNameFor(user || (src && K.mjToUser(src)), G.fns.map(q => q.name)), label: user ? toDisp(String(user)) : K.mjToUser(prepared).replace(/\s+/g, '') };
}
// spec: Ergebnis (res) oder { fnsUser, pts }
function openGraph(spec, fromAnalysis = false) {
  $('#graphcard').hidden = false;
  G.mode = 'fn'; G.fns = []; G.area = null; G.trace = null; G.focus = null;
  G.curves = (spec.curves || []).map(cu => ({ ...cu, fx: K.compileFn(cu.xM, cu.t), fy: K.compileFn(cu.yM, cu.t) }));
  try {
    const nm = spec.names || (spec.fnName ? [spec.fnName] : []);
    if (spec.fnsUser) spec.fnsUser.slice(0, 4).forEach((u, i) => G.fns.push(makeFn(u, null, nm[i])));
    else if (spec.kind === 'fns' || (!spec.plot && anFnsOf(spec))) anFnsOf(spec).slice(0, 4).forEach((u, i) => G.fns.push(makeFn(u, null, nm[i])));
    else if (spec.plot) spec.plot.fns.slice(0, 4).forEach((s, i) => G.fns.push(makeFn(null, s, nm[i])));
    else if (spec.curves) { /* nur Kurven */ }
  } catch (e) { toast(e.message); }
  let pts = [];
  if (spec.pts) pts = spec.pts;
  else {
    if (spec.ixPts) pts = pts.concat(spec.ixPts.map(p => ({ ...p, fi: -1, sel: true })));
    if (spec.marks && G.fns[0]) pts = pts.concat(spec.marks.map((x, i) => ({ k: 'zero', x, y: G.fns[0].f(x) || 0, xt: gfmt(x), yt: '0', lab: 'x_{' + (i + 1) + '}', fi: 0 }))).map(p => ({ ...p, tex: p.tex || `${p.lab}\\left(${p.xt}\\,|\\,${p.yt}\\right)` }));
  }
  G.pts = pts.map(p => ({ ...p, id: ++PID, sel: !!p.sel }));
  G.areaCfg = { fi: 0, gi: -1 };
  if (spec.plot && spec.plot.shade) setArea(spec.plot.shade[0], spec.plot.shade[1]);
  fit(); syncGraphUI(); draw(); showInfo();
  RESULT_SYNC();
  if (!fromAnalysis) $('#graphcard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function openComplex(cpts) {
  $('#graphcard').hidden = false;
  G.mode = 'cx'; G.cpts = cpts.map((c, i) => ({ ...c, id: i, lab: 'z_{' + (i + 1) + '}' })); G.cfocus = null; G.tool = 'move'; G.area = null;
  fit(); syncGraphUI(); draw(); showInfo(); RESULT_SYNC();
  $('#graphcard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function addFn(expr, name, canonical) {
  try {
    const dm = String(expr).match(/^\s*([A-Za-z]\w*)\(x\)\s*:?=/);
    if (!name && dm && !G.fns.some(q => q.name === dm[1])) name = dm[1];
    const u = canonical ? String(expr).replace(/^.*=/, '') : K.normalize(String(expr).replace(/^.*=/, ''));
    G.fns.push(makeFn(u, null, name));
  } catch (e) { toast(e.message); return; }
  if (G.mode !== 'fn') { G.mode = 'fn'; G.pts = []; }
  // Schnittpunkte mit vorhandenen Funktionen ergänzen
  const n = G.fns.length - 1;
  for (let i = 0; i < n; i++) {
    try { K.intersect(G.fns[i].user, G.fns[n].user).forEach(p => G.pts.push({ ...p, fi: -1, id: ++PID, sel: false })); } catch (e) { }
  }
  if (!G.view) fit();
  setActive(mf);
  if (!$('#analysis').hidden) { runAnalysis(G.fns.map(f => f.user), G.fns.map(f => f.name)); return; }
  syncGraphUI(); draw();
}
function fnSuggestions() {
  const box = $('#gSuggest'); box.replaceChildren();
  if (G.mode !== 'fn') { box.hidden = true; return; }
  const have = new Set(G.fns.map(f => String(f.user).replace(/\s+/g, '')));
  const saved = Object.entries(K.funcs).filter(([, f]) => f.params.length === 1).map(([n, f]) => ({ n, user: f.body.replace(new RegExp('\\b' + f.params[0] + '\\b', 'g'), 'x') }));
  const hist = [];
  for (const h of HIST) {
    if (hist.length >= 4) break;
    if (/[=<>]|^[A-Za-z]\w*\(.*\)$/.test(h.in) && !/^[a-z]\(/i.test(h.in)) continue;
    try { const fs = K.freeSyms(K.prepM(h.in)); if (fs.length !== 1 || fs[0] !== 'x') continue; } catch (e) { continue; }
    if (hist.some(q => q.in === h.in) || saved.some(q => q.user.replace(/\s+/g, '') === h.in.replace(/\s+/g, ''))) continue;
    hist.push(h);
  }
  const mk = (tex, onclick) => { const b = el('button', 'pt-chip sug'); b.type = 'button'; render(b, K.decFix(tex), false); b.onclick = onclick; return b; };
  const sv = saved.filter(f => !have.has(f.user.replace(/\s+/g, '')));
  if (sv.length) { box.appendChild(el('span', 'sug-k', T('saved_fns'))); sv.forEach(f => box.appendChild(mk(`${f.n}(x)=${ED.textToLatex(f.user)}`, () => addFn(f.user, f.n, true)))); }
  const hv = hist.filter(h => !have.has(h.in.replace(/\s+/g, '')));
  if (hv.length) { box.appendChild(el('span', 'sug-k', T('from_hist'))); hv.forEach(h => box.appendChild(mk(histTex(h), () => addFn(h.in, null, true)))); }
  box.hidden = !box.children.length;
}
function syncGraphUI() {
  $('#gTitle').textContent = G.mode === 'cx' ? T('cp_title') : T('graph');
  // Werkzeuge
  const tools = $('#gTools'); tools.replaceChildren(); tools.hidden = G.mode === 'cx';
  [['move', 'tool_move'], ['point', 'tool_point'], ['area', 'tool_area']].forEach(([k, key]) => {
    const b = el('button', null, T(key)); b.type = 'button'; b.setAttribute('aria-pressed', G.tool === k);
    b.onclick = () => { G.tool = k; G.trace = null; if (k !== 'area') setActive(mf); else if (G.fns.length >= 2 && !G.area) G.areaCfg = { fi: 0, gi: 1 }; syncGraphUI(); draw(); showInfo(); };
    tools.appendChild(b);
  });
  // Funktionsliste
  const l = $('#fnlist'); l.replaceChildren(); l.hidden = G.mode === 'cx';
  G.fns.forEach((fn, i) => {
    const c = el('span', 'fnchip'); const dot = el('i'); dot.style.background = `var(${fn.color})`; c.appendChild(dot);
    c.appendChild(el('span', null, fn.name + '(x) = ' + fn.label));
    const x = el('button', null, '×'); x.type = 'button'; x.ariaLabel = T('remove');
    x.onclick = () => { G.fns.splice(i, 1); G.pts = G.pts.filter(p => p.fi !== i).map(p => p.fi > i ? { ...p, fi: p.fi - 1 } : p); G.area = null; G.fns.forEach((f, j) => { f.color = COLORS[j % 4]; }); syncGraphUI(); draw(); showInfo(); };
    c.appendChild(x); l.appendChild(c);
  });
  $('#addfn').hidden = G.mode === 'cx';
  fnSuggestions(); syncAreaCfg();
  // Punkte-Chips
  const pc = $('#gPts'); pc.replaceChildren();
  if (G.mode === 'cx') G.cpts.forEach(c => { const b = el('button', 'pt-chip'); b.type = 'button'; b.setAttribute('aria-pressed', G.cfocus === c); render(b, K.decFix(c.lab + '=' + c.tex), false); b.onclick = () => { G.cfocus = G.cfocus === c ? null : c; syncGraphUI(); draw(); showInfo(); }; pc.appendChild(b); });
  else G.pts.forEach(p => pc.appendChild(ptChip(p)));
  pc.hidden = !pc.children.length;
}
function niceStep(range, px) { const raw = range / Math.max(1, px / 80), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function fit() {
  const cv = $('#plot'), W = cv.clientWidth || 400, H = cv.clientHeight || 300;
  if (G.mode === 'cx') {
    let r = 1; G.cpts.forEach(c => { r = Math.max(r, Math.abs(c.re), Math.abs(c.im)); });
    r *= 1.35; const k = W / H;
    G.view = k >= 1 ? { x0: -r * k, x1: r * k, y0: -r, y1: r } : { x0: -r, x1: r, y0: -r / k, y1: r / k };
    return;
  }
  const GR = S.gRange;
  if (GR && GR.mode === 'manual' && [GR.x0, GR.x1, GR.y0, GR.y1].every(isFinite)) { G.view = { x0: GR.x0, x1: GR.x1, y0: GR.y0, y1: GR.y1 }; return; }
  const cb = G.curves && G.curves.length ? curveBounds() : null;
  if (cb && !G.fns.length) { // gleiche Achsenskalierung für Kurven
    let [a0, a1, b0, b1] = cb; const pw = Math.max(a1 - a0, 1e-3) * 0.15 + 0.3, ph = Math.max(b1 - b0, 1e-3) * 0.15 + 0.3; a0 -= pw; a1 += pw; b0 -= ph; b1 += ph;
    const k = W / H, cx = (a0 + a1) / 2, cyy = (b0 + b1) / 2; let w = a1 - a0, h = b1 - b0; if (w / h < k) w = h * k; else h = w / k;
    G.view = { x0: cx - w / 2, x1: cx + w / 2, y0: cyy - h / 2, y1: cyy + h / 2 }; return;
  }
  let x0 = -10, x1 = 10;
  const px = G.pts.filter(p => isFinite(p.x)).map(p => p.x);
  if (G.area) px.push(G.area.a, G.area.b);
  if (px.length) { const lo = Math.min(...px), hi = Math.max(...px), span = Math.max(hi - lo, 2); x0 = lo - span * 0.6; x1 = hi + span * 0.6; if (x1 - x0 > 60 && !G.area) { x0 = -10; x1 = 10; } }
  const ys = [];
  for (const fn of G.fns) for (let i = 0; i <= 200; i++) { const y = fn.f(x0 + (x1 - x0) * i / 200); if (isFinite(y)) ys.push(y); }
  G.pts.forEach(p => isFinite(p.y) && ys.push(p.y, p.y));
  ys.sort((a, b) => a - b);
  let y0 = -6, y1 = 6;
  if (ys.length > 4) {
    y0 = ys[Math.floor(ys.length * 0.06)]; y1 = ys[Math.ceil(ys.length * 0.94) - 1];
    G.pts.forEach(p => { if (isFinite(p.y)) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } });
    const pad = Math.max((y1 - y0) * 0.2, 0.5); y0 -= pad; y1 += pad;
    if (y0 > 0) y0 = -pad * 0.5; if (y1 < 0) y1 = pad * 0.5;
  }
  G.view = { x0, x1, y0, y1 };
}
let rangeT = 0;
function syncRangeFields(force) {
  if ($('#gRange').hidden || !G.view) return;
  clearTimeout(rangeT);
  rangeT = setTimeout(() => {
    const v = G.view, keys = ['x0', 'x1', 'y0', 'y1'];
    const nice = x => { const t = ED.textToLatex(String(Number(x.toPrecision(3)))); return S.dec === ',' ? t.replace(/(\d)\.(\d)/g, '$1{,}$2') : t; };
    mqR.forEach((F, i) => { if (force || ACTIVE !== F) F.latex(nice(v[keys[i]])); });
  }, force ? 0 : 160);
}
function syncRangeMode() {
  const m = (S.gRange && S.gRange.mode) || 'auto', box = $('#rangeMode'); box.replaceChildren();
  [['auto', T('rg_auto')], ['manual', T('rg_manual')]].forEach(([k, l]) => {
    const b = el('button', null, l); b.type = 'button'; b.setAttribute('aria-pressed', m === k);
    b.onclick = () => {
      if (k === 'auto') { S.gRange = { ...(S.gRange || {}), mode: 'auto' }; saveSettings(); fit(); draw(); syncRangeFields(true); }
      else applyRange();
      syncRangeMode();
    };
    box.appendChild(b);
  });
}
function applyRange() {
  const val = F => { try { const c = ED.latexToText(F.latex(), S.dec); if (!c.trim()) return NaN; return K.compileFn(K.prepM(c), 'x')(0); } catch (e) { return NaN; } };
  const [x0, x1, y0, y1] = mqR.map(val);
  if (![x0, x1, y0, y1].every(isFinite) || x0 >= x1 || y0 >= y1) { toast(T('rg_err')); return; }
  S.gRange = { mode: 'manual', x0, x1, y0, y1 }; saveSettings();
  G.view = { x0, x1, y0, y1 }; draw(); syncRangeMode(); setActive(mf);
}
function equalAxes() {
  const cv = $('#plot'), W = cv.clientWidth || 400, H = cv.clientHeight || 300, v = G.view; if (!v) return;
  const cy = (v.y0 + v.y1) / 2, hy = (v.x1 - v.x0) * H / W / 2;
  G.view = { ...v, y0: cy - hy, y1: cy + hy }; draw(); syncRangeFields(true);
}
function draw() {
  syncRangeFields(); try { syncTable(); } catch (e) { }
  const cv = $('#plot'); if (!cv || $('#graphcard').hidden || !G.view) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { x0, x1, y0, y1 } = G.view, X = x => (x - x0) / (x1 - x0) * W, Y = y => H - (y - y0) / (y1 - y0) * H;
  c.fillStyle = cssVar('--surface'); c.fillRect(0, 0, W, H);
  const line = cssVar('--line'), muted = cssVar('--muted'), ink = cssVar('--ink'), surf = cssVar('--surface');
  const sx = niceStep(x1 - x0, W), sy = niceStep(y1 - y0, H);
  c.lineWidth = 1; c.strokeStyle = line; c.globalAlpha = .55; c.beginPath();
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1; x += sx) { c.moveTo(Math.round(X(x)) + .5, 0); c.lineTo(Math.round(X(x)) + .5, H); }
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1; y += sy) { c.moveTo(0, Math.round(Y(y)) + .5); c.lineTo(W, Math.round(Y(y)) + .5); }
  c.stroke(); c.globalAlpha = 1;
  const ax = Math.min(Math.max(Y(0), 0), H), ay = Math.min(Math.max(X(0), 0), W);
  c.strokeStyle = muted; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, ax); c.lineTo(W, ax); c.moveTo(ay, 0); c.lineTo(ay, H); c.stroke();
  c.fillStyle = muted; c.font = '11px "IBM Plex Mono", monospace';
  c.textAlign = 'center'; c.textBaseline = 'top';
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1; x += sx) { if (Math.abs(x) < sx / 2) continue; c.fillText(gfmt(x), X(x), Math.min(ax + 4, H - 14)); }
  c.textAlign = 'left'; c.textBaseline = 'middle';
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1; y += sy) { if (Math.abs(y) < sy / 2) continue; c.fillText(G.mode === 'cx' ? (Math.abs(y - 1) < 1e-12 ? 'i' : Math.abs(y + 1) < 1e-12 ? '−i' : gfmt(y) + 'i') : gfmt(y), Math.min(ay + 5, W - 40), Y(y)); }
  const labelBox = (txt, px, py, col) => {
    c.font = '500 12px "IBM Plex Sans", sans-serif';
    const w = c.measureText(txt).width + 12, h = 22;
    let bx = px + 8, by = py - h - 6; if (bx + w > W - 4) bx = px - w - 8; if (by < 4) by = py + 8;
    c.fillStyle = surf; c.strokeStyle = col; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect ? c.roundRect(bx, by, w, h, 6) : c.rect(bx, by, w, h); c.fill(); c.stroke();
    c.fillStyle = ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, bx + 6, by + h / 2 + 1);
  };
  if (G.mode === 'cx') {
    // Einheitskreis
    c.strokeStyle = muted; c.globalAlpha = .35; c.setLineDash([4, 4]); c.beginPath();
    c.ellipse(X(0), Y(0), Math.abs(X(1) - X(0)), Math.abs(Y(1) - Y(0)), 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    c.fillStyle = muted; c.font = '500 12px "IBM Plex Sans", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'bottom';
    c.fillText('Re', W - 6, ax - 4); c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('Im', ay + 6, 6);
    G.cpts.forEach((z, i) => {
      const col = cssVar(COLORS[i % 4]), px = X(z.re), py = Y(z.im), ox = X(0), oy = Y(0);
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(px, py); c.stroke();
      const ang = Math.atan2(py - oy, px - ox), L = Math.hypot(px - ox, py - oy);
      if (L > 14) { c.beginPath(); c.moveTo(px, py); c.lineTo(px - 10 * Math.cos(ang - .4), py - 10 * Math.sin(ang - .4)); c.lineTo(px - 10 * Math.cos(ang + .4), py - 10 * Math.sin(ang + .4)); c.closePath(); c.fill(); }
      c.beginPath(); c.arc(px, py, G.cfocus === z ? 6 : 4, 0, Math.PI * 2); c.fill();
      if (G.cfocus === z) {
        c.strokeStyle = col; c.globalAlpha = .5; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(px, py); c.lineTo(px, oy); c.moveTo(px, py); c.lineTo(ox, py); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
        c.beginPath(); c.arc(ox, oy, 22, 0, -Math.atan2(z.im, z.re), z.im > 0); c.stroke();
      }
      labelBox(plainLab(z.lab) + ' = ' + gfmt(z.re) + (z.im < 0 ? ' − ' : ' + ') + gfmt(Math.abs(z.im)) + 'i', px, py, col);
    });
    return;
  }
  // Fläche
  if (G.area && G.fns[G.areaCfg.fi]) {
    const f = G.fns[G.areaCfg.fi].f, g = G.areaCfg.gi >= 0 && G.fns[G.areaCfg.gi] ? G.fns[G.areaCfg.gi].f : () => 0;
    const { a, b } = G.area, N = Math.max(60, Math.min(600, Math.round(Math.abs(X(b) - X(a)))));
    const cPos = cssVar('--g1'), cNeg = cssVar('--g2');
    c.globalAlpha = .22;
    for (let i = 0; i < N; i++) {
      const xa = a + (b - a) * i / N, xb = a + (b - a) * (i + 1) / N;
      const fa = f(xa), fb = f(xb), ga = g(xa), gb = g(xb);
      if (![fa, fb, ga, gb].every(isFinite)) continue;
      c.fillStyle = (fa + fb - ga - gb) >= 0 ? cPos : cNeg;
      c.beginPath(); c.moveTo(X(xa) - .3, Y(ga)); c.lineTo(X(xa) - .3, Y(fa)); c.lineTo(X(xb) + .3, Y(fb)); c.lineTo(X(xb) + .3, Y(gb)); c.closePath(); c.fill();
    }
    c.globalAlpha = 1; c.strokeStyle = cssVar('--g1'); c.lineWidth = 1.2; c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(X(a), 0); c.lineTo(X(a), H); c.moveTo(X(b), 0); c.lineTo(X(b), H); c.stroke(); c.setLineDash([]);
    [[a, 'a'], [b, 'b']].forEach(([x, t]) => {
      const px = X(x); if (px < -20 || px > W + 20) return;
      c.fillStyle = cssVar('--g1'); c.beginPath(); c.arc(px, 14, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = cssVar('--accent-ink'); c.font = 'italic 500 15px "STIX Two Text", "Times New Roman", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, px, 14.5);
    });
  }
  for (const fn of G.fns) {
    c.strokeStyle = cssVar(fn.color); c.lineWidth = 2.2; c.lineJoin = 'round'; c.beginPath();
    let pen = false, py = null;
    for (let px = 0; px <= W; px += 0.75) {
      const x = x0 + px / W * (x1 - x0), y = fn.f(x);
      if (!isFinite(y)) { pen = false; continue; }
      const sy2 = Y(y); if (pen && Math.abs(sy2 - py) > H * 1.5) pen = false;
      const cy = Math.max(-H * 2, Math.min(H * 3, sy2));
      if (pen) c.lineTo(px, cy); else c.moveTo(px, cy);
      pen = true; py = sy2;
    }
    c.stroke();
  }
  drawCurves(c, X, Y, W, H);
  const placed = [];
  const sel = [];
  for (const p of G.pts) {
    if (!isFinite(p.x) || !isFinite(p.y)) continue;
    const px = X(p.x), py2 = Y(p.y);
    if (px < -10 || px > W + 10 || py2 < -10 || py2 > H + 10) continue;
    const col = cssVar(p.fi >= 0 && G.fns[p.fi] ? G.fns[p.fi].color : '--g2');
    const fill = p.k === 'max' || p.k === 'min' || p.k === 'ix' ? col : p.k === 'inflect' || p.k === 'saddle' ? cssVar('--g4') : surf;
    c.fillStyle = fill; c.strokeStyle = col; c.lineWidth = 2;
    c.beginPath(); c.arc(px, py2, p.sel ? 6 : 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    if (p.sel) { c.globalAlpha = .25; c.beginPath(); c.arc(px, py2, 12, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.globalAlpha = 1; sel.push([p, px, py2, col]); continue; }
    c.fillStyle = ink; c.font = '500 11px "IBM Plex Sans", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'bottom';
    const near = placed.filter(q => Math.abs(q[0] - px) < 10 && Math.abs(q[1] - py2) < 10).length;
    c.fillText(plainLab(p.lab).replace(/[₀-₉]+$/, ''), px + 6 + near * 14, py2 - 4); placed.push([px, py2]);
  }
  sel.forEach(([p, px, py2, col]) => labelBox(plainLab(p.lab) + '(' + gfmt(p.x) + ' | ' + gfmt(p.y) + ')', px, py2, col));
  // Spur
  if (G.trace) {
    const t = G.trace, px = X(t.x);
    c.strokeStyle = muted; c.setLineDash([4, 4]); c.lineWidth = 1; c.beginPath(); c.moveTo(px, 0); c.lineTo(px, H); c.stroke(); c.setLineDash([]);
    G.fns.forEach(fn => { const y = fn.f(t.x); if (!isFinite(y)) return; c.fillStyle = cssVar(fn.color); c.beginPath(); c.arc(px, Y(y), 5, 0, Math.PI * 2); c.fill(); });
    const fn = G.fns[t.fi]; if (fn) { const y = fn.f(t.x); if (isFinite(y)) labelBox('(' + gfmt(t.x) + ' | ' + gfmt(y) + ')', px, Y(y), cssVar(fn.color)); }
  }
}

/* ---------- Infofeld unter dem Graphen ---------- */
const numDeriv = (f, x) => { const h = 1e-5 * (1 + Math.abs(x)); return (f(x + h) - f(x - h)) / (2 * h); };
function infoRows(rows) {
  const box = $('#gInfo'); box.replaceChildren(); box.hidden = false;
  rows.forEach(([k, tex, plain]) => {
    const r = el('div', 'gi-row'); if (k) r.appendChild(el('span', 'gi-k', k));
    const v = el('span', 'gi-v'); r.appendChild(v);
    if (plain) v.textContent = tex; else render(v, K.decFix(tex), false);
    box.appendChild(r);
  });
}
function showInfo() {
  if (G.mode === 'cx') {
    if (G.cfocus) return showComplexInfo(G.cfocus);
    return infoRows([[null, T('cp_title') + ': ' + G.cpts.length + ' · ' + T('pts_hint'), true]]);
  }
  if (G.tool === 'area' && G.area) return showAreaInfo();
  if (G.focus && G.focus.sel) return showPointInfo(G.focus);
  infoRows([[null, T(G.tool === 'area' ? 'hint_area' : G.tool === 'point' ? 'hint_point' : 'hint_move'), true]]);
}
function showPointInfo(p) {
  const rows = [[T(KIND_NAME[p.k] || 'a_fn'), p.tex]];
  const fns = p.fi >= 0 ? [G.fns[p.fi]] : G.fns;
  fns.filter(Boolean).forEach(fn => { const m = numDeriv(fn.f, p.x); if (isFinite(m)) rows.push([T('slope') + ' ' + fn.name + '′', `${fn.name}'(${K.fmtReal(p.x)})=${K.fmtReal(Math.abs(m) < 1e-9 ? 0 : m)}`]); });
  infoRows(rows);
}
function showTraceInfo() {
  const t = G.trace; if (!t) return showInfo();
  const rows = [];
  if (t.snap) rows.push([T(KIND_NAME[t.snap.k] || 'a_fn'), t.snap.tex]);
  rows.push(['x', K.fmtReal(t.x)]);
  G.fns.forEach(fn => {
    const y = fn.f(t.x), m = numDeriv(fn.f, t.x);
    rows.push([fn.name + '(x)', isFinite(y) ? K.fmtReal(y) : '\\text{—}']);
    if (isFinite(m)) rows.push([fn.name + '′(x)', K.fmtReal(Math.abs(m) < 1e-10 ? 0 : m)]);
  });
  infoRows(rows);
}
function showComplexInfo(z) {
  const r = Math.hypot(z.re, z.im), phi = Math.atan2(z.im, z.re);
  const rt = K.fmtReal(r), pt = K.fmtReal(phi);
  infoRows([
    ['z', `${z.lab}=${z.tex}`],
    ['Re · Im', `\\operatorname{Re}=${K.fmtReal(z.re)},\\;\\operatorname{Im}=${K.fmtReal(z.im)}`],
    ['|z|', `|z|=\\sqrt{${z.re < 0 ? '\\left(' + K.fmtReal(z.re) + '\\right)' : K.fmtReal(z.re)}^2+${z.im < 0 ? '\\left(' + K.fmtReal(z.im) + '\\right)' : K.fmtReal(z.im)}^2}=${rt}`],
    ['arg', `\\varphi=${pt}\\,\\text{rad}=${K.fmtReal(phi * 180 / Math.PI)}^\\circ`],
    [T('cp_polar'), `z=${rt}\\cdot e^{i\\cdot ${pt}}=${rt}\\left(\\cos ${pt}+i\\sin ${pt}\\right)`],
    ['z̄', `\\bar z=${K.fmtReal(z.re)}${z.im > 0 ? '-' : '+'}${K.fmtReal(Math.abs(z.im))}i`]
  ]);
}

/* ---------- Flächen ---------- */
function snapX(x, pxTol) {
  const cv = $('#plot'), W = cv.clientWidth, perPx = (G.view.x1 - G.view.x0) / W;
  let best = null, bd = pxTol * perPx;
  for (const p of G.pts) { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p; } }
  return best;
}
const exprOf = p => { if (!p || p.xt == null) return null; try { const t = ED.latexToText(p.xt, S.dec); return t && /^[-\w.()*/+^ ]+$/.test(t) ? t : null; } catch (e) { return null; } };
function setArea(a, b, ea, eb) {
  if (a > b) { [a, b] = [b, a]; [ea, eb] = [eb, ea]; }
  G.area = { a, b, ea: ea || null, eb: eb || null };
}
function simpsonN(f, a, b, n = 2000) { if (a === b) return 0; const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return s * h / 3; }
const niceBound = x => { try { const q = math.fraction(x); if (q.d <= 24 && Math.abs(q.valueOf() - x) < 1e-10) return q.toFraction(); } catch (e) { } const k = x / Math.PI; try { const q = math.fraction(k); if (q.d <= 12 && Math.abs(q.valueOf() - k) < 1e-10) return '(' + q.toFraction() + ')*pi'; } catch (e) { } return null; };
function exactIntegral(user, a, b, ea, eb) {
  const A = ea || niceBound(a), B = eb || niceBound(b);
  if (A === null || B === null) return null;
  try { const r = K.CMDS.integrate([user, 'x', A, B]); return /approx/.test(r.outTex) ? null : r.outTex; } catch (e) { return null; }
}
function boundTex(x, ex) { return ED.textToLatex(ex || String(Number(x.toPrecision(10)))); }
function syncAreaCfg() {
  const box = $('#gAreaCfg');
  const show = G.mode === 'fn' && G.tool === 'area' && !!G.area && G.fns.length > 0;
  box.hidden = !show; if (!show) return;
  const s1 = $('#areaFn'); s1.replaceChildren();
  const { fi, gi } = G.areaCfg, two = gi >= 0;
  const segBox = $('#areaMode'); segBox.replaceChildren();
  [['x', T('area_xaxis')], ['two', T('area_two')]].forEach(([k, l]) => {
    const b = el('button', null, l); b.type = 'button'; b.setAttribute('aria-pressed', (k === 'two') === two);
    b.onclick = () => {
      if (k === 'two') {
        if (G.fns.length < 2) { toast(T('need_second')); setActive(mqAdd); focusEd(); $('#addfn').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        G.areaCfg = { fi: 0, gi: 1 };
      } else G.areaCfg = { fi: Math.max(0, fi), gi: -1 };
      draw(); showAreaInfo();
    };
    segBox.appendChild(b);
  });
  if (!two) G.fns.forEach((fn, i) => { const o = el('option', null, T('area_under') + ' ' + fn.name + '(x)'); o.value = i + ':-1'; if (fi === i) o.selected = true; s1.appendChild(o); });
  else for (let i = 0; i < G.fns.length; i++) for (let j = i + 1; j < G.fns.length; j++) { const o = el('option', null, T('area_between') + ' ' + G.fns[i].name + ' / ' + G.fns[j].name); o.value = i + ':' + j; if (fi === i && gi === j) o.selected = true; s1.appendChild(o); }
  s1.hidden = s1.options.length < 2;
  if (ACTIVE !== mqA) mqA.latex(boundTex(G.area.a, G.area.ea));
  if (ACTIVE !== mqB) mqB.latex(boundTex(G.area.b, G.area.eb));
}
function applyBounds() {
  const val = F => { try { const c = ED.latexToText(F.latex(), S.dec); if (!c.trim()) return NaN; return K.compileFn(K.prepM(c), 'x')(0); } catch (e) { return NaN; } };
  const a = val(mqA), b = val(mqB);
  if (!isFinite(a) || !isFinite(b) || a === b) { toast(T('err_bounds')); return; }
  const ex = F => { try { const c = ED.latexToText(F.latex(), S.dec).trim(); return /^[-\w.()*/+^ ]+$/.test(c) ? c : null; } catch (e) { return null; } };
  setArea(a, b, ex(mqA), ex(mqB)); draw(); showAreaInfo();
}
function showAreaInfo() {
  syncAreaCfg();
  const { fi, gi } = G.areaCfg, F = G.fns[fi]; if (!F || !G.area) return;
  const Gf = gi >= 0 ? G.fns[gi] : null;
  const h = x => F.f(x) - (Gf ? Gf.f(x) : 0);
  const user = Gf ? `(${F.user})-(${Gf.user})` : F.user;
  const { a, b } = G.area;
  const tol = x => 1e-7 * (1 + Math.abs(x));
  const cuts = K.findRoots(h, a, b, 3000).filter(x => { if (!(x > a + tol(a) && x < b - tol(b))) return false; const e = 1e-6 * (1 + Math.abs(x)); return h(x - e) * h(x + e) < 0; });
  const edges = [a, ...cuts, b];
  const parts = []; for (let i = 0; i < edges.length - 1; i++) parts.push([edges[i], edges[i + 1], simpsonN(h, edges[i], edges[i + 1])]);
  const signed = parts.reduce((s, p) => s + p[2], 0), area = parts.reduce((s, p) => s + Math.abs(p[2]), 0);
  const box = $('#gInfo'); box.replaceChildren(); box.hidden = false;
  const integrand = Gf ? `\\left(${F.name}(x)-${Gf.name}(x)\\right)` : `${F.name}(x)`;
  const ex = exactIntegral(user, a, b, G.area.ea, G.area.eb);
  const add = (k, tex) => { const r = el('div', 'gi-row'); r.appendChild(el('span', 'gi-k', k)); const v = el('span', 'gi-v'); r.appendChild(v); render(v, K.decFix(tex), false); box.appendChild(r); };
  const bt = (x, e) => e ? ED.textToLatex(e) : K.fmtReal(x);
  add(T('area_signed'), `\\int_{${bt(a, G.area.ea)}}^{${bt(b, G.area.eb)}}${integrand}\\,dx=${ex ? ex + '\\approx ' : ''}${K.fmtReal(signed)}`);
  const exA = parts.length === 1 && ex ? (signed < 0 ? exactIntegral(`-(${user})`, a, b, G.area.ea, G.area.eb) : ex) : null;
  add(T('area_abs'), `A=${exA ? exA + '\\approx ' : ''}${K.fmtReal(area)}`);
  if (parts.length > 1) add(T('area_parts'), parts.map((p, i) => `A_{${i + 1}}=\\left|\\int_{${K.fmtReal(p[0])}}^{${K.fmtReal(p[1])}}\\right|=${K.fmtReal(Math.abs(p[2]))}`).join(',\;'));
}

(function graphInput() {
  const cv = $('#plot'); const ptrs = new Map();
  let gest = null, multi = false, moved = false;
  const rect = () => cv.getBoundingClientRect();
  const toWorld = (px, py) => { const r = rect(), v = G.view; return { x: v.x0 + (px - r.left) / r.width * (v.x1 - v.x0), y: v.y1 - (py - r.top) / r.height * (v.y1 - v.y0) }; };
  const Xs = x => { const r = rect(), v = G.view; return r.left + (x - v.x0) / (v.x1 - v.x0) * r.width; };
  const trace = (e, snapTol = 12) => {
    if (!G.fns.length) return;
    const w = toWorld(e.clientX, e.clientY), s = snapX(w.x, snapTol), x = s ? s.x : w.x;
    let fi = s && s.fi >= 0 ? s.fi : 0, bd = Infinity;
    if (!s) G.fns.forEach((fn, i) => { const y = fn.f(x); if (isFinite(y) && Math.abs(y - w.y) < bd) { bd = Math.abs(y - w.y); fi = i; } });
    G.trace = { x, fi, snap: s }; draw(); showTraceInfo();
  };
  const panBase = p => ({ type: 'pan', x: p.x, y: p.y, v: { ...G.view } });
  const pinchBase = () => { const [a, b] = [...ptrs.values()]; return { type: 'pinch', d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: { ...G.view } }; };
  cv.addEventListener('pointerdown', e => {
    if (!G.view) return;
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size >= 2) { multi = true; gest = pinchBase(); G.trace = null; return; }
    multi = false; moved = false;
    const p = { x: e.clientX, y: e.clientY };
    if (G.mode === 'fn' && G.tool === 'point') { gest = { type: 'trace' }; trace(e); return; }
    if (G.mode === 'fn' && G.tool === 'area') {
      if (G.area) {
        const da = Math.abs(e.clientX - Xs(G.area.a)), db = Math.abs(e.clientX - Xs(G.area.b));
        if (Math.min(da, db) < 22) { gest = { type: 'bound', which: da <= db ? 'a' : 'b' }; return; }
      }
      const w = toWorld(e.clientX, e.clientY), s = snapX(w.x, 14);
      gest = { type: 'area', ax: s ? s.x : w.x, ea: exprOf(s), x: e.clientX, y: e.clientY };
      return;
    }
    gest = panBase(p);
  });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !G.view || !gest) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = rect();
    if (gest.type === 'pinch') {
      if (ptrs.size < 2) return;
      const [a, b] = [...ptrs.values()];
      const d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), cmx = (a.x + b.x) / 2, cmy = (a.y + b.y) / 2;
      const v = gest.v, k = gest.d / d;
      const wx = v.x0 + (gest.mx - r.left) / r.width * (v.x1 - v.x0), wy = v.y1 - (gest.my - r.top) / r.height * (v.y1 - v.y0);
      const W = Math.min(1e7, Math.max(1e-7, (v.x1 - v.x0) * k)), H = Math.min(1e7, Math.max(1e-7, (v.y1 - v.y0) * k));
      const x0 = wx - (cmx - r.left) / r.width * W, y1 = wy + (cmy - r.top) / r.height * H;
      G.view = { x0, x1: x0 + W, y0: y1 - H, y1 }; draw(); return;
    }
    if (gest.type === 'trace') return trace(e);
    if (gest.type === 'bound') {
      const w = toWorld(e.clientX, e.clientY), s = snapX(w.x, 14), x = s ? s.x : w.x;
      if (gest.which === 'a') { G.area.a = x; G.area.ea = exprOf(s); } else { G.area.b = x; G.area.eb = exprOf(s); }
      if (G.area.a > G.area.b) { [G.area.a, G.area.b, G.area.ea, G.area.eb] = [G.area.b, G.area.a, G.area.eb, G.area.ea]; gest.which = gest.which === 'a' ? 'b' : 'a'; }
      moved = true; draw(); syncAreaCfg(); return;
    }
    if (gest.type === 'area') {
      if (Math.hypot(e.clientX - gest.x, e.clientY - gest.y) < 6 && !moved) return;
      moved = true;
      const w = toWorld(e.clientX, e.clientY), s = snapX(w.x, 14);
      setArea(gest.ax, s ? s.x : w.x, gest.ea, exprOf(s)); draw(); return;
    }
    if (gest.type === 'pan') {
      const dx = e.clientX - gest.x, dy = e.clientY - gest.y;
      if (Math.hypot(dx, dy) > 4) moved = true;
      if (!moved) return;
      const v = gest.v, wx = dx / r.width * (v.x1 - v.x0), wy = dy / r.height * (v.y1 - v.y0);
      G.view = { x0: v.x0 - wx, x1: v.x1 - wx, y0: v.y0 + wy, y1: v.y1 + wy }; draw();
    }
  });
  const end = e => {
    if (!ptrs.has(e.pointerId)) return;
    const wasSingle = ptrs.size === 1;
    ptrs.delete(e.pointerId);
    if (ptrs.size === 1) { gest = panBase([...ptrs.values()][0]); moved = true; return; } // ein Finger bleibt: weiter verschieben, ohne Sprung
    if (ptrs.size > 1) { gest = pinchBase(); return; }
    const g = gest; gest = null;
    if (!wasSingle || multi || !G.view || e.type !== 'pointerup') return;
    if (g && (g.type === 'area' || g.type === 'bound')) { if (moved && G.area) showAreaInfo(); return; }
    if (moved || (g && g.type === 'trace')) return;
    const rr = rect(), pxPerX = rr.width / (G.view.x1 - G.view.x0), pxPerY = rr.height / (G.view.y1 - G.view.y0);
    const w = toWorld(e.clientX, e.clientY);
    if (G.mode === 'cx') {
      let best = null, bd = 22;
      G.cpts.forEach(z => { const d = Math.hypot((z.re - w.x) * pxPerX, (z.im - w.y) * pxPerY); if (d < bd) { bd = d; best = z; } });
      G.cfocus = best; syncGraphUI(); draw(); showInfo(); return;
    }
    let best = null, bd = 20;
    G.pts.forEach(p => { const d = Math.hypot((p.x - w.x) * pxPerX, (p.y - w.y) * pxPerY); if (d < bd) { bd = d; best = p; } });
    if (best) togglePt(best.id, true); else trace(e, 0);
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => { if (!G.view) return; e.preventDefault(); const k = Math.exp(e.deltaY * 0.0015), c0 = toWorld(e.clientX, e.clientY), v = G.view; G.view = { x0: c0.x - (c0.x - v.x0) * k, x1: c0.x + (v.x1 - c0.x) * k, y0: c0.y - (c0.y - v.y0) * k, y1: c0.y + (v.y1 - c0.y) * k }; draw(); }, { passive: false });
  new ResizeObserver(() => draw()).observe(cv);
  $('#gRangeBtn').onclick = () => {
    const box = $('#gRange'); box.hidden = !box.hidden; $('#gRangeBtn').setAttribute('aria-pressed', !box.hidden);
    if (!box.hidden) { syncRangeMode(); syncRangeFields(true); } else if (mqR.includes(ACTIVE)) setActive(mf);
  };
  $('#rangeOk').onclick = applyRange; $('#rangeEq').onclick = equalAxes;
  $('#gReset').onclick = () => { G.trace = null; G.area = null; G.focus = null; G.pts.forEach(p => { p.sel = false; }); fit(); syncGraphUI(); draw(); showInfo(); };
  $('#addfnBtn').addEventListener('pointerdown', e => e.preventDefault());
  $('#addfnBtn').onclick = () => submitAddFn();
  $('#areaFn').onchange = () => { const [x, y] = $('#areaFn').value.split(':').map(Number); G.areaCfg = { fi: x, gi: y }; draw(); showAreaInfo(); };
  $('#areaOk').addEventListener('pointerdown', e => e.preventDefault());
  $('#areaOk').onclick = applyBounds;
})();
function submitAddFn() {
  const c = ED.latexToText(mqAdd.latex(), S.dec).trim();
  if (!c) return;
  addFn(c, null, true); mqAdd.latex('');
}

/* =========================================================
   Verlauf
   ========================================================= */
let HIST = store.get('history', []);
function addHistory(canon, tex, res) {
  if (HIST[0] && HIST[0].in === canon) HIST.shift();
  HIST.unshift({ in: canon, tex, dec: S.dec, out: res.outTex, t: Date.now() });
  HIST = HIST.slice(0, 200); store.set('history', HIST);
}
const outPrefix = o => /=|\\in\b|\\mathbb\{L\}/.test(o || '') ? '\\Rightarrow\\; ' : '= ';
function renderRecent() {
  const box = $('#recentHist');
  const skip = LAST && HIST[0] && LAST.raw === HIST[0].in ? 1 : 0;
  const items = HIST.slice(skip, skip + 5);
  box.hidden = !items.length; box.replaceChildren();
  if (!items.length) return;
  const head = el('div', 'recent-head');
  head.appendChild(el('span', 'label', T('hist_recent')));
  const all = el('button', 'linkbtn', T('show_all')); all.type = 'button'; all.onclick = showHistory; head.appendChild(all);
  box.appendChild(head);
  for (const h of items) {
    const b = el('button', 'card rcard'); b.type = 'button';
    const q = el('div', 'q'); b.appendChild(q); render(q, K.decFix(histTex(h)), false);
    const a = el('div', 'a'); b.appendChild(a); render(a, (h.out || '').length > 300 ? '\\dots' : outPrefix(h.out) + h.out, false);
    b.onclick = () => compute(h.in, histTex(h));
    box.appendChild(b);
  }
}
const histTex = h => (h.tex && h.dec === S.dec) ? h.tex : ED.textToLatex(h.in);
const fmtTime = t => { try { return new Intl.DateTimeFormat(S.lang, { dateStyle: 'short', timeStyle: 'short' }).format(t); } catch (e) { return new Date(t).toLocaleString(); } };

/* ---------- Blätter ---------- */
// Kein Zoomen im Hilfe-/Einstellungsfenster (iOS: Gesten-Ereignisse, Doppeltipp)
['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => { if (e.target.closest && e.target.closest('#sheet')) e.preventDefault(); }, { passive: false }));
document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1 && e.target.closest && e.target.closest('#sheet')) e.preventDefault(); }, { passive: false });
function openSheet(title, build) {
  $('#sheetTitle').textContent = title;
  const b = $('#sheetBody'), tl = $('#sheetTools'), ss = $('#sheetSearch');
  b.replaceChildren(); tl.replaceChildren(); ss.replaceChildren(); ss.className = 'sh-search';
  build(b, tl, ss);
  $('#sheet').classList.toggle('has-search', ss.childElementCount > 0);
  const wasOpen = !$('#sheet').hidden && !closeSheet.busy;
  if (closeSheet.anim) { closeSheet.anim.forEach(x => x.cancel()); closeSheet.anim = null; closeSheet.busy = false; }
  $('#sheet').hidden = false; $('#scrim').hidden = false;
  b.scrollTop = 0; sheetHdrSize();
  if (!wasOpen) sheetMove(true);
}
// Fenster gleiten von unten herein und beim Schließen wieder hinunter
const SHEET_EASE_IN = 'cubic-bezier(.32, .72, 0, 1)', SHEET_EASE_OUT = 'cubic-bezier(.4, 0, .9, .6)';
function sheetMove(show) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const sh = $('#sheet'), sc = $('#scrim'), D = show ? 460 : 300;
  const k = [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], f = [{ opacity: 0 }, { opacity: 1 }];
  const o = { duration: D, easing: show ? SHEET_EASE_IN : SHEET_EASE_OUT, direction: show ? 'normal' : 'reverse', fill: 'both' };
  const a1 = sh.animate(k, o), a2 = sc.animate(f, { ...o, easing: 'ease' });
  if (show) Promise.all([a1.finished, a2.finished]).then(() => { a1.cancel(); a2.cancel(); }).catch(() => { });
  return [a1, a2];
}
// Glas-Kapsel oben: Höhe messen, damit der Inhalt darunter beginnt
function sheetHdrSize() { const hd = $('#sheetHdr'); if (hd) $('#sheet').style.setProperty('--sh-h', hd.offsetHeight + 'px'); }
if (window.ResizeObserver) new ResizeObserver(sheetHdrSize).observe($('#sheetHdr'));
function closeSheet() {
  if ($('#sheet').hidden || closeSheet.busy) return;
  const done = () => { closeSheet.busy = false; closeSheet.anim = null; $('#sheet').hidden = true; $('#scrim').hidden = true; };
  const an = sheetMove(false);
  if (!an) return done();
  closeSheet.busy = true; closeSheet.anim = an;
  an[0].onfinish = () => { an.forEach(x => x.cancel()); done(); };
}
$('#scrim').onclick = closeSheet; $('#sheetClose').onclick = closeSheet;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

function showHistory() {
  openSheet(T('history'), body => {
    if (!HIST.length) { body.appendChild(el('p', 'empty', T('empty_hist'))); return; }
    for (const h of HIST) {
      const b = el('button', 'hitem'); b.type = 'button';
      const q = el('div', 'q'); b.appendChild(q); render(q, K.decFix(histTex(h)), false);
      const a = el('div', 'a'); b.appendChild(a); render(a, (h.out || '').length > 400 ? '\\dots' : outPrefix(h.out) + h.out, false);
      b.appendChild(el('time', null, fmtTime(h.t)));
      b.onclick = () => { closeSheet(); compute(h.in, histTex(h)); };
      body.appendChild(b);
    }
    const clr = btn(T('clear_hist'), null, () => {
      clr.hidden = true;
      const c = el('div', 'confirm'); c.appendChild(el('span', null, T('confirm_clear')));
      c.appendChild(btn(T('yes'), null, () => { HIST = []; store.set('history', HIST); showHistory(); renderRecent(); }, 'btn dangerfill'));
      c.appendChild(btn(T('cancel'), null, () => { c.remove(); clr.hidden = false; }));
      body.appendChild(c);
    }, 'btn danger');
    clr.style.marginTop = '14px'; body.appendChild(clr);
  });
}
function seg(options, value, onPick) {
  const s = el('div', 'seg');
  options.forEach(([v, l]) => { const b = el('button', null, l); b.type = 'button'; b.setAttribute('aria-pressed', v === value); b.onclick = () => { onPick(v); s.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); }; s.appendChild(b); });
  return s;
}
function field(label, ctrl, sub) { const f = el('div', 'field'); if (label) f.appendChild(el('div', 'flabel', label)); f.appendChild(ctrl); if (sub) f.appendChild(el('div', 'sub', sub)); return f; }
function toggleRow(label, id, checked, onChange) {
  const sw = el('label', 'switch'); sw.appendChild(el('span', null, label));
  const cb = el('input', 'toggle'); cb.type = 'checkbox'; cb.id = id; cb.checked = checked; cb.setAttribute('role', 'switch');
  cb.onchange = () => onChange(cb.checked); sw.appendChild(cb); return sw;
}
function showSettings() {
  openSheet(T('settings'), body => {
    const sel = el('select'); sel.id = 'langSel';
    LANGS.forEach(([c, n]) => { const o = el('option', null, n); o.value = c; if (c === S.lang) o.selected = true; sel.appendChild(o); });
    sel.onchange = () => { S.lang = sel.value; saveSettings(); applyLang(); showSettings(); };
    body.appendChild(field(T('language'), sel));
    body.appendChild(field(T('decimal'), seg([['.', '3.0'], [',', '3,0']], S.dec, v => {
      const cur = editorCanon(); S.dec = v; saveSettings(); setEditorText(cur); buildTools(); buildKeys(); if (LAST) compute(LAST.raw);
    }), T('decimal_note')));
    body.appendChild(field(T('angle'), seg([['rad', 'RAD'], ['deg', 'DEG']], S.angle, v => { S.angle = v; saveSettings(); syncAngle(); })));
    const rg = el('input'); rg.type = 'range'; rg.min = 4; rg.max = 15; rg.value = S.digits; rg.id = 'digits';
    const dl = el('div', 'sub', String(S.digits));
    rg.oninput = () => { S.digits = +rg.value; dl.textContent = rg.value; saveSettings(); };
    rg.onchange = () => { if (LAST) compute(LAST.raw); };
    const fd = field(T('digits'), rg); fd.appendChild(dl); body.appendChild(fd);
    body.appendChild(field(T('theme'), seg([['system', T('th_system')], ['light', T('th_light')], ['dark', T('th_dark')]], S.theme, v => { S.theme = v; saveSettings(); applyTheme(); })));
    body.appendChild(field(T('quad_method'), seg([['auto', T('q_auto')], ['pq', 'pq'], ['abc', 'abc'], ['binom', T('m_binom').split(' ')[0]]], S.quad || 'auto', v => { S.quad = v; saveSettings(); if (LAST) compute(LAST.raw); })));
    body.appendChild(field(null, toggleRow(T('steps_auto'), 'stepsAuto', S.stepsAuto, v => { S.stepsAuto = v; saveSettings(); })));
    // Logo
    const lg = el('div', 'logos');
    LOGO_ORDER.forEach(k => {
      const b = el('button', 'logo-opt'); b.type = 'button'; b.setAttribute('aria-pressed', S.logo === k);
      b.insertAdjacentHTML('afterbegin', LOGOS[k].svg('opt' + k));
      b.appendChild(el('span', null, LOGOS[k].name[S.lang === 'de' ? 'de' : 'en']));
      b.onclick = () => { S.logo = k; saveSettings(); applyLogo(); lg.querySelectorAll('.logo-opt').forEach(x => x.setAttribute('aria-pressed', x === b)); };
      lg.appendChild(b);
    });
    body.appendChild(field(T('logo'), lg));
    { // Drehgeschwindigkeit (×0,25 … ×4, logarithmisch)
      const wrap = el('div', 'speed-row'), inp = el('input'), out = el('output');
      inp.type = 'range'; inp.id = 'logoSpeed'; inp.min = '-2'; inp.max = '2'; inp.step = '0.25'; inp.value = String(Math.log2(S.logoSpeed || 1));
      const lab = () => { const f = Math.pow(2, +inp.value), b = $('#logoBtn'); const mob = matchMedia('(max-width: 560px)').matches, size = b.getBoundingClientRect().width || 40; const d = (mob ? 12 * 36 / size : 3 * 220 / size) / f; out.textContent = '×' + String(Number(f.toFixed(2))).replace('.', S.dec) + ' · ' + String(Number(d.toFixed(1))).replace('.', S.dec) + ' s'; };
      inp.oninput = () => { S.logoSpeed = Math.pow(2, +inp.value); saveSettings(); lab(); logo3D.kf && logo3D.kf(); };
      lab(); wrap.appendChild(inp); wrap.appendChild(out);
      body.appendChild(field(T('logo_speed'), wrap));
    }
    body.appendChild(field(null, toggleRow(T('logo_anim'), 'logoAnim', S.logoAnim !== false, v => { S.logoAnim = v; saveSettings(); logoIdle(); if (v) logoSpin(); })));
    // Updates
    const uf = el('div', 'field'); uf.appendChild(el('div', 'flabel', T('updates')));
    uf.appendChild(toggleRow(T('auto_update'), 'autoUpd', S.autoUpdate, v => { S.autoUpdate = v; saveSettings(); }));
    uf.appendChild(el('div', 'sub', T('upd_note')));
    const row = el('div', 'upd-row');
    const status = el('span', 'upd-status', T('version') + ' ' + APP_VERSION);
    const chk = btn(T('check_update'), '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/></svg>', () => checkUpdate(true, status, row));
    row.appendChild(chk); row.appendChild(status); uf.appendChild(row); body.appendChild(uf);
    // Variablen
    const vf = el('div', 'field'); vf.appendChild(el('div', 'flabel', T('variables')));
    const list = el('div', 'vars');
    const entries = [...Object.entries(K.funcs).map(([n, f]) => [n, `${n}(${f.params.join(',')}) := ${f.body}`, 'f']), ...Object.entries(K.vars).filter(([n]) => n !== 'ans').map(([n, v]) => [n, `${n} := ${v}`, 'v'])];
    if (!entries.length) list.appendChild(el('div', 'sub', T('no_vars')));
    entries.forEach(([n, txt, kind]) => {
      const r = el('div', 'var'); r.appendChild(el('span', null, toDisp(txt)));
      const dl2 = el('button', null, T('remove')); dl2.type = 'button'; dl2.onclick = () => { if (kind === 'f') delete K.funcs[n]; else delete K.vars[n]; saveVars(); r.remove(); };
      r.appendChild(dl2); list.appendChild(r);
    });
    vf.appendChild(list); body.appendChild(vf);
    const ab = el('div', 'about');
    ab.appendChild(el('p', null, T('about_text')));
    ab.appendChild(el('p', null, 'Prof Rechenzentrum · ' + T('version') + ' ' + APP_VERSION));
    ab.appendChild(el('p', 'by', T('made_by')));
    body.appendChild(ab);
  });
}
const EXAMPLES = [
  ['tab_basic', ['1/3+1/4*2', '(2+3)^2-12/8', 'sqrt(8)+sqrt(2)', 'root(27,3)', '20%*150', '10!', 'log(8,2)', 'sin(pi/6)']],
  ['tab_alg', ['x^2-5x+6=0', '2x+3=11', 'x^3-6x^2+11x-6=0', 'x^2+2x+5=0', 'x^2>=4', '(x+1)/(x-2)>=0', 'sin(x)=0.5', 'e^x=5', 'solve(x+y=3,x-y=1)', 'solve(a*x^2+b*x+c=0,x)', 'factor(x^2-4)', 'expand((x+1)^3)', 'apart(1/(x^2-1),x)', 'gcd(252,105)']],
  ['tab_seq', ['folge(1/n,1,8)', 'folge((n+1)/n)', 'folge(3n+2)', 'reihe(1/2^k)', 'reihe(1/k^2)', 'reihe((-1)^(k+1)/k)', 'reihe(1/k)', 'rekursiv(a/2+1,1,8)', 'muster(2,5,8,11)', 'muster(3,6,12,24)', 'muster(1,4,9,16,25)', 'x^4-5x^2+4=0']],
  ['tab_calc', ['diff(x^2*sin(x),x)', 'diff(sin(x^2+1),x)', 'diff(ln(x^2+1),x,2)', 'integrate(3x^2+cos(2x)-4/x,x)', 'integrate(x*e^x,x)', 'integrate(x^2,x,0,3)', 'integrate(e^(-x),x,0,Infinity)', 'limit(sin(x)/x,x,0)', 'limit((x^2-1)/(x-1),x,1)', 'limit((3x^2+1)/(x^2-2),x,Infinity)', 'sum(k^2,k,1,n)', 'sum(1/k^2,k,1,Infinity)', 'taylor(sin(x),x,0,7)', 'x^3-3x']],
  ['tab_mat', ['det([[2,0,1],[1,3,2],[1,1,4]])', 'inv([[1,2],[3,4]])', 'rref([[1,2,3],[4,5,6]])', 'eig([[2,1],[1,2]])', '[[1,2],[3,4]]*[[0,1],[1,0]]', 'cross([1,0,0],[0,1,0])', 'dot([1,2,3],[4,5,6])', 'norm([3,4])']],
  ['tab_stat', ['nCr(49,6)', 'binomPdf(10,0.5,3)', 'binomCdf(20,0.3,5)', 'normCdf(-1,1,0,1)', 'mean(2,4,4,4,5,5,7,9)', 'std([2,4,4,4,5,5,7,9])', 'pctval(19,250)', 'pctchg(80,100)']],
  ['tab_const', ['_R*298.15', '_NA*_kB', '_h*_c/(500*10^(-9))', '_F/_NA', 'a:=5', 'f(x):=x^2-4', 'f(3)']]
];
const GL_ICON = { recent: ICON_RECENT, back: ICON_BACK, paste: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>', pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13 7 4 4"/></svg>' };
function glossary(body, search) {
  const q = searchPill(search || body);
  const list = el('div', 'gl'); body.appendChild(list);
  const L = S.lang === 'de' ? 1 : 2;
  const draw = () => {
    const term = q.value.trim().toLowerCase(); list.replaceChildren();
    for (const [grp, items] of GLOSS) {
      const hits = items.filter(it => !term || (it[L] + ' ' + it[0]).toLowerCase().includes(term));
      if (!hits.length) continue;
      list.appendChild(el('h3', 'gl-h', T(grp)));
      for (const it of hits) {
        const [sym, , , ex] = it, [name, desc] = it[L].split('|');
        const row = el('div', 'gl-row');
        const sb = el('div', 'gl-sym');
        if (sym.startsWith('i:')) sb.innerHTML = GL_ICON[sym.slice(2)] || '';
        else if (sym.startsWith('t:')) sb.textContent = sym.slice(2);
        else render(sb, sym, false);
        row.appendChild(sb);
        const tx = el('div', 'gl-txt'); tx.appendChild(el('b', null, name)); tx.appendChild(el('span', null, desc));
        if (ex) { const b = el('button', 'gl-ex'); b.type = 'button'; render(b, K.decFix(ED.textToLatex(ex)), false); b.onclick = () => { closeSheet(); compute(ex); }; tx.appendChild(b); }
        row.appendChild(tx); list.appendChild(row);
      }
    }
    if (!list.children.length) list.appendChild(el('p', 'empty', '—'));
  };
  q.oninput = draw; draw();
}
const INT_TABLE = [
  ['it_g_pow', [['\\frac{x^{n+1}}{n+1}', 'x^{n}\\;(n\\neq -1)', 'x^n'], ['\\ln|x|', '\\frac{1}{x}', '1/x'], ['\\tfrac{2}{3}x\\sqrt{x}', '\\sqrt{x}', 'sqrt(x)'], ['\\frac{(ax+b)^{n+1}}{a(n+1)}', '(ax+b)^{n}', '(2x+1)^5']]],
  ['it_g_exp', [['e^{x}', 'e^{x}', 'e^x'], ['\\tfrac{1}{a}e^{ax}', 'e^{ax}', 'e^(2x)'], ['\\frac{a^{x}}{\\ln a}', 'a^{x}', '2^x'], ['x\\ln x-x', '\\ln x', 'ln(x)'], ['(x-1)\\,e^{x}', 'x\\,e^{x}', 'x*e^x'], ['\\tfrac{\\sqrt{\\pi}}{2}\\operatorname{erf}(x)', 'e^{-x^{2}}', 'e^(-x^2)']]],
  ['it_g_trig', [['-\\cos x', '\\sin x', 'sin(x)'], ['\\sin x', '\\cos x', 'cos(x)'], ['-\\ln|\\cos x|', '\\tan x', 'tan(x)'], ['\\ln|\\sin x|', '\\cot x', 'cot(x)'], ['\\tan x', '\\frac{1}{\\cos^{2}x}', '1/cos(x)^2'], ['-\\cot x', '\\frac{1}{\\sin^{2}x}', '1/sin(x)^2'], ['\\tfrac{1}{2}(x-\\sin x\\cos x)', '\\sin^{2}x', 'sin(x)^2'], ['\\tfrac{1}{2}(x+\\sin x\\cos x)', '\\cos^{2}x', 'cos(x)^2']]],
  ['it_g_hyp', [['\\cosh x', '\\sinh x', 'sinh(x)'], ['\\sinh x', '\\cosh x', 'cosh(x)'], ['\\ln(\\cosh x)', '\\tanh x', 'tanh(x)']]],
  ['it_g_root', [['\\arctan x', '\\frac{1}{1+x^{2}}', '1/(1+x^2)'], ['\\tfrac{1}{a}\\arctan\\tfrac{x}{a}', '\\frac{1}{a^{2}+x^{2}}', '1/(4+x^2)'], ['\\tfrac{1}{2}\\ln\\left|\\tfrac{1+x}{1-x}\\right|', '\\frac{1}{1-x^{2}}', '1/(1-x^2)'], ['\\arcsin x', '\\frac{1}{\\sqrt{1-x^{2}}}', '1/sqrt(1-x^2)'], ['\\ln\\left|x+\\sqrt{x^{2}+1}\\right|', '\\frac{1}{\\sqrt{x^{2}+1}}', '1/sqrt(x^2+1)'], ['\\ln\\left|x+\\sqrt{x^{2}-1}\\right|', '\\frac{1}{\\sqrt{x^{2}-1}}', '1/sqrt(x^2-1)'], ['\\tfrac{1}{2}\\left(x\\sqrt{1-x^{2}}+\\arcsin x\\right)', '\\sqrt{1-x^{2}}', 'sqrt(1-x^2)'], ['\\tfrac{1}{2}\\left(x\\sqrt{x^{2}+1}+\\ln\\left|x+\\sqrt{x^{2}+1}\\right|\\right)', '\\sqrt{x^{2}+1}', 'sqrt(x^2+1)']]],
  ['it_g_arc', [['x\\arcsin x+\\sqrt{1-x^{2}}', '\\arcsin x', 'arcsin(x)'], ['x\\arccos x-\\sqrt{1-x^{2}}', '\\arccos x', 'arccos(x)'], ['x\\arctan x-\\tfrac{1}{2}\\ln(1+x^{2})', '\\arctan x', 'arctan(x)']]],
  ['it_g_rule', [['\\ln|g(x)|', '\\frac{g\\prime(x)}{g(x)}', 'e^x/(1+e^x)'], ['\\tfrac{1}{2}g(x)^{2}', 'g\\prime(x)\\,g(x)', 'sin(x)*cos(x)']]]
];
/* Reiter in Seiten: ▶ blättert zur nächsten Seite, ◀ zurück – nichts wird abgeschnitten */
const TRI_R = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1.8 10 6l-6.5 4.2Z"/></svg>';
const TRI_L = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M8.5 1.8 2 6l6.5 4.2Z"/></svg>';
function tabPager(pages, value, onPick) {
  const box = el('div', 'tabpager');
  let page = Math.max(0, pages.findIndex(p => p.some(([v]) => v === value)));
  const draw = dir => {
    // Seitenwechsel: alte Reiter gleiten hinaus, neue herein (▶ nach links, ◀ nach rechts)
    let ghost = null;
    if (dir && box.childElementCount && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ghost = el('div', 'tp-ghost'); [...box.children].forEach(c => ghost.appendChild(c.cloneNode(true)));
    }
    box.replaceChildren();
    if (page > 0) { const pv = el('button', 'tp-arrow'); pv.type = 'button'; pv.innerHTML = TRI_L; pv.setAttribute('aria-label', S.lang === 'de' ? 'Vorherige Reiter' : 'Previous tabs'); pv.onclick = () => { page--; draw(-1); }; box.appendChild(pv); }
    pages[page].forEach(([v, l]) => { const b = el('button', 'tp-tab', l); b.type = 'button'; b.setAttribute('aria-pressed', v === value); b.onclick = () => onPick(v); box.appendChild(b); });
    if (page < pages.length - 1) { const nx = el('button', 'tp-arrow'); nx.type = 'button'; nx.innerHTML = TRI_R; nx.setAttribute('aria-label', S.lang === 'de' ? 'Weitere Reiter' : 'More tabs'); nx.onclick = () => { page++; draw(1); }; box.appendChild(nx); }
    queueMicrotask(fit);
    if (ghost) {
      const ease = 'cubic-bezier(.3, .8, .3, 1)', D = 320, kids = [...box.children];
      box.appendChild(ghost);
      ghost.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-dir * 60}%)`, opacity: 0 }], { duration: D, easing: ease }).onfinish = () => ghost.remove();
      kids.forEach(k => k.animate([{ transform: `translateX(${dir * 60}%)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: D, easing: ease }));
    }
  };
  // Passt eine Seite nicht in die Breite (schmales Gerät, lange Wörter), wandert der letzte Reiter auf die nächste Seite
  const fit = () => {
    if (!box.isConnected || !box.clientWidth) return;
    let guard = 12;
    const need = () => { const ks = [...box.children].filter(k => !k.classList.contains('tp-ghost')); return ks.reduce((s, k) => s + k.scrollWidth, 0) + 3 * (ks.length - 1) + 6; };
    while (guard-- && need() > box.clientWidth + 1 && pages[page].length > 1) {
      const moved = pages[page].pop();
      if (page === pages.length - 1) pages.push([]);
      pages[page + 1].unshift(moved);
      if (moved[0] === value) page++;
      box.replaceChildren(); draw(); return;
    }
  };
  pages = pages.map(p => p.slice()); draw(); return box;
}
/* Suche: runder Lupen-Knopf, klappt per Tippen zum Safari-Suchfeld auf, Tippen außerhalb klappt zu */
const ICON_LUPE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>';
function searchPill(host, id = 'glSearch', ph = T('search')) {
  const box = el('div', 'sp'); host.appendChild(box);
  const lupe = el('button', 'sp-lupe'); lupe.type = 'button'; lupe.innerHTML = ICON_LUPE; lupe.setAttribute('aria-label', T('search'));
  const q = el('input', 'sp-in'); q.type = 'search'; q.id = id; q.placeholder = ph; q.enterKeyHint = 'search'; q.autocomplete = 'off';
  const clr = el('button', 'sp-clr'); clr.type = 'button'; clr.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8l8 8M16 8l-8 8"/></svg>'; clr.setAttribute('aria-label', 'Löschen');
  box.append(lupe, q, clr);
  const sync = () => box.classList.toggle('filled', !!q.value);
  const open = () => { if (box.classList.contains('open')) return; host.classList.add('open'); box.classList.add('open'); setTimeout(() => q.focus(), 60); };
  const close = () => { host.classList.remove('open'); box.classList.remove('open'); q.blur(); sync(); };
  lupe.onclick = () => box.classList.contains('open') ? q.focus() : open();
  clr.onclick = () => { q.value = ''; q.dispatchEvent(new Event('input')); sync(); q.focus(); };
  q.addEventListener('input', sync);
  q.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') close(); });
  const outside = e => { if (!box.isConnected) { document.removeEventListener('pointerdown', outside, true); return; } if (box.classList.contains('open') && !box.contains(e.target)) {
    close();
    // Tippen in die Liste schließt nur die Suche, löst aber keinen Eintrag aus
    if (e.target.closest && e.target.closest('#sheetBody')) { const eat = ev => { ev.stopPropagation(); ev.preventDefault(); }; document.addEventListener('click', eat, { capture: true, once: true }); setTimeout(() => document.removeEventListener('click', eat, true), 500); }
  } };
  document.addEventListener('pointerdown', outside, true);
  return q;
}
function showHelp(view = 'gl') {
  openSheet(T('help'), (body, tools, search) => {
    tools.appendChild(tabPager([[['gl', T('glossary')], ['ex', T('examples')], ['fs', T('formulas')]], [['it', T('int_table')], ['uc', T('unit_circle')]]], view, v => showHelp(v)));
    if (view === 'gl') return glossary(body, search);
    if (view === 'fs') return formulaView(body, search);
    if (view === 'uc') return unitCircleView(body);
    if (view === 'it') {
      body.appendChild(el('p', 'ex-note', T('it_hint')));
      const wrap = el('div', 'it-wrap'), tb = el('div', 'it-tab');
      const hd = el('div', 'it-hd'); hd.appendChild(el('span', null, T('it_F'))); hd.appendChild(el('span', null, T('it_f'))); tb.appendChild(hd);
      INT_TABLE.forEach(([g, list]) => {
        tb.appendChild(el('div', 'it-grp', T(g)));
        list.forEach(([F, f, ex]) => {
          const r = el('button', 'it-r'); r.type = 'button';
          const a = el('span', 'it-F'), c = el('span', 'it-f'); r.appendChild(a); r.appendChild(c);
          render(a, F, false); render(c, f, false);
          r.onclick = () => { closeSheet(); compute('integrate(' + ex + ',x)'); };
          tb.appendChild(r);
        });
      });
      wrap.appendChild(tb); body.appendChild(wrap); return;
    }
    body.appendChild(el('p', 'ex-note', T('hold_hint')));
    for (const [tab, list] of EXAMPLES) {
      const g = el('div', 'ex-group'); g.appendChild(el('h3', null, T(tab)));
      const wrap = el('div', 'ex');
      list.forEach(ex => { const b = el('button'); b.type = 'button'; render(b, K.decFix(ED.textToLatex(ex)), false); b.onclick = () => { closeSheet(); compute(ex); }; wrap.appendChild(b); });
      g.appendChild(wrap); body.appendChild(g);
    }
  });
}

/* ---------- Logo, Icon, Easter Egg ---------- */
function applyLogo() {
  logo3D(); logoIdle();
  try {
    const svg = LOGOS[S.logo].svg('ico').replace('<svg ', '<svg width="180" height="180" ');
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 180;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 180, 180);
      const url = c.toDataURL('image/png');
      $('#favicon').href = url; $('#touchicon').href = url;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  } catch (e) { }
}
let taps = [];
function logoSpin() {
  if (S.logoAnim === false) return;
  const b = $('#logoBtn');
  if (b.classList.contains('l3d')) { b.classList.remove('anim'); void b.offsetWidth; b.classList.add('anim'); b.querySelectorAll('.l-obj').forEach(o => { o.style.animationDelay = '0s'; }); return; }
  b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
  setTimeout(() => b.classList.remove('spin'), 900);
}
function logoWink() {
  const b = $('#logoBtn'); if (S.logoAnim === false || !b.classList.contains('l3d')) return;
  b.classList.remove('wink'); void b.offsetWidth; b.classList.add('wink');
  setTimeout(() => b.classList.remove('wink'), 900);
}
function logoIdle() { $('#logoBtn').classList.toggle('anim', S.logoAnim !== false); }
function logo3D() { // Ebenen-Aufbau für die 3D-Drehung (nur Prof-Brille)
  const L = LOGOS[S.logo].layers, btn = $('#logoBtn');
  btn.classList.toggle('l3d', !!L);
  if (!L) { btn.innerHTML = LOGOS[S.logo].svg('hdr'); return; }
  const N = 9, sv = (inner, st) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${st ? ` style="${st}"` : ''}>${inner}</svg>`;
  const solid = (inner, front, eye) => { let o = ''; for (let i = 0; i < N; i++) { const cap = i === 0 || i === N - 1, b = cap ? 1 : (0.55 + 0.1 * Math.sin(i / (N - 1) * Math.PI)).toFixed(2); o += sv((cap && front ? inner + front : inner) + (eye ? `<g class="l-reye">${eye.c}${cap ? eye.s : ''}</g>` : ''), `--i:${i};--b:${b}`); } return o; };
  // Dauer je Drehung antiproportional zur Größe (3 s bei 220 px), danach 3 s Pause
  const setKF = () => {
    const size = btn.getBoundingClientRect().width || 40, mob = matchMedia('(max-width: 560px)').matches, d = (mob ? 12 * 36 / size : 3 * 220 / size) / (S.logoSpeed || 1), T = 2 * d + 2, p1 = (d / T * 100).toFixed(3), p2 = (2 * d / T * 100).toFixed(3);
    let st = document.getElementById('lgKF'); if (!st) { st = document.createElement('style'); st.id = 'lgKF'; document.head.appendChild(st); }
    const e = 'animation-timing-function: cubic-bezier(.65, 0, .35, 1);';
    st.textContent = `@keyframes lgFace { 0% { transform: rotateY(0deg); ${e} } ${p1}%, 100% { transform: rotateY(360deg); } } @keyframes lgGlass { 0%, ${p1}% { transform: rotateY(0deg); ${e} } ${p2}%, 100% { transform: rotateY(-360deg); } }`;
    btn.style.setProperty('--lgT', T.toFixed(3) + 's'); btn.dataset.rot = d.toFixed(3);
  };
  // Zwinkern: nach jeweils 10 normalen Durchgängen zwinkert das =-Auge in der Pause
  logo3D.cycle = 0;
  if (!logo3D.wired) {
    logo3D.wired = true;
    const onCycle = e => {
      if (!e.target.classList || !e.target.classList.contains('l-glass')) return;
      logo3D.cycle++;
      if (logo3D.cycle % 5 === 0) { const d = parseFloat(btn.dataset.rot) || 1; clearTimeout(logo3D.wt); logo3D.wt = setTimeout(logoWink, (2 * d + 0.4) * 1000); }
    };
    btn.addEventListener('animationstart', e => { if (e.animationName === 'lgGlass') { logo3D.cycle = 0; onCycle(e); } });
    btn.addEventListener('animationiteration', e => { if (e.animationName === 'lgGlass') onCycle(e); });
  }
  setKF(); if (!logo3D.mq) { logo3D.mq = matchMedia('(max-width: 560px)'); logo3D.mq.addEventListener('change', () => logo3D.kf && logo3D.kf()); } logo3D.kf = setKF;
  btn.innerHTML = sv(L.bg).replace('<svg ', '<svg class="l-bg" ') + `<span class="l-scene"><span class="l-obj l-face">${solid(L.face)}</span><span class="l-obj l-glass">${solid(L.glass, L.signs, { c: L.reye, s: L.eq })}</span></span>`;
}
$('#logoBtn').addEventListener('click', () => {
  logoSpin();
  const now = Date.now(); taps = taps.filter(t => now - t < 3000); taps.push(now);
  if (taps.length >= 7) { taps = []; mathRain(); }
});
function mathRain() {
  const cv = $('#rain'); cv.hidden = false;
  const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const SYM = ['∑', '∫', 'π', '√', '∞', '∂', 'Δ', 'θ', 'λ', 'e', 'i', '≈', '≠', '±', '÷', '×', '∇', 'φ', 'σ', 'μ', 'x²', 'n!', '∏', '≤', '≥', 'dx', 'lim', 'α', 'β', 'ω', '%', '½', '∈', 'ℝ', '∮'];
  const cols = ['--g1', '--g2', '--g3', '--g4', '--gold', '--accent'].map(cssVar);
  const slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = slow ? 30 : Math.min(140, Math.round(W / 6));
  const P2 = Array.from({ length: N }, () => ({
    s: SYM[Math.floor(Math.random() * SYM.length)], x: Math.random() * W, y: -40 - Math.random() * H * 0.9,
    v: (slow ? 60 : 160) + Math.random() * (slow ? 60 : 260), r: Math.random() * Math.PI, vr: (Math.random() - .5) * 3,
    size: 16 + Math.random() * 30, col: cols[Math.floor(Math.random() * cols.length)], sway: Math.random() * 2 * Math.PI
  }));
  let last = performance.now(), t0 = last;
  const tick = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const age = (now - t0) / 1000;
    c.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of P2) {
      p.y += p.v * dt; p.r += p.vr * dt; p.sway += dt * 2;
      if (p.y < H + 60) alive++;
      c.save(); c.translate(p.x + Math.sin(p.sway) * 14, p.y); c.rotate(p.r);
      c.globalAlpha = Math.max(0, Math.min(1, 1.2 - Math.max(0, age - 4)));
      c.fillStyle = p.col; c.font = `500 ${p.size}px "STIX Two Text", "Times New Roman", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(p.s, 0, 0); c.restore();
    }
    if (alive && age < 6) requestAnimationFrame(tick); else { c.clearRect(0, 0, W, H); cv.hidden = true; }
  };
  requestAnimationFrame(tick);
}

/* ---------- Updates ---------- */
const newer = (a, b) => { const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; } return false; };
async function fetchVersion() {
  const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status);
  return (await r.json()).version;
}
async function checkUpdate(manual, status, row) {
  if (status) { status.className = 'upd-status'; status.textContent = T('upd_checking'); }
  try {
    const v = await fetchVersion();
    if (newer(v, APP_VERSION)) {
      if (!manual) {
        if (ss.get('profrz.updTried') === v) return; // nicht in Schleife neu laden
        ss.set('profrz.updTried', v); location.reload(); return;
      }
      status.textContent = T('upd_found', { v });
      if (!row.querySelector('.primary')) row.appendChild(btn(T('upd_install'), null, () => location.reload(), 'btn primary'));
    } else if (status) { status.className = 'upd-status ok'; status.textContent = T('upd_latest') + ' (' + APP_VERSION + ')'; }
  } catch (e) { if (status) status.textContent = T('upd_fail'); }
}

/* ---------- Sprache, Thema, Winkel ---------- */
function applyLang() {
  setLangIndex(S.lang);
  document.documentElement.lang = S.lang;
  document.documentElement.dir = RTL.includes(S.lang) ? 'rtl' : 'ltr';
  $('#ph').textContent = T('placeholder').replace(/,.*$|：.*$|،.*$/, '').replace(/[,،]$/, '');
  $('#goLbl').textContent = T('compute');
  $('#helpBtn').title = $('#helpBtn').ariaLabel = T('help');
  $('#histBtn').title = $('#histBtn').ariaLabel = T('history');
  $('#setBtn').title = $('#setBtn').ariaLabel = T('settings');
  $('#gTitle').textContent = T('graph'); $('#gResetLbl').textContent = T('reset_view');
  if (!$('#graphcard').hidden) { syncGraphUI(); showInfo(); }
  $('#gHint').textContent = T('graph_hint'); $('#addfnBtn').title = T('add_fn'); $('#areaOk').textContent = '✓';
  $('#mqAddPh').textContent = T('add_fn') + ' …';
  $('#kpToggle').ariaLabel = T('keypad');
  $('#editBtn').title = $('#editBtn').ariaLabel = T('edit_keys');
  $('#resetOrder').title = $('#resetOrder').ariaLabel = T('reset_order');
  $('#pasteBtn').title = $('#pasteBtn').ariaLabel = T('paste');
  $('#pasteIn').placeholder = T('paste_here'); $('#pasteOk').textContent = T('paste_apply');
  buildTools(); buildTabs(); buildKeys();
  if (LAST && LAST.raw) compute(LAST.raw);
}
function applyTheme() {
  const r = document.documentElement;
  if (S.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme);
  requestAnimationFrame(draw);
}
function syncAngle() {
  const b = $('#angleBtn');
  b.innerHTML = S.angle === 'rad' ? '<b>RAD</b><i> · deg</i>' : '<i>rad · </i><b>DEG</b>';
  b.title = T('angle');
}
$('#angleBtn').onclick = () => { S.angle = S.angle === 'rad' ? 'deg' : 'rad'; saveSettings(); syncAngle(); if (LAST && LAST.raw) compute(LAST.raw); };
$('#histBtn').onclick = showHistory;
$('#setBtn').onclick = showSettings;
$('#helpBtn').onclick = () => showHelp('gl');
$('#goBtn').addEventListener('pointerdown', e => e.preventDefault());
$('#goBtn').onclick = () => compute();
$('#kpToggle').onclick = () => { const k = $('#keypad'); k.classList.toggle('min'); $('#kpToggle').textContent = k.classList.contains('min') ? '▴' : '▾'; syncKpHeight(); };
function syncKpHeight() {
  const k = $('#keypad');
  const h = window.matchMedia('(max-width: 979px)').matches ? k.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty('--kp-h', h + 'px');
}
new ResizeObserver(syncKpHeight).observe($('#keypad'));
window.addEventListener('resize', syncKpHeight);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestAnimationFrame(draw));

/* ---------- Start ---------- */
K.prepM = s => K._prepM(s);
applyTheme(); syncAngle(); applyLogo(); applyLang(); whenMathJax();
(function start() {
  const last = HIST[0];
  const ex = last ? last.in : 'x^2-5x+6=0';
  setEditorText(ex);
  try { const r = K.run(toDisp(ex)); r.raw = ex; r.edTex = ED.embedTo(mf.latex(), ED.mxPmat); if (!ENGINE_TEX.has(r.kind) && r.kind !== 'def') r.inTex = K.decFix(r.edTex); LAST = r; showResult(r, !last); } catch (e) { }
  renderRecent();
  if (!TOUCH) mf.focus();
  mf.moveToRightEnd(); keepCursor();
  if (S.autoUpdate) checkUpdate(false);
})();
