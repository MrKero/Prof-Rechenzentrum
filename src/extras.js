/* ---------- Formelsammlung & Einheitskreis (Hilfe-Fenster) ---------- */
const FORMULAS = [
  ['fs_alg', [
    ['1. binomische Formel', '(a+b)^2=a^2+2ab+b^2'], ['2. binomische Formel', '(a-b)^2=a^2-2ab+b^2'], ['3. binomische Formel', '(a+b)(a-b)=a^2-b^2'],
    ['Potenzgesetze', 'a^m\\cdot a^n=a^{m+n},\\quad \\frac{a^m}{a^n}=a^{m-n},\\quad (a^m)^n=a^{mn},\\quad a^{-n}=\\frac{1}{a^n}'],
    ['Wurzeln', '\\sqrt[n]{a}=a^{\\frac{1}{n}},\\quad \\sqrt[n]{a^m}=a^{\\frac{m}{n}},\\quad \\sqrt{ab}=\\sqrt{a}\\sqrt{b}'],
    ['Logarithmengesetze', '\\log_b(xy)=\\log_b x+\\log_b y,\\quad \\log_b\\frac{x}{y}=\\log_b x-\\log_b y,\\quad \\log_b x^r=r\\log_b x'],
    ['Basiswechsel', '\\log_b x=\\frac{\\ln x}{\\ln b},\\qquad b^{\\log_b x}=x'],
    ['pq-Formel', 'x^2+px+q=0\\;\\Rightarrow\\; x_{1,2}=-\\frac{p}{2}\\pm\\sqrt{\\left(\\frac{p}{2}\\right)^2-q}'],
    ['abc-Formel', 'ax^2+bx+c=0\\;\\Rightarrow\\; x_{1,2}=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'],
    ['Satz von Vieta', 'x_1+x_2=-p,\\qquad x_1\\cdot x_2=q'],
    ['Bruchrechnung', '\\frac{a}{b}+\\frac{c}{d}=\\frac{ad+bc}{bd},\\qquad \\frac{a}{b}:\\frac{c}{d}=\\frac{a}{b}\\cdot\\frac{d}{c}']]],
  ['fs_geo', [
    ['Pythagoras', 'a^2+b^2=c^2'], ['Kreis', 'U=2\\pi r,\\qquad A=\\pi r^2'], ['Dreieck', 'A=\\tfrac{1}{2}\\,g\\,h'], ['Trapez', 'A=\\tfrac{1}{2}(a+c)\\,h'],
    ['Kugel', 'V=\\tfrac{4}{3}\\pi r^3,\\qquad O=4\\pi r^2'], ['Zylinder', 'V=\\pi r^2h,\\qquad O=2\\pi r^2+2\\pi rh'], ['Kegel', 'V=\\tfrac{1}{3}\\pi r^2h,\\qquad O=\\pi r^2+\\pi rs'], ['Prisma / Pyramide', 'V=G\\,h,\\qquad V=\\tfrac{1}{3}G\\,h']]],
  ['fs_trig', [
    ['Rechtwinkliges Dreieck', '\\sin\\alpha=\\frac{\\text{GK}}{\\text{HY}},\\quad \\cos\\alpha=\\frac{\\text{AK}}{\\text{HY}},\\quad \\tan\\alpha=\\frac{\\text{GK}}{\\text{AK}}'],
    ['Trigonometrischer Pythagoras', '\\sin^2\\alpha+\\cos^2\\alpha=1,\\qquad \\tan\\alpha=\\frac{\\sin\\alpha}{\\cos\\alpha}'],
    ['Sinussatz', '\\frac{a}{\\sin\\alpha}=\\frac{b}{\\sin\\beta}=\\frac{c}{\\sin\\gamma}'], ['Kosinussatz', 'c^2=a^2+b^2-2ab\\cos\\gamma'],
    ['Additionstheoreme', '\\sin(\\alpha\\pm\\beta)=\\sin\\alpha\\cos\\beta\\pm\\cos\\alpha\\sin\\beta\\\\ \\cos(\\alpha\\pm\\beta)=\\cos\\alpha\\cos\\beta\\mp\\sin\\alpha\\sin\\beta'],
    ['Doppelwinkel', '\\sin 2\\alpha=2\\sin\\alpha\\cos\\alpha,\\qquad \\cos 2\\alpha=\\cos^2\\alpha-\\sin^2\\alpha'],
    ['Bogenmaß', 'x=\\frac{\\pi}{180^\\circ}\\cdot\\alpha,\\qquad 180^\\circ\\;\\widehat{=}\\;\\pi']]],
  ['fs_ana', [
    ['Summen- und Faktorregel', '(f+g)\'=f\'+g\',\\qquad (c\\,f)\'=c\\,f\''], ['Produktregel', '(u\\,v)\'=u\'v+u\\,v\''], ['Quotientenregel', '\\left(\\frac{u}{v}\\right)\'=\\frac{u\'v-u\\,v\'}{v^2}'],
    ['Kettenregel', '\\big(f(g(x))\\big)\'=f\'(g(x))\\cdot g\'(x)'],
    ['Grundableitungen', '(x^n)\'=n\\,x^{n-1},\\; (e^x)\'=e^x,\\; (\\ln x)\'=\\frac{1}{x},\\; (\\sin x)\'=\\cos x,\\; (\\cos x)\'=-\\sin x'],
    ['Hauptsatz', '\\int_a^b f(x)\\,dx=F(b)-F(a)'], ['Partielle Integration', '\\int u\\,v\'\\,dx=u\\,v-\\int u\'v\\,dx'], ['Substitution', '\\int f(g(x))\\,g\'(x)\\,dx=\\int f(u)\\,du'],
    ['Tangente', 't(x)=f\'(x_0)\\,(x-x_0)+f(x_0)'], ['Newton-Verfahren', 'x_{n+1}=x_n-\\frac{f(x_n)}{f\'(x_n)}'],
    ['Extremstellen', 'f\'(x_0)=0\\;\\wedge\\; f\'\'(x_0)\\neq 0'], ['Wendestellen', 'f\'\'(x_0)=0\\;\\wedge\\; f\'\'\'(x_0)\\neq 0'],
    ['Stetigkeit in x₀', '\\lim_{x\\to x_0^-}f(x)=\\lim_{x\\to x_0^+}f(x)=f(x_0)'], ['Mittelwert', '\\bar m=\\frac{1}{b-a}\\int_a^b f(x)\\,dx'],
    ['Bogenlänge', 'L=\\int_a^b\\sqrt{1+f\'(x)^2}\\,dx'], ['Kurvenintegral', '\\int_C f\\,ds=\\int_a^b f(\\vec r(t))\\,|\\vec r\\,\'(t)|\\,dt']]],
  ['fs_vec', [
    ['Betrag', '|\\vec a|=\\sqrt{a_1^2+a_2^2+a_3^2}'], ['Skalarprodukt', '\\vec a\\cdot\\vec b=a_1b_1+a_2b_2+a_3b_3=|\\vec a|\\,|\\vec b|\\cos\\varphi'],
    ['Kreuzprodukt', '\\vec a\\times\\vec b=\\begin{pmatrix}a_2b_3-a_3b_2\\\\a_3b_1-a_1b_3\\\\a_1b_2-a_2b_1\\end{pmatrix}'],
    ['Gerade', 'g:\\;\\vec x=\\vec p+t\\,\\vec u'], ['Ebene (Parameterform)', 'E:\\;\\vec x=\\vec p+r\\,\\vec u+s\\,\\vec v'], ['Ebene (Normalenform)', 'E:\\;\\vec n\\cdot(\\vec x-\\vec p)=0'],
    ['Abstand Punkt – Ebene', 'd=\\frac{|n_1x_1+n_2x_2+n_3x_3-d_0|}{|\\vec n|}']]],
  ['fs_seq', [
    ['Arithmetische Folge', 'a_n=a_1+(n-1)\\,d,\\qquad s_n=\\frac{n}{2}(a_1+a_n)'], ['Geometrische Folge', 'a_n=a_1\\,q^{n-1},\\qquad s_n=a_1\\frac{q^n-1}{q-1}'],
    ['Geometrische Reihe', '\\sum_{k=0}^{\\infty}q^k=\\frac{1}{1-q}\\quad(|q|<1)'], ['Eulersche Zahl', 'e=\\lim_{n\\to\\infty}\\left(1+\\frac{1}{n}\\right)^n'], ['Gauß-Summe', '\\sum_{k=1}^{n}k=\\frac{n(n+1)}{2}']]],
  ['fs_sto', [
    ['Laplace', 'P(A)=\\frac{|A|}{|\\Omega|}'], ['Bedingte Wahrscheinlichkeit', 'P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}'], ['Binomialkoeffizient', '\\binom{n}{k}=\\frac{n!}{k!\\,(n-k)!}'],
    ['Binomialverteilung', 'P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k},\\quad \\mu=np,\\quad \\sigma=\\sqrt{np(1-p)}'],
    ['Erwartungswert / Varianz', 'E(X)=\\sum x_i\\,p_i,\\qquad V(X)=\\sum (x_i-\\mu)^2p_i'],
    ['Normalverteilung', '\\varphi(x)=\\frac{1}{\\sigma\\sqrt{2\\pi}}\\,e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}']]],
  ['fs_cx', [
    ['Imaginäre Einheit', 'i^2=-1,\\qquad z=a+bi'], ['Betrag', '|z|=\\sqrt{a^2+b^2}'], ['Euler-Formel', 'e^{i\\varphi}=\\cos\\varphi+i\\sin\\varphi'],
    ['Polarform', 'z=r\\,(\\cos\\varphi+i\\sin\\varphi)=r\\,e^{i\\varphi}'], ['de Moivre', 'z^n=r^n\\,e^{in\\varphi}']]],
  ['fs_chem', [
    ['Stoffmenge', 'n=\\frac{m}{M}=\\frac{N}{N_A}'], ['Konzentration', 'c=\\frac{n}{V},\\qquad \\beta=\\frac{m}{V}'], ['Verdünnung', 'c_1V_1=c_2V_2'],
    ['Ideales Gas', 'pV=nRT'], ['pH-Wert', '\\mathrm{pH}=-\\lg c(\\mathrm{H_3O^+}),\\qquad \\mathrm{pH}+\\mathrm{pOH}=14\\;(25^\\circ\\mathrm{C})'],
    ['Henderson-Hasselbalch', '\\mathrm{pH}=\\mathrm{p}K_S+\\lg\\frac{c(\\mathrm{A^-})}{c(\\mathrm{HA})}'], ['Massenwirkungsgesetz', 'K_c=\\frac{c(\\mathrm{C})^{\\gamma}\\,c(\\mathrm{D})^{\\delta}}{c(\\mathrm{A})^{\\alpha}\\,c(\\mathrm{B})^{\\beta}}'],
    ['Freie Enthalpie', '\\Delta G=\\Delta H-T\\Delta S,\\qquad \\Delta G^\\circ=-RT\\ln K'], ['Arrhenius', 'k=A\\,e^{-\\frac{E_A}{RT}}'],
    ['Kinetik 1. Ordnung', 'c(t)=c_0\\,e^{-kt},\\qquad t_{1/2}=\\frac{\\ln 2}{k}'], ['Nernst-Gleichung', 'E=E^\\circ+\\frac{RT}{zF}\\ln\\frac{c(\\mathrm{Ox})}{c(\\mathrm{Red})}'],
    ['Lambert-Beer', 'E_\\lambda=\\lg\\frac{I_0}{I}=\\varepsilon\\,c\\,d']]]
];
function formulaView(body, search) {
  const q = searchPill(search || body, 'fsSearch', T('fs_search'));
  const wrap = el('div', 'fs-list'); body.appendChild(wrap);
  const build = () => {
    const term = q.value.trim().toLowerCase(); wrap.replaceChildren();
    FORMULAS.forEach(([g, items], gi) => {
      const hit = items.filter(([l, t]) => !term || l.toLowerCase().includes(term) || T(g).toLowerCase().includes(term));
      if (!hit.length) return;
      const d = el('details', 'fs-g'); if (term || gi === 0) d.open = true;
      d.appendChild(el('summary', null, T(g) + ' · ' + hit.length));
      const box = el('div', 'fs-items'); d.appendChild(box);
      let done = false;
      const fill = () => { if (done) return; done = true; hit.forEach(([l, t]) => { const r = el('div', 'fs-item'); r.appendChild(el('div', 'fs-l', l)); const m = el('div', 'fs-t'); r.appendChild(m); render(m, t, false); box.appendChild(r); }); };
      if (d.open) fill(); d.addEventListener('toggle', () => { if (d.open) fill(); });
      wrap.appendChild(d);
    });
    if (!wrap.children.length) wrap.appendChild(el('p', 'ex-note', T('fs_none')));
  };
  q.addEventListener('input', build); build();
}

