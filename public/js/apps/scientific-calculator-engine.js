import { formatCalculatorValue } from "./calculator-engine.js";

const OPERATORS = new Set(["+", "−", "×", "÷", "^", "reversePower", "root", "logy"]);
const PRECEDENCE = { "+": 1, "−": 1, "×": 2, "÷": 2, "^": 3, reversePower: 3, root: 3, logy: 3 };
const RIGHT_ASSOCIATIVE = new Set(["^", "reversePower", "root", "logy"]);
const LABELS = { reversePower: "yˣ", root: "ʸ√x", logy: "logᵧ" };

function normalize(value) {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) < 1e-12) return 0;
  return Number(value.toPrecision(12));
}

function calculate(left, right, operator) {
  let result;
  if (operator === "+") result = left + right;
  else if (operator === "−") result = left - right;
  else if (operator === "×") result = left * right;
  else if (operator === "÷") result = right === 0 ? NaN : left / right;
  else if (operator === "^") result = left ** right;
  else if (operator === "reversePower") result = right ** left;
  else if (operator === "root") {
    if (right === 0 || (left < 0 && Math.abs(right % 2) !== 1)) return null;
    result = left < 0 ? -(Math.abs(left) ** (1 / right)) : left ** (1 / right);
  } else if (operator === "logy") {
    result = left > 0 && right > 0 && right !== 1 ? Math.log(left) / Math.log(right) : NaN;
  } else return null;
  return normalize(result);
}

function evaluate(tokens) {
  const output = [];
  const operators = [];

  for (const token of tokens) {
    if (typeof token === "number") {
      output.push(token);
    } else if (token === "(") {
      operators.push(token);
    } else if (token === ")") {
      while (operators.length && operators.at(-1) !== "(") output.push(operators.pop());
      if (operators.pop() !== "(") return null;
    } else if (OPERATORS.has(token)) {
      while (operators.length && OPERATORS.has(operators.at(-1))) {
        const top = operators.at(-1);
        const shouldPop = RIGHT_ASSOCIATIVE.has(token)
          ? PRECEDENCE[token] < PRECEDENCE[top]
          : PRECEDENCE[token] <= PRECEDENCE[top];
        if (!shouldPop) break;
        output.push(operators.pop());
      }
      operators.push(token);
    }
  }

  while (operators.length) {
    const token = operators.pop();
    if (token === "(" || token === ")") return null;
    output.push(token);
  }

  const stack = [];
  for (const token of output) {
    if (typeof token === "number") {
      stack.push(token);
      continue;
    }
    if (stack.length < 2) return null;
    const right = stack.pop();
    const left = stack.pop();
    const result = calculate(left, right, token);
    if (result === null) return null;
    stack.push(result);
  }
  return stack.length === 1 ? stack[0] : null;
}

function factorial(value) {
  if (!Number.isInteger(value) || value < 0 || value > 170) return null;
  let result = 1;
  for (let i = 2; i <= value; i += 1) result *= i;
  return normalize(result);
}

export class ScientificCalculatorEngine {
  constructor() {
    this.memory = 0;
    this.angle = "deg";
    this.second = false;
    this.clearAll();
  }

  clearAll() {
    this.value = "0";
    this.tokens = [];
    this.entryActive = false;
    this.justEvaluated = false;
    this.expression = "";
    this.error = false;
    this.lastOperator = null;
    this.lastOperand = null;
  }

  press(key) {
    if (/^\d$/.test(key)) this.inputDigit(key);
    else if (key === ".") this.inputDecimal();
    else if (key === "EE") this.inputExponent();
    else if (key === "AC") this.clearAll();
    else if (key === "Backspace") this.backspace();
    else if (key === "±") this.toggleSign();
    else if (key === "%") this.applyUnary("percent");
    else if (key === "(") this.openParenthesis();
    else if (key === ")") this.closeParenthesis();
    else if (key === "=") this.equals();
    else if (OPERATORS.has(key)) this.chooseOperator(key);
    else if (key === "π") this.setValue(Math.PI);
    else if (key === "e") this.setValue(Math.E);
    else if (key === "Rand") this.setValue(Math.random());
    else if (key === "2nd") this.second = !this.second;
    else if (key === "Angle") this.angle = this.angle === "deg" ? "rad" : "deg";
    else if (key === "mc") this.memory = 0;
    else if (key === "m+") this.memory = normalize(this.memory + Number(this.value)) ?? 0;
    else if (key === "m−") this.memory = normalize(this.memory - Number(this.value)) ?? 0;
    else if (key === "mr") this.setValue(this.memory);
    else this.applyUnary(key);
    return this.snapshot();
  }

