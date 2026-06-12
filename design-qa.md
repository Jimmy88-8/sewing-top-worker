# IBKR Desktop Design QA

- Visual references: `/Users/jeremmy/Desktop/Screenshot 2026-06-11 at 20.02.48.png` through `20.17.22.png`
- Final Portfolio capture: `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-ibkr-portfolio-final.png`
- Side-by-side comparison: `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/ibkr-portfolio-comparison-v2.png`
- Browser viewport: 1470 x 956

**Verified**

- Login uses the reference dark 50/50 composition, official wordmark, paper/live tabs, credentials, generated wave artwork, and expandable black settings panel.
- Connection state includes the centered wordmark, username, progress indicator, connection status, and build metadata.
- Authenticated workspace switches to the compact light theme with gray header, yellow simulated-trading strip, white navigation rail, square panels, thin borders, and bottom status bar.
- Portfolio, Watchlist, Quote, Screeners, Layouts, News, and Sitemap render at the target proportions without horizontal overflow.
- Quote selection, page navigation, chart rendering, login transition, More/Fewer Options, order dialogs, settings, and logout are interactive.
- Generated article and world-exchange imagery loads correctly.
- Browser console error check: no errors.
- `node --check public/js/apps/ibkr.js`: passed.
- `git diff --check`: passed.

**Comparison Notes**

- The final Portfolio empty quote rail now follows the supplied reference, including Ask/Bid placeholders, lightning action, and bottom chart.
- SewingOS window chrome and Dock remain intentional host-product elements surrounding the recreated IBKR application.
- Market values are realistic simulation data; no brokerage authentication or order transmission occurs.

final result: passed

---

# Calculator Design QA

- Source visual truth:
  - `/Users/jeremmy/Desktop/Screenshot 2026-06-12 at 18.12.43.png`
  - `/Users/jeremmy/Desktop/Screenshot 2026-06-12 at 18.13.01.png`
  - `/Users/jeremmy/Desktop/Screenshot 2026-06-12 at 18.13.10.png`
  - `/Users/jeremmy/Desktop/Screenshot 2026-06-12 at 18.13.45.png`
- Implementation screenshots:
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calculator-basic.png`
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calculator-scientific.png`
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calculator-programmer.png`
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calculator-history.png`
- Viewport: 1280 x 720 browser; mode windows are centered and constrained above the Dock.
- States: Basic cleared; Scientific cleared with `2nd` functions; Programmer hexadecimal with binary visible; Basic with history visible.
- Full-view comparison evidence:
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calculator-comparison.png`
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calculator-scientific-comparison.png`
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calculator-programmer-comparison.png`
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calculator-history-comparison.png`
- Focused comparison evidence: not needed because every button label, display, bit row, and history entry remains readable in the normalized full-window comparisons.

**Findings**

- No actionable P0, P1, or P2 mismatches remain.
- Typography uses the existing system font stack, light display weight, and tabular numerals. Long values step down to compact sizes instead of clipping.
- Spacing follows the reference's four-column, five-row rhythm with circular controls, a taller display region, and a distinct orange operator column.
- Scientific mode follows the reference ten-column function grid. Programmer mode follows its seven-column logic grid with base controls and a clickable 64-bit display.
- Colors reuse SewingOS tokens while matching the reference's dark canvas, gray number keys, lighter function keys, and orange operators.
- The calculator has no photographic or decorative image assets. The existing SewingOS window chrome remains the intentional host-product frame.
- Copy is limited to calculator values, expressions, mode labels, history metadata, accessible control labels, and clear domain/integer error messages.

**Patches Made**

- Replaced the inline arithmetic variables with a dedicated calculator state engine.
- Added repeated equals, operator replacement, chained operations, contextual percentages, decimal precision cleanup, sign changes, backspace, and error recovery.
- Added selected-operator styling, long-number scaling, keyboard parity, focus states, and ARIA labels.
- Added a standard-precedence scientific expression engine with parentheses, powers, roots, logs, trigonometry, hyperbolic functions, degree/radian switching, memory, factorial, constants, and `2nd` functions.
- Added a fixed-width 64-bit `BigInt` programmer engine with bases 8/10/16, integer truncation, bitwise operators, shifts, rotates, byte flips, grouping, ASCII/Unicode display, and clickable bits.
- Added persistent history with reload and clear actions, plus Command-1/2/3 mode shortcuts.
- Added 18 unit tests and verified mouse, keyboard, history reload, and the browser console.

**Follow-up Polish**

- Programmer controls are slightly denser vertically than the tall source screenshot so every control remains above the Dock at a 1280 x 720 viewport.

final result: passed

---

# Weather and Calendar Design QA

- Source visual truth:
  - `/Users/jeremmy/Desktop/Screenshot 2026-06-12 at 15.24.59.png`
  - `/Users/jeremmy/Desktop/Screenshot 2026-06-12 at 15.26.08.png`
- Implementation screenshots:
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-weather-main.png`
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calendar-month.png`
- Viewport: implementation captured at 1280 x 720; source and implementation normalized to 1280 x 720 for comparison.
- States: Weather main forecast with locations visible; Calendar June 2026 month view.
- Full-view comparison evidence:
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-weather-comparison.png`
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calendar-comparison.png`
- Focused comparison evidence:
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-weather-focus.png`
  - `/Users/jeremmy/Documents/Jeremy_Developing/sewing-top-worker/artifacts/qa-calendar-focus.png`

**Findings**

- No actionable P0, P1, or P2 mismatches remain.
- Typography follows the system SF stack with Apple-like optical hierarchy and tabular numerals.
- Spacing, sidebar proportions, segmented controls, card radii, grid rhythm, and calendar density match the supplied references within the SewingOS window system.
- Weather colors and glass tokens track the reference blue palette; Calendar uses the reference light canvas, subtle separators, and semantic event colors.
- Generated cloud and precipitation imagery is sharp at the rendered sizes. Interface icons use the official Iconoir asset set rather than text or CSS stand-ins.
- Copy is intentionally privacy-safe: location labels are generalized and sample events contain no account, school, course, or precise location information.

**Patches Made**

- Corrected inherited row/column layout conflicts in both applications.
- Added responsive and container-aware sidebar behavior.
- Removed horizontal dashboard overflow and hid the hourly strip scrollbar.
- Added complete hourly and 10-day weather fields to the Open-Meteo proxy.
- Verified day, week, month, and year navigation plus local event creation.

**Follow-up Polish**

- The SewingOS Dock overlaps the lowest rows at the 1280 x 720 QA viewport. This is existing host-window behavior and does not block scrolling or use.
- The reference Calendar is denser because it contains real personal schedules; the implementation deliberately uses fewer, generic events.

final result: passed