/* Einheitskreis: Punkt ziehen, sin/cos/tan ablesen, exakte Werte bei besonderen Winkeln */
const UC_EXACT = { 0: ['0', '1', '0'], 15: ['\\frac{\\sqrt6-\\sqrt2}{4}', '\\frac{\\sqrt6+\\sqrt2}{4}', '2-\\sqrt3'], 30: ['\\frac{1}{2}', '\\frac{\\sqrt3}{2}', '\\frac{\\sqrt3}{3}'], 45: ['\\frac{\\sqrt2}{2}', '\\frac{\\sqrt2}{2}', '1'],
  60: ['\\frac{\\sqrt3}{2}', '\\frac{1}{2}', '\\sqrt3'], 75: ['\\frac{\\sqrt6+\\sqrt2}{4}', '\\frac{\\sqrt6-\\sqrt2}{4}', '2+\\sqrt3'], 90: ['1', '0', null] };
function ucExact(deg) {
  if (Math.abs(deg - Math.round(deg)) > 1e-9) return null;
  const d = ((Math.round(deg) % 360) + 360) % 360; if (d % 15) return null;
  const phi = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  const [S0, C0, T0] = UC_EXACT[phi], r = d * Math.PI / 180;
  const sg = (v, x) => v === '0' || v === null ? v : x < -1e-12 ? (/[+-]/.test(v) ? '-\\left(' + v + '\\right)' : '-' + v) : v;
  return { s: sg(S0, Math.sin(r)), c: sg(C0, Math.cos(r)), t: sg(T0, Math.tan(r)) };
}
function radTex(deg) { const f = math.fraction(Math.round(deg), 180); if (f.n === 0) return '0'; return (f.n === 1 ? '' : f.n) + '\\pi' + (f.d === 1 ? '' : '/' + f.d); }
function unitCircleView(body) {
  const st = { a: 30, snap: true, tan: false };
  try { const s0 = JSON.parse(localStorage.getItem('pr.uc') || 'null'); if (s0) Object.assign(st, s0); } catch (e) { }
  const save = () => { try { localStorage.setItem('pr.uc', JSON.stringify(st)); } catch (e) { } };
  body.appendChild(el('p', 'ex-note', T('uc_hint')));
  const cv = el('canvas', 'uc-cv'); cv.id = 'ucCanvas'; body.appendChild(cv);
  const wave = el('canvas', 'uc-wave'); body.appendChild(wave);
  const ctl = el('div', 'uc-ctl');
  const rng = el('input'); rng.type = 'range'; rng.id = 'ucRange'; rng.min = '0'; rng.max = '360'; rng.step = '1'; rng.value = st.a;
  const tg = (lab, key) => { const b = el('button', 'btn sm', lab); b.type = 'button'; b.setAttribute('aria-pressed', st[key]); b.onclick = () => { st[key] = !st[key]; b.setAttribute('aria-pressed', st[key]); save(); upd(); }; return b; };
  ctl.appendChild(rng); ctl.appendChild(tg(T('uc_snap'), 'snap')); ctl.appendChild(tg('tan', 'tan'));
  body.appendChild(ctl);
  const quick = el('div', 'uc-quick');
  [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330].forEach(d => { const b = el('button', null, d + '°'); b.type = 'button'; b.onclick = () => { st.a = d; upd(); }; quick.appendChild(b); });
  body.appendChild(quick);
  const read = el('div', 'uc-read'); body.appendChild(read);
  const expl = el('div', 'uc-expl'); body.appendChild(expl);
  render(expl, '\\begin{aligned}&P=(\\cos\\alpha\\,|\\,\\sin\\alpha),\\quad r=1\\\\&\\sin^2\\alpha+\\cos^2\\alpha=1\\\\&\\tan\\alpha=\\frac{\\sin\\alpha}{\\cos\\alpha}\\end{aligned}', true);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  function draw() {
    const W = Math.min(cv.parentElement.clientWidth || 340, 420), H = W, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = W * 0.36, a = st.a * Math.PI / 180, px = cx + R * Math.cos(a), py = cy - R * Math.sin(a);
    const ink = css('--ink'), mut = css('--muted'), line = css('--line'), cS = '#e0703a', cC = '#2f7de1', cT = '#2aa36b', acc = css('--accent');
    c.strokeStyle = line; c.lineWidth = 1; c.beginPath(); c.moveTo(8, cy); c.lineTo(W - 8, cy); c.moveTo(cx, 8); c.lineTo(cx, H - 8); c.stroke();
    c.fillStyle = mut; c.font = '12px system-ui'; c.textAlign = 'center';
    [[1, 0, '1'], [-1, 0, '−1'], [0, 1, '1'], [0, -1, '−1']].forEach(([x, y, t]) => c.fillText(t, cx + x * R + (x ? (x > 0 ? 10 : -12) : 10), cy - y * R + (y ? (y > 0 ? -6 : 16) : 15)));
    c.strokeStyle = mut; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    // Winkelbogen
    c.strokeStyle = acc; c.fillStyle = acc + '22'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R * 0.22, 0, -a, true); c.closePath(); c.fill(); c.beginPath(); c.arc(cx, cy, R * 0.22, 0, -a, true); c.stroke();
    // tan auf der Tangente x = 1
    if (st.tan && Math.abs(Math.cos(a)) > 1e-6) { const tv = Math.tan(a), ty = cy - R * Math.max(-3, Math.min(3, tv)); c.strokeStyle = cT; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + R, cy); c.lineTo(cx + R, ty); c.stroke(); c.setLineDash([4, 4]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R, ty); c.stroke(); c.setLineDash([]); c.strokeStyle = line; c.beginPath(); c.moveTo(cx + R, 8); c.lineTo(cx + R, H - 8); c.stroke(); }
    // Radius, cos, sin
    c.strokeStyle = ink; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(px, py); c.stroke();
    c.strokeStyle = cC; c.lineWidth = 4; c.beginPath(); c.moveTo(cx, cy); c.lineTo(px, cy); c.stroke();
    c.strokeStyle = cS; c.beginPath(); c.moveTo(px, cy); c.lineTo(px, py); c.stroke();
    c.fillStyle = cC; c.font = '600 13px system-ui'; c.fillText('cos α', (cx + px) / 2, cy + (Math.sin(a) >= 0 ? 18 : -8));
    c.fillStyle = cS; c.textAlign = Math.cos(a) >= 0 ? 'left' : 'right'; c.fillText('sin α', px + (Math.cos(a) >= 0 ? 8 : -8), (cy + py) / 2 + 4);
    c.fillStyle = acc; c.beginPath(); c.arc(px, py, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = css('--bg'); c.beginPath(); c.arc(px, py, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = ink; c.textAlign = 'left'; c.font = 'italic 14px "STIX Two Text", serif'; c.fillText('α', cx + R * 0.27 * Math.cos(a / 2), cy - R * 0.27 * Math.sin(a / 2) + 5);
    c.fillText('P', px + 10 * Math.cos(a) + 4, py - 12 * Math.sin(a));
    // Sinus-/Kosinuskurve
    const WW = W, HH = 110; wave.width = WW * dpr; wave.height = HH * dpr; wave.style.width = WW + 'px'; wave.style.height = HH + 'px';
    const g = wave.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, WW, HH);
    const X = d => 10 + (WW - 20) * d / 360, Y = v => HH / 2 - v * (HH / 2 - 12);
    g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(10, HH / 2); g.lineTo(WW - 10, HH / 2); [90, 180, 270, 360].forEach(d => { g.moveTo(X(d), HH / 2 - 4); g.lineTo(X(d), HH / 2 + 4); }); g.stroke();
    g.fillStyle = mut; g.font = '11px system-ui'; g.textAlign = 'center'; [['90°', 90], ['180°', 180], ['270°', 270], ['360°', 360]].forEach(([t, d]) => g.fillText(t, X(d) - (d === 360 ? 10 : 0), HH - 2));
    [[Math.sin, cS], [Math.cos, cC]].forEach(([fn, col]) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); for (let d = 0; d <= 360; d += 2) { const x = X(d), y = Y(fn(d * Math.PI / 180)); d ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
    g.strokeStyle = acc; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(st.a), 4); g.lineTo(X(st.a), HH - 14); g.stroke(); g.setLineDash([]);
    [[Math.sin(a), cS], [Math.cos(a), cC]].forEach(([v, col]) => { g.fillStyle = col; g.beginPath(); g.arc(X(st.a), Y(v), 4.5, 0, Math.PI * 2); g.fill(); });
  }
  function upd() {
    if (st.snap) { const sn = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360].find(d => Math.abs(d - st.a) <= 4); if (sn !== undefined) st.a = sn % 360 === 0 && st.a > 300 ? 360 : sn; }
    st.a = Math.max(0, Math.min(360, st.a)); rng.value = st.a; save(); draw();
    const a = st.a * Math.PI / 180, ex = ucExact(st.a % 360);
    const num = v => String(Number(v.toFixed(6))).replace('.', S.dec === ',' ? '{,}' : '.');
    const sv = ex ? ex.s : '\\approx ' + num(Math.sin(a)), cvT = ex ? ex.c : '\\approx ' + num(Math.cos(a));
    const tv = Math.abs(Math.cos(a)) < 1e-9 ? '\\text{' + T('undef') + '}' : ex && ex.t !== null ? ex.t : '\\approx ' + num(Math.tan(a));
    const q = st.a % 360 === 0 || st.a % 90 === 0 ? '' : '\\quad\\text{' + T('uc_quad') + ' ' + ['I', 'II', 'III', 'IV'][Math.floor((st.a % 360) / 90)] + '}';
    read.replaceChildren();
    const eqs = v => (/^\\approx/.test(v) ? '' : '=') + v;
    const rows = [[`\\alpha=${Math.round(st.a)}^\\circ=${Number.isInteger(st.a) ? radTex(st.a) : num(a)}${q}`, ''], [`\\sin\\alpha${eqs(sv)}`, '#e0703a'], [`\\cos\\alpha${eqs(cvT)}`, '#2f7de1'], [`\\tan\\alpha${eqs(tv)}`, '#2aa36b']];
    rows.forEach(([t, col]) => { const d = el('div', 'uc-row'); if (col) { d.style.borderLeft = '3px solid ' + col; d.style.paddingLeft = '8px'; } read.appendChild(d); render(d, t, false); });
  }
  const pick = e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = r.height / 2 - (e.clientY - r.top); let d = Math.atan2(y, x) * 180 / Math.PI; if (d < 0) d += 360; st.a = Math.round(d); upd(); };
  let drag = false;
  cv.addEventListener('pointerdown', e => { drag = true; cv.setPointerCapture(e.pointerId); pick(e); e.preventDefault(); });
  cv.addEventListener('pointermove', e => { if (drag) pick(e); });
  cv.addEventListener('pointerup', () => { drag = false; });
  rng.addEventListener('input', () => { st.a = +rng.value; const s0 = st.snap; st.snap = false; upd(); st.snap = s0; });
  requestAnimationFrame(upd);
}