  loadValue(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return this.snapshot();
    this.clearAll();
    this.setValue(parsed);
    this.justEvaluated = true;
    return this.snapshot();
  }

  inputDigit(digit) {
    if (this.error || this.justEvaluated) this.clearAll();
    if (!this.entryActive) {
      this.value = digit;
      this.entryActive = true;
    } else if (this.value === "0") {
      this.value = digit;
    } else if (this.value === "-0") {
      this.value = `-${digit}`;
    } else if (this.value.replace(/\D/g, "").length < 15) {
      this.value += digit;
    }
    this.updateExpression();
  }

  inputDecimal() {
    if (this.error || this.justEvaluated) this.clearAll();
    if (!this.entryActive) {
      this.value = "0.";
      this.entryActive = true;
    } else if (!this.value.includes(".") && !/e/i.test(this.value)) {
      this.value += ".";
    }
    this.updateExpression();
  }

  inputExponent() {
    if (this.error || this.justEvaluated) this.clearAll();
    if (!this.entryActive) {
      this.value = "1e";
      this.entryActive = true;
    } else if (!/e/i.test(this.value)) {
      this.value += "e";
    }
    this.updateExpression();
  }

  backspace() {
    if (this.error) return this.clearAll();
    if (!this.entryActive) return;
    this.value = this.value.length <= 1 || (this.value.startsWith("-") && this.value.length === 2)
      ? "0"
      : this.value.slice(0, -1);
    this.entryActive = this.value !== "0";
    this.updateExpression();
  }

  toggleSign() {
    if (this.error) return;
    if (this.justEvaluated) {
      this.tokens = [];
      this.justEvaluated = false;
    }
    if (!this.entryActive) this.entryActive = true;
    this.value = this.value.startsWith("-") ? this.value.slice(1) : `-${this.value}`;
    this.updateExpression();
  }

  openParenthesis() {
    if (this.error || this.justEvaluated) this.clearAll();
    if (this.entryActive) {
      if (!this.pushCurrent()) return;
      this.tokens.push("×");
    } else if (typeof this.tokens.at(-1) === "number" || this.tokens.at(-1) === ")") {
      this.tokens.push("×");
    }
    this.tokens.push("(");
    this.entryActive = false;
    this.value = "0";
    this.updateExpression();
  }

  closeParenthesis() {
    if (this.error || !this.tokens.includes("(")) return;
    if (this.entryActive && !this.pushCurrent()) return;
    if (OPERATORS.has(this.tokens.at(-1)) || this.tokens.at(-1) === "(") return;
    this.tokens.push(")");
    const partial = this.evaluateCurrent();
    if (partial !== null) this.value = String(partial);
    this.updateExpression();
  }

  chooseOperator(operator) {
    if (this.error) return;
    if (this.entryActive && /e$/i.test(this.value) && (operator === "+" || operator === "−")) {
      this.value += operator === "−" ? "-" : "+";
      this.updateExpression();
      return;
    }
    if (this.justEvaluated) {
      this.tokens = [Number(this.value)];
      this.justEvaluated = false;
    } else if (this.entryActive && !this.pushCurrent()) {
      return;
    }

    if (OPERATORS.has(this.tokens.at(-1))) this.tokens[this.tokens.length - 1] = operator;
    else if (this.tokens.length && this.tokens.at(-1) !== "(") this.tokens.push(operator);
    else if (!this.tokens.length) this.tokens.push(Number(this.value), operator);
    this.entryActive = false;
    this.updateExpression();
  }

