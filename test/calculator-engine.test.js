import test from "node:test";
import assert from "node:assert/strict";

import { CalculatorEngine, formatCalculatorValue } from "../public/js/apps/calculator-engine.js";

function enter(engine, keys) {
  for (const key of keys) engine.press(key);
  return engine.snapshot();
}

test("performs basic and chained arithmetic", () => {
  const engine = new CalculatorEngine();
  assert.equal(enter(engine, ["2", "+", "3", "="]).value, "5");

  engine.clearAll();
  assert.equal(enter(engine, ["2", "+", "3", "×", "4", "="]).value, "20");
});

test("replaces a pending operator instead of applying it", () => {
  const engine = new CalculatorEngine();
  assert.equal(enter(engine, ["8", "+", "×", "2", "="]).value, "16");
});

test("repeats the last operation when equals is pressed again", () => {
  const engine = new CalculatorEngine();
  enter(engine, ["2", "+", "3", "="]);
  assert.equal(engine.press("=").value, "8");
  assert.equal(engine.press("=").value, "11");
});

test("normalizes common floating point artifacts", () => {
  const engine = new CalculatorEngine();
  assert.equal(enter(engine, ["0", ".", "1", "+", "0", ".", "2", "="]).value, "0.3");
});

test("uses contextual percentage behavior", () => {
  const engine = new CalculatorEngine();
  assert.equal(enter(engine, ["5", "0", "+", "1", "0", "%", "="]).value, "55");

  engine.clearAll();
  assert.equal(enter(engine, ["5", "0", "×", "1", "0", "%", "="]).value, "5");
});

test("supports sign changes, decimals, and backspace", () => {
  const engine = new CalculatorEngine();
  assert.equal(enter(engine, ["1", "2", "3", "Backspace", "±"]).value, "-12");

  engine.clearAll();
  assert.equal(enter(engine, [".", "5", "+", ".", "2", "5", "="]).value, "0.75");
});

test("reports division by zero and recovers on numeric input", () => {
  const engine = new CalculatorEngine();
  const error = enter(engine, ["9", "÷", "0", "="]);
  assert.equal(error.value, "Error");
  assert.equal(error.error, true);

  assert.equal(engine.press("7").value, "7");
  assert.equal(engine.snapshot().error, false);
});

test("formats grouped display values without changing entry precision", () => {
  assert.equal(formatCalculatorValue("1234567.50"), "1,234,567.50");
  assert.equal(formatCalculatorValue("-42"), "−42");
  assert.equal(formatCalculatorValue("1e+21"), "1e21");
});
