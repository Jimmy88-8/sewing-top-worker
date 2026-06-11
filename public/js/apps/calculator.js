/**
 * Calculator — macOS-style four-function calculator with keyboard support.
 */
export function createCalculator() {
  const root = document.createElement("div");
  root.className = "calc";
  root.tabIndex = 0;

  const LAYOUT = [
    ["AC", "fn"], ["±", "fn"], ["%", "fn"], ["÷", "op"],
    ["7", "num"], ["8", "num"], ["9", "num"], ["×", "op"],
    ["4", "num"], ["5", "num"], ["6", "num"], ["−", "op"],
    ["1", "num"], ["2", "num"], ["3", "num"], ["+", "op"],
    ["0", "num zero"], [".", "num"], ["=", "op"],
  ];

  root.innerHTML = `
    <div class="calc-display">0</div>
    <div class="calc-grid">
      ${LAYOUT.map(([k, cls]) => `<button class="calc-btn ${cls}" data-k="${k}">${k}</button>`).join("")}
    </div>`;

  const display = root.querySelector(".calc-display");
  let acc = null, op = null, cur = "0", fresh = true;

  const show = () => {
    let s = cur;
    if (s.length > 12) s = Number(cur).toPrecision(8).replace(/\.?0+(e|$)/, "$1");
    display.textContent = s;
    display.style.fontSize = s.length > 9 ? "22px" : "34px";
  };

  const apply = () => {
    if (acc === null || op === null) return;
    const a = Number(acc), b = Number(cur);
    let r = 0;
    if (op === "+") r = a + b;
    else if (op === "−") r = a - b;
    else if (op === "×") r = a * b;
    else if (op === "÷") r = b === 0 ? NaN : a / b;
    cur = String(Number(r.toPrecision(12)));
    if (cur === "NaN") cur = "Error";
    acc = null; op = null;
  };

  function press(k) {
    if (cur === "Error" && k !== "AC") return;
    if (/^\d$/.test(k)) {
      cur = fresh || cur === "0" ? k : cur + k;
      fresh = false;
    } else if (k === ".") {
      if (fresh) { cur = "0."; fresh = false; }
      else if (!cur.includes(".")) cur += ".";
    } else if (k === "AC") {
      acc = null; op = null; cur = "0"; fresh = true;
    } else if (k === "±") {
      cur = cur.startsWith("-") ? cur.slice(1) : cur === "0" ? cur : "-" + cur;
    } else if (k === "%") {
      cur = String(Number(cur) / 100);
    } else if (k === "=") {
      apply(); fresh = true;
    } else { // operator
      if (op !== null && !fresh) apply();
      acc = cur; op = k; fresh = true;
    }
    show();
  }

  root.querySelectorAll(".calc-btn").forEach((b) =>
    b.addEventListener("click", () => { press(b.dataset.k); root.focus(); }),
  );

  root.addEventListener("keydown", (e) => {
    const map = { "/": "÷", "*": "×", "-": "−", "+": "+", Enter: "=", "=": "=", Escape: "AC", "%": "%", ".": "." };
    const k = /^\d$/.test(e.key) ? e.key : map[e.key];
    if (k) { e.preventDefault(); press(k); }
    if (e.key === "Backspace") {
      cur = cur.length > 1 ? cur.slice(0, -1) : "0";
      show();
    }
  });

  setTimeout(() => root.focus(), 50);
  return root;
}
