const OPERATORS = new Set(["+", "−", "×", "÷"]);
const MAX_INPUT_DIGITS = 15;
const RESULT_PRECISION = 12;

function cleanNumber(value) {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) < 1e-12) return 0;
  return Number(value.toPrecision(RESULT_PRECISION));
}

function calculate(left, right, operator) {
  let result;
  if (operator === "+") result = left + right;
  else if (operator === "−") result = left - right;
  else if (operator === "×") result = left * right;
  else if (operator === "÷") result = right === 0 ? NaN : left / right;
  else return null;
  return cleanNumber(result);
}

export function formatCalculatorValue(value) {
  if (value === "Error") return value;

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  if (/e/i.test(unsigned)) return value.replace("e+", "e");

  const [integer, fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "−" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

export class CalculatorEngine {
  constructor() {
    this.clearAll();
  }

  clearAll() {
    this.value = "0";
    this.accumulator = null;
    this.operator = null;
    this.waitingForOperand = false;
    this.lastOperator = null;
    this.lastOperand = null;
    this.justEvaluated = false;
    this.expression = "";
    this.error = false;
  }

  press(key) {
    if (/^\d$/.test(key)) this.inputDigit(key);
    else if (key === ".") this.inputDecimal();
    else if (key === "AC") this.clearAll();
    else if (key === "Backspace") this.backspace();
    else if (key === "±") this.toggleSign();
    else if (key === "%") this.percentage();
    else if (key === "=") this.equals();
    else if (OPERATORS.has(key)) this.chooseOperator(key);
    return this.snapshot();
  }

  loadValue(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return this.snapshot();
    this.clearAll();
    this.value = String(cleanNumber(parsed));
    this.justEvaluated = true;
    this.waitingForOperand = true;
    return this.snapshot();
  }

  inputDigit(digit) {
    if (this.error || this.justEvaluated) this.#startNewCalculation();

    if (this.waitingForOperand) {
      this.value = digit;
      this.waitingForOperand = false;
      return;
    }

    const digitCount = this.value.replace(/\D/g, "").length;
    if (digitCount >= MAX_INPUT_DIGITS) return;

    if (this.value === "0") this.value = digit;
    else if (this.value === "-0") this.value = `-${digit}`;
    else this.value += digit;
  }

  inputDecimal() {
    if (this.error || this.justEvaluated) this.#startNewCalculation();

    if (this.waitingForOperand) {
      this.value = "0.";
      this.waitingForOperand = false;
    } else if (!this.value.includes(".") && !/e/i.test(this.value)) {
      this.value += ".";
    }
  }

  backspace() {
    if (this.error) {
      this.clearAll();
      return;
    }
    if (this.waitingForOperand) return;

    if (this.justEvaluated) {
      this.accumulator = null;
      this.operator = null;
      this.lastOperator = null;
      this.lastOperand = null;
      this.expression = "";
      this.justEvaluated = false;
    }

    if (/e/i.test(this.value) || this.value.length <= 1 || (this.value.startsWith("-") && this.value.length === 2)) {
      this.value = "0";
    } else {
      this.value = this.value.slice(0, -1);
    }
  }

  toggleSign() {
    if (this.error) return;
    if (this.justEvaluated) {
      this.lastOperator = null;
      this.lastOperand = null;
      this.expression = "";
      this.justEvaluated = false;
    }
    if (this.waitingForOperand) {
      this.value = "-0";
      this.waitingForOperand = false;
    } else if (this.value.startsWith("-")) {
      this.value = this.value.slice(1);
    } else {
      this.value = `-${this.value}`;
    }
  }

  percentage() {
    if (this.error) return;
    const current = Number(this.value);
    const result = this.operator === "+" || this.operator === "−"
      ? (this.accumulator ?? 0) * current / 100
      : current / 100;
    this.#setResult(result);
    this.waitingForOperand = false;
    this.justEvaluated = false;
  }

  chooseOperator(nextOperator) {
    if (this.error) return;

    if (this.operator && this.waitingForOperand) {
      this.operator = nextOperator;
      this.expression = `${this.#displayNumber(this.accumulator)} ${nextOperator}`;
      return;
    }

    const inputValue = Number(this.value);
    if (this.operator && this.accumulator !== null) {
      const result = calculate(this.accumulator, inputValue, this.operator);
      if (result === null) {
        this.#setError();
        return;
      }
      this.value = String(result);
      this.accumulator = result;
    } else {
      this.accumulator = inputValue;
    }

    this.operator = nextOperator;
    this.waitingForOperand = true;
    this.justEvaluated = false;
    this.lastOperator = null;
    this.lastOperand = null;
    this.expression = `${this.#displayNumber(this.accumulator)} ${nextOperator}`;
  }

  equals() {
    if (this.error) return;

    if (this.operator && this.accumulator !== null) {
      const left = this.accumulator;
      const right = this.waitingForOperand ? left : Number(this.value);
      const operator = this.operator;
      const result = calculate(left, right, operator);
      if (result === null) {
        this.#setError();
        return;
      }

      this.expression = `${this.#displayNumber(left)} ${operator} ${this.#displayNumber(right)} =`;
      this.value = String(result);
      this.lastOperator = operator;
      this.lastOperand = right;
      this.accumulator = null;
      this.operator = null;
      this.waitingForOperand = true;
      this.justEvaluated = true;
      return;
    }

    if (this.justEvaluated && this.lastOperator && this.lastOperand !== null) {
      const left = Number(this.value);
      const result = calculate(left, this.lastOperand, this.lastOperator);
      if (result === null) {
        this.#setError();
        return;
      }
      this.expression = `${this.#displayNumber(left)} ${this.lastOperator} ${this.#displayNumber(this.lastOperand)} =`;
      this.value = String(result);
    }
  }

  snapshot() {
    return {
      value: this.value,
      display: formatCalculatorValue(this.value),
      expression: this.expression,
      operator: this.operator,
      waitingForOperand: this.waitingForOperand,
      error: this.error,
    };
  }

  #startNewCalculation() {
    this.clearAll();
  }

  #setResult(value) {
    const result = cleanNumber(value);
    if (result === null) this.#setError();
    else this.value = String(result);
  }

  #setError() {
    this.value = "Error";
    this.accumulator = null;
    this.operator = null;
    this.waitingForOperand = true;
    this.lastOperator = null;
    this.lastOperand = null;
    this.justEvaluated = false;
    this.expression = "Cannot divide by zero";
    this.error = true;
  }

  #displayNumber(value) {
    return formatCalculatorValue(String(value));
  }
}
