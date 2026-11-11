/* Logo-Modelle für „Prof Rechenzentrum“ – reine Formen, ohne Schrift (für App-Icon nutzbar) */
const LOGOS = {
  hut: {
    name: { de: 'Doktorhut-π', en: 'Mortarboard π' },
    svg: id => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a6fd1"/><stop offset="1" stop-color="#173f8f"/></linearGradient></defs>
  <rect width="100" height="100" rx="23" fill="url(#${id}g)"/>
  <path d="M31 33v9c0 4 9 7 19 7s19-3 19-7v-9" fill="#0f2a5e"/>
  <path d="M50 13 86 27 50 41 14 27Z" fill="#ffffff"/>
  <path d="M50 27 76 31v14" fill="none" stroke="#f5c242" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M73 44h6l1.5 8h-9Z" fill="#f5c242"/>
  <path d="M22 60h56" stroke="#fff" stroke-width="7.5" stroke-linecap="round"/>
  <path d="M39 61c0 9-1 17-6 25" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round"/>
  <path d="M61 61v18c0 5 3 7 8 6" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round"/>
</svg>`
  },
  karo: {
    name: { de: 'Karopapier', en: 'Grid paper' },
    svg: id => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><pattern id="${id}p" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0V10H0" fill="none" stroke="#c9d8f0" stroke-width="1"/></pattern>
  <clipPath id="${id}c"><rect width="100" height="100" rx="23"/></clipPath></defs>
  <g clip-path="url(#${id}c)"><rect width="100" height="100" fill="#fbfcff"/><rect width="100" height="100" fill="url(#${id}p)"/>
  <path d="M8 0v100" stroke="#e8a3a3" stroke-width="1.6"/></g>
  <path d="M20 79h62" stroke="#ffd640" stroke-width="11" stroke-linecap="round" opacity=".9"/>
  <path d="M17 55l9-5 11 25 15-50h32" fill="none" stroke="#1d5bb5" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M60 38l16 22M76 38 60 60" stroke="#16203a" stroke-width="6" stroke-linecap="round"/>
</svg>`
  },
  brille: {
    name: { de: 'Prof-Brille', en: 'Prof glasses' },
    layers: {
      bg: '<rect width="100" height="100" rx="23" fill="#16203a"/>',
      face: '<path d="M26 30c8-6 40-6 48 0" fill="none" stroke="#8fa6cf" stroke-width="5" stroke-linecap="round"/><path d="M38 80q12 6 24 0" fill="none" stroke="#8fa6cf" stroke-width="5" stroke-linecap="round"/>',
      glass: '<circle cx="31" cy="54" r="16" fill="#22325a" stroke="#f5c242" stroke-width="5"/><path d="M46 52q4-5 8 0M15 50 7 45M85 50l8-5" fill="none" stroke="#f5c242" stroke-width="5" stroke-linecap="round"/>',
      reye: '<circle cx="69" cy="54" r="16" fill="#22325a" stroke="#f5c242" stroke-width="5"/>',
      signs: '<path d="M31 47v14M24 54h14" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>',
      eq: '<path class="l-eq" d="M62 50h14M62 58h14" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>'
    },
    svg: id => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="23" fill="#16203a"/>
  <path class="lg-brow" d="M26 30c8-6 40-6 48 0" fill="none" stroke="#8fa6cf" stroke-width="5" stroke-linecap="round"/>
  <circle class="lg-lens" cx="31" cy="54" r="16" fill="#22325a" stroke="#f5c242" stroke-width="5"/>
  <circle class="lg-lens" cx="69" cy="54" r="16" fill="#22325a" stroke="#f5c242" stroke-width="5"/>
  <path d="M46 52q4-5 8 0M15 50 7 45M85 50l8-5" fill="none" stroke="#f5c242" stroke-width="5" stroke-linecap="round"/>
  <path class="lg-plus" d="M31 47v14M24 54h14" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
  <path class="lg-eq" d="M62 50h14M62 58h14" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M38 80q12 6 24 0" fill="none" stroke="#8fa6cf" stroke-width="5" stroke-linecap="round"/>
</svg>`
  },
  rechner: {
    name: { de: 'Rechner mit Hut', en: 'Calculator in a cap' },
    svg: id => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd85c"/><stop offset="1" stop-color="#f4a62a"/></linearGradient></defs>
  <rect width="100" height="100" rx="23" fill="url(#${id}g)"/>
  <rect x="27" y="34" width="46" height="56" rx="9" fill="#16203a"/>
  <rect x="33" y="41" width="34" height="13" rx="3" fill="#d6f0dd"/>
  <path d="M51 47.5h12" stroke="#16203a" stroke-width="3" stroke-linecap="round"/>
  <g fill="#8fa6cf"><circle cx="37" cy="63" r="3.4"/><circle cx="50" cy="63" r="3.4"/><circle cx="37" cy="74" r="3.4"/><circle cx="50" cy="74" r="3.4"/><circle cx="37" cy="84" r="3.2"/><circle cx="50" cy="84" r="3.2"/></g>
  <rect x="59.5" y="59.5" width="7" height="27" rx="3.5" fill="#e4572e"/>
  <path d="M50 10 80 21 50 32 20 21Z" fill="#16203a"/>
  <path d="M50 21 72 24v11" fill="none" stroke="#e4572e" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="72" cy="36" r="2.8" fill="#e4572e"/>
</svg>`
  }
};
const LOGO_ORDER = ['brille', 'rechner'];