/* ---------- Kurven im 2D-Graphen (Parameter-/Polarkurven) ---------- */
function curveSamples(cu, N = 900) {
  const out = []; for (let i = 0; i <= N; i++) { const t = cu.t0 + (cu.t1 - cu.t0) * i / N; out.push([cu.fx(t), cu.fy(t)]); } return out;
}
function drawCurves(c, X, Y, W, H) {
  (G.curves || []).forEach((cu, i) => {
    c.strokeStyle = cssVar(COLORS[(G.fns.length + i) % 4]); c.lineWidth = 2.4; c.beginPath();
    let pen = false, last = null;
    for (const [x, y] of curveSamples(cu)) {
      if (!isFinite(x) || !isFinite(y)) { pen = false; continue; }
      const px = X(x), py = Y(y);
      if (pen && last && Math.hypot(px - last[0], py - last[1]) > Math.max(W, H)) pen = false;
      pen ? c.lineTo(px, py) : c.moveTo(px, py); pen = true; last = [px, py];
    }
    c.stroke();
    // Startpunkt und Richtung
    const s0 = curveSamples(cu, 60);
    if (isFinite(s0[0][0]) && isFinite(s0[0][1])) { c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(X(s0[0][0]), Y(s0[0][1]), 4, 0, Math.PI * 2); c.fill(); }
  });
}
function curveBounds() {
  const xs = [], ys = [];
  (G.curves || []).forEach(cu => curveSamples(cu, 400).forEach(([x, y]) => { if (isFinite(x) && isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6) { xs.push(x); ys.push(y); } }));
  if (!xs.length) return null;
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

/* ---------- Wertetabelle ---------- */
const TB = { x0: -3, step: 1 };
function syncTable() {
  const box = $('#gTable'); if (!box || box.hidden) return;
  const body = $('#tbBody'); body.replaceChildren();
  const fns = G.fns, n = 12;
  const head = el('div', 'tb-row tb-h'); head.style.gridTemplateColumns = `repeat(${fns.length + 1}, minmax(0, 1fr))`;
  head.appendChild(el('span', null, 'x')); fns.forEach(f => { const s = el('span', null, f.name + '(x)'); s.style.color = cssVar(f.color); head.appendChild(s); });
  body.appendChild(head);
  for (let i = 0; i < n; i++) {
    const x = Number((TB.x0 + i * TB.step).toPrecision(12)), r = el('div', 'tb-row'); r.style.gridTemplateColumns = head.style.gridTemplateColumns;
    r.appendChild(el('span', 'tb-x', gfmt(x)));
    fns.forEach(f => { const y = f.f(x); r.appendChild(el('span', null, isFinite(y) ? gfmt(Number(y.toPrecision(8))) : '—')); });
    body.appendChild(r);
  }
  $('#tbStep').textContent = String(TB.step).replace('.', S.dec);
  $('#tbStart').textContent = gfmt(TB.x0);
}
function wireTable() {
  const STEPS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
  $('#gTableBtn').onclick = () => { const b = $('#gTable'); b.hidden = !b.hidden; $('#gTableBtn').setAttribute('aria-pressed', !b.hidden); if (!b.hidden) { const v = G.view; if (v) { TB.x0 = Math.round(((v.x0 + v.x1) / 2 - 5 * TB.step) / TB.step) * TB.step; } syncTable(); } };
  $('#tbPrev').onclick = () => { TB.x0 -= TB.step * 6; syncTable(); };
  $('#tbNext').onclick = () => { TB.x0 += TB.step * 6; syncTable(); };
  $('#tbSm').onclick = () => { const i = STEPS.indexOf(TB.step); TB.step = STEPS[Math.max(0, (i < 0 ? 5 : i) - 1)]; syncTable(); };
  $('#tbSp').onclick = () => { const i = STEPS.indexOf(TB.step); TB.step = STEPS[Math.min(STEPS.length - 1, (i < 0 ? 5 : i) + 1)]; syncTable(); };
}

/* ---------- 3D-Flächen z = f(x, y) ---------- */
const SF = { fM: null, f: null, R: 5, yaw: -0.75, pitch: 0.95, zoom: 1, N: 38, opt: { axes: true, grid: true, mesh: true, ext: false }, crit: null };
try { const o = JSON.parse(localStorage.getItem('pr.s3') || 'null'); if (o) Object.assign(SF.opt, o); } catch (e) { }
function openSurf(fM, R = 5) {
  SF.fM = fM; SF.R = R; SF.zoom = 1;
  const c = math.compile(fM);
  SF.f = (x, y) => { try { const r = c.evaluate({ x, y }); const v = typeof r === 'number' ? r : (r && r.re !== undefined && Math.abs(r.im) < 1e-12 ? r.re : NaN); return v; } catch (e) { return NaN; } };
  $('#surfcard').hidden = false;
  $('#sfTitle').textContent = T('s3_title'); $('#sfHint').textContent = T('s3_hint');
  const seg0 = $('#sfRange'); seg0.replaceChildren(); [2, 5, 10].forEach(r => { const b = el('button', null, '±' + r); b.type = 'button'; b.setAttribute('aria-pressed', r === SF.R); b.onclick = () => { SF.R = r; seg0.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); drawSurf(); }; seg0.appendChild(b); });
  render($('#sfFormula'), 'z=' + K.texOf(K.mjToUser(fM)), false);
  const ob = $('#sfOpts'); ob.replaceChildren();
  SF.crit = null;
  [['axes', T('s3_axes')], ['grid', T('s3_grid')], ['mesh', T('s3_mesh')], ['ext', T('s3_ext')]].forEach(([k, l]) => { const b = el('button', 'chip', l); b.type = 'button'; b.setAttribute('aria-pressed', SF.opt[k]); b.onclick = () => { SF.opt[k] = !SF.opt[k]; b.setAttribute('aria-pressed', SF.opt[k]); try { localStorage.setItem('pr.s3', JSON.stringify(SF.opt)); } catch (e) { } drawSurf(); }; ob.appendChild(b); });
  drawSurf();
  $('#surfcard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function drawSurf() {
  const cv = $('#surf'); if (!cv || !SF.f) return;
  const W = cv.clientWidth || 360, H = Math.round(W * 0.9), dpr = window.devicePixelRatio || 1;
  cv.style.height = H + 'px'; cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const N = SF.N, R = SF.R, Z = [];
  for (let i = 0; i <= N; i++) { Z.push([]); for (let j = 0; j <= N; j++) Z[i].push(SF.f(-R + 2 * R * i / N, -R + 2 * R * j / N)); }
  const flat = Z.flat().filter(isFinite).sort((a, b) => a - b);
  if (!flat.length) { c.fillStyle = cssVar('--muted'); c.fillText(T('s3_none'), 20, 30); return; }
  let zl = flat[Math.floor(flat.length * 0.02)], zh = flat[Math.ceil(flat.length * 0.98) - 1]; if (zh - zl < 1e-9) { zl -= 1; zh += 1; }
  const zc = v => Math.max(-1, Math.min(1, ((v - zl) / (zh - zl)) * 2 - 1));
  const cy = Math.cos(SF.yaw), sy = Math.sin(SF.yaw), cp = Math.cos(SF.pitch), sp = Math.sin(SF.pitch), sc = Math.min(W, H) * 0.31 * SF.zoom;
  const proj = (x, y, z) => { // x,y,z ∈ [−1,1]
    const xr = x * cy - y * sy, yr = x * sy + y * cy;
    const y2 = yr * cp - z * sp, z2 = yr * sp + z * cp, d = 4.2 / (4.2 - y2 * 0.6);
    return [W / 2 + xr * sc * d, H / 2 - z2 * sc * d, y2];
  };
  const ink = cssVar('--ink'), mut = cssVar('--muted'), line = cssVar('--line'), O = SF.opt;
  const ticks = (lo, hi, n = 5) => { const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map(k => k * p).find(k => k >= raw) || raw; const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(Number(v.toPrecision(10))); return out; };
  const xt = ticks(-R, R), zt = ticks(zl, zh, 4), xs1 = v => v / R, zs1 = zc;
  // hintere Wände: jeweils die vom Betrachter abgewandte Seite
  const far = (a, b) => (proj(...a)[2] < proj(...b)[2] ? a : b);
  const xw = far([-1, 0, 0], [1, 0, 0])[0], yw = far([0, -1, 0], [0, 1, 0])[1];
  const seg = (A, B, col, w) => { const p = proj(...A), q = proj(...B); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };
  if (O.grid) {
    c.globalAlpha = 0.4;
    xt.forEach(v => { const u = xs1(v); seg([u, -1, -1], [u, 1, -1], mut, 1); seg([u, yw, -1], [u, yw, 1], mut, 1); });
    xt.forEach(v => { const u = xs1(v); seg([-1, u, -1], [1, u, -1], mut, 1); seg([xw, u, -1], [xw, u, 1], mut, 1); });
    zt.forEach(v => { const u = zs1(v); seg([-1, yw, u], [1, yw, u], mut, 1); seg([xw, -1, u], [xw, 1, u], mut, 1); });
    c.globalAlpha = 1;
  }
  if (O.axes) {
    // Rahmen der Wände
    [[[-1, -1, -1], [1, -1, -1]], [[1, -1, -1], [1, 1, -1]], [[1, 1, -1], [-1, 1, -1]], [[-1, 1, -1], [-1, -1, -1]], [[xw, yw, -1], [xw, yw, 1]], [[-xw, yw, -1], [-xw, yw, 1]], [[xw, -yw, -1], [xw, -yw, 1]], [[-xw, yw, 1], [xw, yw, 1]], [[xw, -yw, 1], [xw, yw, 1]]].forEach(([A, B]) => seg(A, B, mut, 1));
    // Achsen durch den Ursprung (falls im Bereich)
    const z0 = zl < 0 && zh > 0 ? zs1(0) : -1;
    seg([-1, 0, z0], [1, 0, z0], ink, 1.4); seg([0, -1, z0], [0, 1, z0], ink, 1.4);
    if (zl < 0 && zh > 0 || true) seg([0, 0, -1], [0, 0, 1], ink, 1.4);
  }
  const quads = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const zs = [Z[i][j], Z[i + 1][j], Z[i + 1][j + 1], Z[i][j + 1]]; if (!zs.every(isFinite)) continue;
    const xs = [i, i + 1, i + 1, i].map(k => -1 + 2 * k / N), ys = [j, j, j + 1, j + 1].map(k => -1 + 2 * k / N), zz = zs.map(zc);
    const P = xs.map((x, k) => proj(x, ys[k], zz[k]));
    const depth = P.reduce((s, p) => s + p[2], 0) / 4;
    const nx = (zz[1] - zz[0] + zz[2] - zz[3]) / 2, ny = (zz[3] - zz[0] + zz[2] - zz[1]) / 2, lum = 0.62 + 0.38 * Math.max(-1, Math.min(1, (-nx * 0.5 - ny * 0.4 + 0.3) * N / 6));
    quads.push({ P, depth, h: (zz[0] + zz[1] + zz[2] + zz[3]) / 4, lum });
  }
  quads.sort((a, b) => b.depth - a.depth);
  for (const q of quads) {
    const t = (q.h + 1) / 2, hue = 230 - 190 * t; // blau → gelb
    const fc = `hsl(${hue}, 70%, ${Math.round(28 + 34 * q.lum)}%)`; c.fillStyle = fc; c.strokeStyle = SF.opt.mesh ? 'rgba(0,0,0,.22)' : fc; c.lineWidth = SF.opt.mesh ? 0.5 : 0.8;
    c.beginPath(); q.P.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.stroke();
  }
  // Extrempunkte
  const lst = $('#sfExt'); if (lst) lst.replaceChildren();
  if (SF.opt.ext) {
    if (!SF.crit || SF.crit.R !== R || SF.crit.fM !== SF.fM) SF.crit = { R, fM: SF.fM, pts: K.crit2(SF.fM, R) };
    const colK = { max: '#e0453a', min: '#2f7de1', saddle: '#e0a21a', flat: mut }, labK = { max: 'H', min: 'T', saddle: 'S', flat: '?' };
    SF.crit.pts.forEach(p => {
      const z = isFinite(p.z) ? zc(p.z) : 0, q = proj(p.x / R, p.y / R, z);
      c.fillStyle = colK[p.kind]; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(q[0], q[1], 6, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = ink; c.font = '600 12px system-ui'; c.textAlign = 'left'; c.fillText(labK[p.kind], q[0] + 8, q[1] - 6);
      if (lst) { const ch = el('span', 'sf-pt'); ch.style.setProperty('--pc', colK[p.kind]); lst.appendChild(ch); render(ch, `${labK[p.kind]}(${gfmt(p.x)}\\,|\\,${gfmt(p.y)}\\,|\\,${gfmt(Number(p.z.toPrecision(6)))})`, false); }
    });
    if (lst && !SF.crit.pts.length) lst.appendChild(el('span', 'sf-hint', T('e2_none')));
  }
  // Beschriftung (Achsennamen und Skalenwerte)
  if (SF.opt.axes) {
    c.fillStyle = ink; c.font = 'italic 600 14px "STIX Two Text", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const L = (pt, t) => { const p = proj(...pt); c.fillText(t, p[0], p[1]); };
    L([1.22, 0, -1], 'x'); L([0, 1.22, -1], 'y'); L([0, 0, 1.18], 'z');
    c.fillStyle = mut; c.font = '11px system-ui';
    xt.forEach(v => { if (Math.abs(v) < 1e-12) return; L([xs1(v), -yw * 1.13, -1], gfmt(v)); L([-xw * 1.13, xs1(v), -1], gfmt(v)); });
    zt.forEach(v => L([xw * 1.12, -yw * 1.12, zs1(v)], gfmt(v)));
  }
  c.textBaseline = 'alphabetic';
}
function wireSurf() {
  const cv = $('#surf'); const pts = new Map(); let base = null;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); base = null; e.preventDefault(); });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { SF.yaw += (e.clientX - prev[0]) * 0.01; SF.pitch = Math.max(0.1, Math.min(1.5, SF.pitch + (e.clientY - prev[1]) * 0.01)); drawSurf(); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (base) SF.zoom = Math.max(0.4, Math.min(3, SF.zoom * d / base)); base = d; drawSurf(); }
  });
  const end = e => { pts.delete(e.pointerId); base = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => { e.preventDefault(); SF.zoom = Math.max(0.4, Math.min(3, SF.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); drawSurf(); }, { passive: false });
  $('#sfClose').onclick = () => { $('#surfcard').hidden = true; };
  $('#sfReset').onclick = () => { SF.yaw = -0.75; SF.pitch = 0.95; SF.zoom = 1; drawSurf(); };
  window.addEventListener('resize', () => { if (!$('#surfcard').hidden) drawSurf(); });
}
