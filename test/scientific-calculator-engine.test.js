import test from "node:test";
import assert from "node:assert/strict";

import { ScientificCalculatorEngine } from "../public/js/apps/scientific-calculator-engine.js";

function enter(engine, keys) {
  for (const key of keys) engine.press(key);
  return engine.snapshot();
}

test("scientific mode respects precedence and parentheses", () => {
  const engine = new ScientificCalculatorEngine();
  assert.equal(enter(engine, ["2", "+", "3", "×", "4", "="]).value, "14");

  engine.clearAll();
  assert.equal(enter(engine, ["(", "2", "+", "3", ")", "×", "4", "="]).value, "20");
});

test("scientific mode supports powers, roots, and logarithms", () => {
  const engine = new ScientificCalculatorEngine();
  assert.equal(enter(engine, ["2", "^", "8", "="]).value, "256");

  engine.clearAll();
  assert.equal(enter(engine, ["2", "7", "root", "3", "="]).value, "3");

  engine.clearAll();
  assert.equal(enter(engine, ["8", "logy", "2", "="]).value, "3");

  engine.clearAll();
  assert.equal(enter(engine, ["3", "reversePower", "2", "="]).value, "8");
});

test("scientific mode handles degree and radian trigonometry", () => {
  const engine = new ScientificCalculatorEngine();
  assert.equal(enter(engine, ["3", "0", "sin"]).value, "0.5");

  engine.clearAll();
  enter(engine, ["Angle"]);
  assert.equal(enter(engine, ["π", "÷", "2", "=", "sin"]).value, "1");
});

test("scientific mode supports factorial, memory, and inverse functions", () => {
  const engine = new ScientificCalculatorEngine();
  assert.equal(enter(engine, ["5", "x!"]).value, "120");

  enter(engine, ["m+", "AC", "mr"]);
  assert.equal(engine.snapshot().value, "120");

  engine.clearAll();
  assert.equal(enter(engine, ["0", ".", "5", "sin⁻¹"]).value, "30");
});

test("scientific mode reports domain errors and recovers", () => {
  const engine = new ScientificCalculatorEngine();
  assert.equal(enter(engine, ["1", "±", "²√x"]).error, true);
  assert.equal(engine.press("9").value, "9");
});

test("scientific notation supports signed exponents", () => {
  const engine = new ScientificCalculatorEngine();
  assert.equal(enter(engine, ["1", "EE", "−", "3", "="]).value, "0.001");
});
