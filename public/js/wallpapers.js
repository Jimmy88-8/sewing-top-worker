/**
 * Appearance: macOS-style wallpapers + Liquid Glass tint control.
 *
 * Wallpapers are CSS gradients / inline SVG (no assets, no copyright baggage).
 * If a real photo exists at /wallpapers/sequoia.jpg it is auto-detected and
 * offered as "Sequoia (Photo)".
 *
 * Liquid Glass (macOS 26/27 design language): a single --glass custom property
 * (0 = ultra-clear … 1 = fully tinted) drives the opacity of every glass
 * surface, mirroring the system-wide slider Apple added in macOS 27.
 */

function svgURI(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Sequoia grove at golden hour: redwood trunks, sunlit bark, understory, mist.
const sequoiaGrove = svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8c8e0"/><stop offset="1" stop-color="#cfe3cf"/></linearGradient>
<linearGradient id="back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16301d"/><stop offset="1" stop-color="#0f2415"/></linearGradient>
<linearGradient id="t1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c97a45"/><stop offset=".4" stop-color="#8a4b2e"/><stop offset="1" stop-color="#4a2618"/></linearGradient>
<linearGradient id="t2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b96c3c"/><stop offset=".5" stop-color="#7a4026"/><stop offset="1" stop-color="#3f2014"/></linearGradient>
<linearGradient id="t3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a85f36"/><stop offset=".5" stop-color="#6b3820"/><stop offset="1" stop-color="#371c11"/></linearGradient>
<filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="soft2"><feGaussianBlur stdDeviation="6"/></filter>
</defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
<rect y="180" width="1600" height="820" fill="url(#back)"/>
<g opacity=".55" fill="#0a1c10">
<path d="M120 180 l26 820 h-52 Z"/><path d="M420 200 l22 800 h-44 Z"/><path d="M700 170 l20 830 h-40 Z"/><path d="M980 200 l24 800 h-48 Z"/><path d="M1300 180 l22 820 h-44 Z"/><path d="M1520 210 l20 790 h-40 Z"/>
</g>
<g opacity=".5" fill="#2c5a36">
<ellipse cx="250" cy="330" rx="190" ry="120" filter="url(#soft)"/><ellipse cx="700" cy="290" rx="220" ry="130" filter="url(#soft)"/><ellipse cx="1150" cy="330" rx="210" ry="120" filter="url(#soft)"/><ellipse cx="1480" cy="300" rx="170" ry="110" filter="url(#soft)"/>
</g>
<polygon points="300,0 760,0 360,1000 140,1000" fill="#fff8e0" opacity=".10"/>
<polygon points="900,0 1200,0 940,1000 760,1000" fill="#fff8e0" opacity=".07"/>
<g>
<path d="M60 0 L40 1000 L235 1000 L190 0 Z" fill="url(#t1)"/>
<path d="M105 80 l-12 840" stroke="#3a1d10" stroke-width="9" opacity=".35" fill="none"/>
<path d="M155 40 l-6 900" stroke="#3a1d10" stroke-width="6" opacity=".3" fill="none"/>
<path d="M380 0 L370 1000 L470 1000 L450 0 Z" fill="url(#t3)"/>
<path d="M620 0 L585 1000 L825 1000 L775 0 Z" fill="url(#t2)"/>
<path d="M680 60 l-18 900" stroke="#321a0e" stroke-width="11" opacity=".4" fill="none"/>
<path d="M745 30 l-10 940" stroke="#321a0e" stroke-width="7" opacity=".3" fill="none"/>
<path d="M1040 0 L990 1000 L1330 1000 L1255 0 Z" fill="url(#t1)"/>
<path d="M1120 50 l-26 920" stroke="#3a1d10" stroke-width="13" opacity=".4" fill="none"/>
<path d="M1205 20 l-14 950" stroke="#3a1d10" stroke-width="8" opacity=".3" fill="none"/>
<path d="M1480 0 L1455 1000 L1600 1000 L1600 0 Z" fill="url(#t2)"/>
</g>
<ellipse cx="800" cy="760" rx="780" ry="90" fill="#dfeef2" opacity=".22" filter="url(#soft)"/>
<g fill="#5d9c3f" opacity=".9">
<ellipse cx="140" cy="880" rx="150" ry="70" filter="url(#soft2)"/><ellipse cx="400" cy="930" rx="180" ry="80" filter="url(#soft2)"/><ellipse cx="540" cy="860" rx="120" ry="55" filter="url(#soft2)"/><ellipse cx="900" cy="940" rx="200" ry="75" filter="url(#soft2)"/><ellipse cx="1400" cy="930" rx="190" ry="80" filter="url(#soft2)"/>
</g>
<g fill="#79b656" opacity=".75">
<ellipse cx="260" cy="850" rx="90" ry="40" filter="url(#soft2)"/><ellipse cx="480" cy="890" rx="100" ry="42" filter="url(#soft2)"/><ellipse cx="980" cy="900" rx="110" ry="45" filter="url(#soft2)"/><ellipse cx="1300" cy="880" rx="90" ry="40" filter="url(#soft2)"/>
</g>
<ellipse cx="1430" cy="800" rx="160" ry="50" fill="#caa66a" opacity=".4" filter="url(#soft2)"/>
</svg>`);

// Big Sur style: layered mountain ridges under a warm dusk sky.
const bigSur = svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#2e1a47"/><stop offset=".45" stop-color="#b3477c"/><stop offset=".75" stop-color="#f29a5f"/><stop offset="1" stop-color="#f8c66d"/>
</linearGradient>
<linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a2a63"/><stop offset="1" stop-color="#7c3a70"/></linearGradient>
<linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1c4f"/><stop offset="1" stop-color="#56286a"/></linearGradient>
<linearGradient id="m3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241238"/><stop offset="1" stop-color="#341a4e"/></linearGradient>
</defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
<circle cx="1150" cy="330" r="110" fill="#ffdf9e" opacity=".9"/>
<path d="M0 620 Q200 480 420 580 T820 560 Q1050 500 1240 590 T1600 560 V1000 H0 Z" fill="url(#m1)" opacity=".85"/>
<path d="M0 720 Q260 580 520 690 T1000 670 Q1260 610 1600 700 V1000 H0 Z" fill="url(#m2)" opacity=".95"/>
<path d="M0 840 Q300 720 640 810 T1200 800 Q1430 760 1600 820 V1000 H0 Z" fill="url(#m3)"/>
</svg>`);

