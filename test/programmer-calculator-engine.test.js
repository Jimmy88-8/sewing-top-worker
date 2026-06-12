import test from "node:test";
import assert from "node:assert/strict";

import { ProgrammerCalculatorEngine } from "../public/js/apps/programmer-calculator-engine.js";

function enter(engine, keys) {
  for (const key of keys) engine.press(key);
  return engine.snapshot();
}

test("programmer mode switches bases without losing integer precision", () => {
  const engine = new ProgrammerCalculatorEngine();
  enter(engine, ["base16", "F", "F"]);
  assert.equal(engine.snapshot().value, "255");
  assert.equal(engine.snapshot().display, "FF");

  enter(engine, ["base10"]);
  assert.equal(engine.snapshot().display, "255");
});

test("programmer mode truncates integer division", () => {
  const engine = new ProgrammerCalculatorEngine();
  assert.equal(enter(engine, ["9", "9", "÷", "1", "0", "enter"]).value, "9");
});

test("programmer mode performs bitwise operations and shifts", () => {
  const engine = new ProgrammerCalculatorEngine();
  assert.equal(enter(engine, ["base16", "F", "F", "AND", "0", "F", "enter"]).display, "F");

  engine.clearAll();
  enter(engine, ["base16"]);
  assert.equal(enter(engine, ["1", "<<", "8", "enter"]).display, "100");
});

test("programmer mode rotates, flips chunks, and toggles bits", () => {
  const engine = new ProgrammerCalculatorEngine();
  enter(engine, ["base16", "8", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"]);
  assert.equal(engine.press("RoL").display, "1");

  engine.clearAll();
  enter(engine, ["base16", "A", "B", "C", "D", "flip8"]);
  assert.equal(engine.snapshot().display, "CDAB");

  engine.clearAll();
  engine.toggleBit(3);
  assert.equal(engine.snapshot().value, "8");
  assert.equal(engine.snapshot().bits.at(-4), "1");
});

test("programmer mode supports grouped arithmetic and character display", () => {
  const engine = new ProgrammerCalculatorEngine();
  assert.equal(enter(engine, ["2", "×", "(", "3", "+", "4", ")", "enter"]).value, "14");

  engine.clearAll();
  enter(engine, ["6", "5"]);
  assert.equal(engine.snapshot().character, "A");
});