  applyUnary(key) {
    if (this.error) return;
    const value = Number(this.value);
    if (!Number.isFinite(value)) return this.setError("Invalid number");

    const toRadians = (n) => this.angle === "deg" ? n * Math.PI / 180 : n;
    const fromRadians = (n) => this.angle === "deg" ? n * 180 / Math.PI : n;
    let result;

    if (key === "x²") result = value ** 2;
    else if (key === "x³") result = value ** 3;
    else if (key === "2ˣ") result = 2 ** value;
    else if (key === "eˣ") result = Math.exp(value);
    else if (key === "10ˣ") result = 10 ** value;
    else if (key === "1/x") result = value === 0 ? NaN : 1 / value;
    else if (key === "²√x") result = value < 0 ? NaN : Math.sqrt(value);
    else if (key === "³√x") result = Math.cbrt(value);
    else if (key === "ln") result = value > 0 ? Math.log(value) : NaN;
    else if (key === "log₁₀") result = value > 0 ? Math.log10(value) : NaN;
    else if (key === "log₂") result = value > 0 ? Math.log2(value) : NaN;
    else if (key === "x!") result = factorial(value);
    else if (key === "sin") result = Math.sin(toRadians(value));
    else if (key === "cos") result = Math.cos(toRadians(value));
    else if (key === "tan") result = Math.tan(toRadians(value));
    else if (key === "sin⁻¹") result = value >= -1 && value <= 1 ? fromRadians(Math.asin(value)) : NaN;
    else if (key === "cos⁻¹") result = value >= -1 && value <= 1 ? fromRadians(Math.acos(value)) : NaN;
    else if (key === "tan⁻¹") result = fromRadians(Math.atan(value));
    else if (key === "sinh") result = Math.sinh(value);
    else if (key === "cosh") result = Math.cosh(value);
    else if (key === "tanh") result = Math.tanh(value);
    else if (key === "sinh⁻¹") result = Math.asinh(value);
    else if (key === "cosh⁻¹") result = value >= 1 ? Math.acosh(value) : NaN;
    else if (key === "tanh⁻¹") result = Math.abs(value) < 1 ? Math.atanh(value) : NaN;
    else if (key === "percent") result = value / 100;
    else return;

    const normalized = result === null ? null : normalize(result);
    if (normalized === null) return this.setError("Domain error");
    this.setValue(normalized);
    this.updateExpression();
  }

  equals() {
    if (this.error) return;

    if (this.justEvaluated && this.lastOperator && this.lastOperand !== null) {
      const result = calculate(Number(this.value), this.lastOperand, this.lastOperator);
      if (result === null) return this.setError("Math error");
      const left = this.value;
      this.value = String(result);
      this.expression = `${formatCalculatorValue(left)} ${this.label(this.lastOperator)} ${formatCalculatorValue(String(this.lastOperand))} =`;
      return;
    }

    if (this.entryActive && !this.pushCurrent()) return;
    const unmatched = this.tokens.filter((token) => token === "(").length
      - this.tokens.filter((token) => token === ")").length;
    for (let i = 0; i < unmatched; i += 1) this.tokens.push(")");
    if (!this.tokens.length || OPERATORS.has(this.tokens.at(-1))) return;

    const result = evaluate(this.tokens);
    if (result === null) return this.setError("Math error");

    const lastOperatorIndex = this.tokens.findLastIndex((token) => OPERATORS.has(token));
    this.lastOperator = lastOperatorIndex >= 0 ? this.tokens[lastOperatorIndex] : null;
    this.lastOperand = lastOperatorIndex >= 0 && typeof this.tokens[lastOperatorIndex + 1] === "number"
      ? this.tokens[lastOperatorIndex + 1]
      : null;
    this.expression = `${this.tokens.map((token) => this.label(token)).join(" ")} =`;
    this.value = String(result);
    this.tokens = [];
    this.entryActive = false;
    this.justEvaluated = true;
  }

  snapshot() {
    return {
      value: this.value,
      display: this.error ? "Error" : formatCalculatorValue(this.value),
      expression: this.expression,
      operator: OPERATORS.has(this.tokens.at(-1)) ? this.tokens.at(-1) : null,
      angle: this.angle,
      second: this.second,
      memory: this.memory,
      error: this.error,
    };
  }

  setValue(value) {
    const normalized = normalize(value);
    if (normalized === null) return this.setError("Math error");
    this.value = String(normalized);
    this.entryActive = true;
    this.error = false;
  }

  pushCurrent() {
    const value = Number(this.value);
    if (!Number.isFinite(value)) {
      this.setError("Invalid number");
      return false;
    }
    this.tokens.push(value);
    this.entryActive = false;
    return true;
  }

  evaluateCurrent() {
    const tokens = [...this.tokens];
    const unmatched = tokens.filter((token) => token === "(").length
      - tokens.filter((token) => token === ")").length;
    for (let i = 0; i < unmatched; i += 1) tokens.push(")");
    return evaluate(tokens);
  }

  updateExpression() {
    const parts = this.tokens.map((token) => this.label(token));
    if (this.entryActive) parts.push(formatCalculatorValue(this.value));
    this.expression = parts.join(" ");
  }

  label(token) {
    return LABELS[token] ?? token;
  }

  setError(message) {
    this.value = "Error";
    this.expression = message;
    this.tokens = [];
    this.entryActive = false;
    this.justEvaluated = false;
    this.error = true;
  }
}
