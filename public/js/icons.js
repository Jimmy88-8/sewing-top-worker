/**
 * SewingOS app icon set.
 *
 * Every icon is drawn on the same 64×64 grid inside a 14.5px-radius squircle,
 * glyphs use a consistent ~4px stroke weight and sit on per-app gradient
 * tiles, so all icons share one visual weight at any size.
 */

const tile = (id, g0, g1, inner) =>
  `<svg class="app-ic" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="ic-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${g0}"/><stop offset="1" stop-color="${g1}"/>
    </linearGradient></defs>
    <rect width="64" height="64" rx="14.5" fill="url(#ic-${id})"/>
    <rect width="64" height="64" rx="14.5" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>
    ${inner}
  </svg>`;

export const ICONS = {
  finder: tile("fnd", "#43c6f2", "#1d7fd6", `
    <path d="M32 8 V56" stroke="rgba(0,0,0,.28)" stroke-width="2.5"/>
    <path d="M22 26 v7 M42 26 v7" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <path d="M18 42 q14 9 28 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`),

  market: tile("mkt", "#2e2e36", "#141418", `
    <path d="M14 40 l10 -10 8 6 14 -16" fill="none" stroke="#ff9f0a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 50 h8 M30 50 h8 M44 50 h8" stroke="#30d158" stroke-width="4" stroke-linecap="round"/>`),

  notes: tile("nts", "#f7f7f2", "#e4e4da", `
    <rect width="64" height="17" rx="0" fill="#ffd60a"/>
    <path d="M0 14.5 a14.5 14.5 0 0 1 14.5 -14.5 h35 a14.5 14.5 0 0 1 14.5 14.5 v2.5 h-64 Z" fill="#ffd60a"/>
    <path d="M14 30 h36 M14 39 h36 M14 48 h24" stroke="#b9b9ad" stroke-width="3.5" stroke-linecap="round"/>`),

  calculator: tile("clc", "#3a3a42", "#1f1f26", `
    <rect x="14" y="12" width="36" height="10" rx="3" fill="rgba(255,255,255,.85)"/>
    <g fill="rgba(255,255,255,.8)">
      <circle cx="20" cy="34" r="4"/><circle cx="32" cy="34" r="4"/>
      <circle cx="20" cy="47" r="4"/><circle cx="32" cy="47" r="4"/>
    </g>
    <g fill="#ff9f0a"><circle cx="44" cy="34" r="4"/><circle cx="44" cy="47" r="4"/></g>`),

  calendar: (day) => tile("cal", "#fbfbfd", "#e9e9ee", `
    <path d="M0 14.5 a14.5 14.5 0 0 1 14.5 -14.5 h35 a14.5 14.5 0 0 1 14.5 14.5 v3.5 h-64 Z" fill="#ff453a"/>
    <text x="32" y="47" text-anchor="middle" font-family="-apple-system,Helvetica,Arial" font-size="26" font-weight="600" fill="#3a3a3f">${day}</text>`),

  weather: tile("wx", "#4aa3f5", "#1c63c9", `
    <circle cx="40" cy="26" r="9" fill="#ffd60a"/>
    <path d="M18 44 a8 8 0 0 1 1.5 -15.8 a11 11 0 0 1 21 -2.2 a7.5 7.5 0 0 1 3.5 14.4 a6 6 0 0 1 -2 3.6 Z"
      fill="#fff" opacity=".95"/>`),

  cli: tile("cli", "#3c3c44", "#1e1e25", `
    <path d="M16 22 l10 10 -10 10" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 44 h16" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>`),

  settings: tile("set", "#9a9aa2", "#5b5b63", `
    <g stroke="#fff" stroke-width="4" stroke-linecap="round">
      <path d="M32 14 v6 M32 44 v6 M14 32 h6 M44 32 h6 M19.3 19.3 l4.2 4.2 M40.5 40.5 l4.2 4.2 M44.7 19.3 l-4.2 4.2 M23.5 40.5 l-4.2 4.2"/>
    </g>
    <circle cx="32" cy="32" r="9.5" fill="none" stroke="#fff" stroke-width="4"/>
    <circle cx="32" cy="32" r="3" fill="#fff"/>`),

  about: tile("abt", "#8b66ff", "#4b34c4", `
    <path d="M32 14 q3 14 18 18 q-15 4 -18 18 q-3 -14 -18 -18 q15 -4 18 -18 Z" fill="#fff"/>`),

  trash: tile("trs", "#dcdce2", "#aeaeb6", `
    <path d="M20 22 h24 l-2.5 26 a4 4 0 0 1 -4 3.5 h-11 a4 4 0 0 1 -4 -3.5 Z" fill="none" stroke="#55555c" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M16 22 h32 M26 22 v-4 a3 3 0 0 1 3 -3 h6 a3 3 0 0 1 3 3 v4 M27 29 v15 M37 29 v15"
      fill="none" stroke="#55555c" stroke-width="3.5" stroke-linecap="round"/>`),
};

/* Small monochrome glyphs for in-app use (Finder docs, etc.) */
export const GLYPHS = {
  doc: `<svg class="glyph-ic" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M18 8 h20 l10 10 v38 a4 4 0 0 1 -4 4 h-26 a4 4 0 0 1 -4 -4 v-44 a4 4 0 0 1 4 -4 Z"
      fill="#eceaf0" opacity=".92"/>
    <path d="M38 8 v10 h10" fill="none" stroke="#b9b9c2" stroke-width="2.5"/>
    <path d="M24 30 h16 M24 38 h16 M24 46 h10" stroke="#9a9aa2" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
};
