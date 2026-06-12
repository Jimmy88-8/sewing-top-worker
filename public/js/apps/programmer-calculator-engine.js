const WIDTH = 64n;
const MASK = (1n << WIDTH) - 1n;
const OPERATORS = new Set(["+", "−", "×", "÷", "mod", "AND", "OR", "XOR", "NOR", "<<", ">>"]);

function normalize(value) {
  return value & MASK;
}

function parseEntry(entry, base) {
  if (base === 16) return BigInt(`0x${entry}`);
  if (base === 8) return BigInt(`0o${entry}`);
  return BigInt(entry);
}

function swapChunks(value, chunkBits) {
  const size = BigInt(chunkBits);
  const chunkMask = (1n << size) - 1n;
  let result = 0n;
  for (let offset = 0n; offset < WIDTH; offset += size * 2n) {
    const low = (value >> offset) & chunkMask;
    const high = (value >> (offset + size)) & chunkMask;
    result |= low << (offset + size);
    result |= high << offset;
  }
  return normalize(result);
}

function calculate(left, right, operator) {
  if (operator === "+") return normalize(left + right);
  if (operator === "−") return normalize(left - right);
  if (operator === "×") return normalize(left * right);
  if (operator === "÷") return right === 0n ? null : normalize(left / right);
  if (operator === "mod") return right === 0n ? null : normalize(left % right);
  if (operator === "AND") return normalize(left & right);
  if (operator === "OR") return normalize(left | right);
  if (operator === "XOR") return normalize(left ^ right);
  if (operator === "NOR") return normalize(~(left | right));
  if (operator === "<<") return normalize(left << (right % WIDTH));
  if (operator === ">>") return normalize(left >> (right % WIDTH));
  return null;
}

export class ProgrammerCalculatorEngine {
  constructor() {
    this.base = 10;
    this.characterMode = "ASCII";
    this.showBinary = true;
    this.clearAll();
  }

  clearAll() {
    this.value = 0n;
    this.entry = "0";
    this.accumulator = null;
    this.operator = null;
    this.waitingForOperand = false;
    this.justEvaluated = false;
    this.lastOperator = null;
    this.lastOperand = null;
    this.expression = "";
    this.error = false;
    this.groupStack = [];
  }

  press(key) {
    if (/^[0-9A-F]$/.test(key)) this.inputDigit(key);
    else if (key === "AC") this.clearAll();
    else if (key === "Backspace") this.backspace();
    else if (key === "(") this.openGroup();
    else if (key === ")") this.closeGroup();
    else if (key === "=" || key === "enter") this.equals();
    else if (OPERATORS.has(key)) this.chooseOperator(key);
    else if (key === "NOT") this.applyUnary((value) => ~value);
    else if (key === "NEG") this.applyUnary((value) => -value);
    else if (key === "RoL") this.applyUnary((value) => (value << 1n) | (value >> 63n));
    else if (key === "RoR") this.applyUnary((value) => (value >> 1n) | ((value & 1n) << 63n));
    else if (key === "flip8") this.applyUnary((value) => swapChunks(value, 8));
    else if (key === "flip16") this.applyUnary((value) => swapChunks(value, 16));
    else if (key === "base8") this.setBase(8);
    else if (key === "base10") this.setBase(10);
    else if (key === "base16") this.setBase(16);
    else if (key === "ASCII" || key === "Unicode") this.characterMode = key;
    else if (key === "Binary") this.showBinary = !this.showBinary;
    return this.snapshot();
  }

  inputDigit(digit) {
    if (parseInt(digit, 16) >= this.base || this.error) {
      if (this.error) this.clearAll();
      if (parseInt(digit, 16) >= this.base) return;
    }
    if (this.justEvaluated) this.clearAll();
    if (this.waitingForOperand) {
      this.entry = digit;
      this.waitingForOperand = false;
    } else {
      const maxDigits = this.base === 16 ? 16 : this.base === 8 ? 22 : 20;
      if (this.entry.length >= maxDigits) return;
      this.entry = this.entry === "0" ? digit : this.entry + digit;
    }
    this.value = normalize(parseEntry(this.entry, this.base));
    this.expression = this.operator ? `${this.format(this.accumulator)} ${this.operator}` : "";
  }

  backspace() {
    if (this.error) return this.clearAll();
    if (this.waitingForOperand) return;
    this.entry = this.entry.length > 1 ? this.entry.slice(0, -1) : "0";
    this.value = normalize(parseEntry(this.entry, this.base));
  }