export const WALLPAPERS = [
  { id: "grove", name: "Sequoia Grove", css: sequoiaGrove },
  {
    id: "sequoia",
    name: "Sequoia",
    css: `radial-gradient(90% 110% at 78% 12%, #8fb3f7 0%, rgba(143,179,247,0) 55%),
          radial-gradient(80% 100% at 15% 85%, #e8a0d8 0%, rgba(232,160,216,0) 55%),
          radial-gradient(60% 80% at 50% 50%, #6d5bd0 0%, rgba(109,91,208,0) 70%),
          linear-gradient(165deg, #131c4d 0%, #3b2f7d 45%, #7a3f8f 100%)`,
  },
  {
    id: "sonoma",
    name: "Sonoma",
    css: `radial-gradient(100% 80% at 80% 0%, #9fd8c8 0%, rgba(159,216,200,0) 50%),
          radial-gradient(90% 90% at 10% 100%, #0e4d4a 0%, rgba(14,77,74,0) 60%),
          linear-gradient(170deg, #0b2b40 0%, #15555c 55%, #2f8a7d 100%)`,
  },
  {
    id: "ventura",
    name: "Ventura",
    css: `radial-gradient(100% 90% at 85% 10%, #ffb56b 0%, rgba(255,181,107,0) 55%),
          radial-gradient(90% 100% at 10% 90%, #c2266e 0%, rgba(194,38,110,0) 60%),
          linear-gradient(160deg, #5b0e3c 0%, #b62a55 50%, #f0703f 100%)`,
  },
  {
    id: "monterey",
    name: "Monterey",
    css: `radial-gradient(80% 90% at 75% 20%, #ff9ad5 0%, rgba(255,154,213,0) 55%),
          radial-gradient(90% 90% at 20% 80%, #3d6df2 0%, rgba(61,109,242,0) 60%),
          linear-gradient(150deg, #1a1060 0%, #5b2ea6 50%, #b44bd2 100%)`,
  },
  { id: "bigsur", name: "Big Sur", css: bigSur },
  {
    id: "graphite",
    name: "Graphite",
    css: `radial-gradient(110% 110% at 70% 15%, #4a4a55 0%, rgba(74,74,85,0) 60%),
          linear-gradient(165deg, #15151a 0%, #26262e 60%, #38383f 100%)`,
  },
];

const KEY = "sewingos.wallpaper";
const GLASS_KEY = "sewingos.glass";
const PHOTO_URL = "/wallpapers/sequoia.jpg";

export function applyWallpaper(id) {
  const wp = WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
  document.body.style.background = wp.css;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  localStorage.setItem(KEY, wp.id);
  return wp.id;
}

export function currentWallpaper() {
  return localStorage.getItem(KEY) ?? WALLPAPERS[0].id;
}

/* Liquid Glass tint: 0 = ultra-clear, 1 = fully tinted (macOS 27 slider). */

export function setGlass(v) {
  const x = Math.min(1, Math.max(0, v));
  document.documentElement.style.setProperty("--glass", String(x));
  localStorage.setItem(GLASS_KEY, String(x));
  return x;
}

export function currentGlass() {
  const v = parseFloat(localStorage.getItem(GLASS_KEY));
  return Number.isFinite(v) ? v : 0.55;
}

export function initWallpaper() {
  setGlass(currentGlass());
  const stored = localStorage.getItem(KEY); // capture before applyWallpaper persists a default
  applyWallpaper(stored ?? WALLPAPERS[0].id);
  // Auto-detect an optional real photo dropped at public/wallpapers/sequoia.jpg
  const probe = new Image();
  probe.onload = () => {
    WALLPAPERS.unshift({ id: "photo", name: "Sequoia (Photo)", css: `url("${PHOTO_URL}")` });
    if (!stored || stored === "photo") applyWallpaper("photo");
  };
  probe.src = PHOTO_URL;
}