  setBase(base) {
    this.base = base;
    this.entry = this.value.toString(base).toUpperCase();
  }

  chooseOperator(nextOperator) {
    if (this.error) return;
    if (this.operator && this.waitingForOperand) {
      this.operator = nextOperator;
      this.expression = `${this.format(this.accumulator)} ${nextOperator}`;
      return;
    }
    if (this.operator && this.accumulator !== null) {
      const result = calculate(this.accumulator, this.value, this.operator);
      if (result === null) return this.setError("Integer error");
      this.value = result;
      this.entry = this.formatRaw(result);
    }
    this.accumulator = this.value;
    this.operator = nextOperator;
    this.waitingForOperand = true;
    this.justEvaluated = false;
    this.lastOperator = null;
    this.lastOperand = null;
    this.expression = `${this.format(this.accumulator)} ${nextOperator}`;
  }

  openGroup() {
    if (this.error) return;
    this.groupStack.push({
      accumulator: this.accumulator,
      operator: this.operator,
      expression: this.expression,
    });
    this.value = 0n;
    this.entry = "0";
    this.accumulator = null;
    this.operator = null;
    this.waitingForOperand = false;
    this.justEvaluated = false;
    this.expression = `${this.expression} (`;
  }

  closeGroup() {
    if (!this.groupStack.length || this.error) return;
    if (this.operator && this.accumulator !== null) {
      const result = calculate(this.accumulator, this.value, this.operator);
      if (result === null) return this.setError("Integer error");
      this.value = result;
      this.entry = this.formatRaw(result);
    }
    const outer = this.groupStack.pop();
    this.accumulator = outer.accumulator;
    this.operator = outer.operator;
    this.waitingForOperand = false;
    this.justEvaluated = false;
    this.expression = `${outer.expression} (${this.format(this.value)})`;
  }

  equals() {
    if (this.error) return;
    const operator = this.operator ?? this.lastOperator;
    const left = this.operator ? this.accumulator : this.value;
    const right = this.operator
      ? (this.waitingForOperand ? this.accumulator : this.value)
      : this.lastOperand;
    if (!operator || left === null || right === null) return;
    const result = calculate(left, right, operator);
    if (result === null) return this.setError("Integer error");
    this.expression = `${this.format(left)} ${operator} ${this.format(right)} =`;
    this.value = result;
    this.entry = this.formatRaw(result);
    this.lastOperator = operator;
    this.lastOperand = right;
    this.accumulator = null;
    this.operator = null;
    this.waitingForOperand = true;
    this.justEvaluated = true;
  }

  applyUnary(fn) {
    if (this.error) return;
    this.value = normalize(fn(this.value));
    this.entry = this.formatRaw(this.value);
    this.waitingForOperand = false;
    this.justEvaluated = false;
  }

  toggleBit(index) {
    const bit = BigInt(index);
    if (bit < 0n || bit >= WIDTH) return this.snapshot();
    this.value = normalize(this.value ^ (1n << bit));
    this.entry = this.formatRaw(this.value);
    this.waitingForOperand = false;
    this.justEvaluated = false;
    return this.snapshot();
  }

  loadValue(value) {
    try {
      this.clearAll();
      this.value = normalize(BigInt(value));
      this.entry = this.formatRaw(this.value);
      this.justEvaluated = true;
    } catch {
      this.setError("Invalid integer");
    }
    return this.snapshot();
  }

  snapshot() {
    const codePoint = Number(this.value & (this.characterMode === "ASCII" ? 0x7fn : 0xffffn));
    const printable = codePoint >= 32 && codePoint !== 127;
    return {
      value: this.value.toString(),
      display: this.error ? "Error" : this.format(this.value),
      expression: this.expression,
      operator: this.operator,
      base: this.base,
      bits: this.value.toString(2).padStart(64, "0"),
      showBinary: this.showBinary,
      characterMode: this.characterMode,
      character: printable ? String.fromCodePoint(codePoint) : "",
      error: this.error,
    };
  }

  format(value) {
    if (value === null) return "0";
    const raw = value.toString(this.base).toUpperCase();
    if (this.base !== 10) return raw;
    return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  formatRaw(value) {
    return value.toString(this.base).toUpperCase();
  }

  setError(message) {
    this.error = true;
    this.expression = message;
    this.entry = "0";
    this.value = 0n;
    this.accumulator = null;
    this.operator = null;
    this.waitingForOperand = true;
  }
}
