const expressionEl = document.querySelector("#expression");
const resultEl = document.querySelector("#result");
const stateEl = document.querySelector("#calcState");
const memoryStateEl = document.querySelector("#memoryState");
const historyList = document.querySelector("#historyList");
const displayEl = document.querySelector(".display");
const angleToggle = document.querySelector("#angleToggle");
const diagnosticResult = document.querySelector("#diagnosticResult");
const keys = document.querySelectorAll(".key");
const scienceKeys = document.querySelectorAll(".science-key");

let expression = "";
let displayExpression = "";
let pendingUnary = [];
let justCalculated = false;
let history = [];
let memoryValue = null;
let angleMode = "DEG";

const operatorMap = { "+": "+", "−": "-", "×": "*", "÷": "/", "^": "^" };
const unaryNotation = {
  sqrt: { prefix: "√" },
  square: { suffix: "²" },
  reciprocal: { prefix: "1/" },
  log: { prefix: "log" },
  ln: { prefix: "ln" },
  sin: { prefix: "sin" },
  cos: { prefix: "cos" },
  tan: { prefix: "tan" },
  factorial: { suffix: "!" },
};

function isUnaryMinusAtEnd(value) {
  if (value.at(-1) !== "−") return false;
  const characterBeforeMinus = value.at(-2);
  return value.length === 1 || Object.hasOwn(operatorMap, characterBeforeMinus) || characterBeforeMinus === "(";
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "Error";
  const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 10 }).format(rounded);
}

function rawNumber(value) {
  return value.replaceAll(",", "");
}

function formatPendingExpression(base) {
  let formatted = base;
  pendingUnary.forEach((functionName) => {
    const notation = unaryNotation[functionName];
    if (notation.suffix) formatted = formatted ? `${formatted}${notation.suffix}` : `x${notation.suffix}`;
    else if (notation.prefix === "1/") formatted = formatted ? `1/(${formatted})` : "1/(";
    else formatted = formatted ? `${notation.prefix}(${formatted})` : `${notation.prefix}(`;
  });
  return formatted;
}

function updateDisplay() {
  const pendingExpression = pendingUnary.length ? formatPendingExpression(expression) : "";
  const visibleExpression = displayExpression || pendingExpression || expression;
  expressionEl.textContent = visibleExpression || " ";
  displayEl.style.setProperty("--signal", `${Math.min(visibleExpression.length * 7, 100)}%`);
  resultEl.classList.remove("is-error");
  memoryStateEl.textContent = memoryValue === null ? "M EMPTY" : `M ${formatNumber(memoryValue)}`;
  if (!expression && !pendingUnary.length) {
    resultEl.textContent = "0";
    stateEl.textContent = "IDLE";
    return;
  }
  if (pendingUnary.length) {
    resultEl.textContent = "…";
    stateEl.textContent = expression ? "READY" : "WAITING";
    return;
  }
  const preview = evaluateExpression(expression, true);
  resultEl.textContent = preview === null ? "…" : formatNumber(preview);
  stateEl.textContent = justCalculated ? "SOLVED" : "INPUT";
}

function evaluateExpression(input, preview = false) {
  const sanitized = input.replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-").replaceAll(",", "");
  const tokens = [];
  let cursor = 0;

  // Turn the expression into small, predictable tokens first. This means values
  // such as "09" are read as the number 9 instead of being handed to JavaScript
  // as an invalid legacy-style numeric literal.
  while (cursor < sanitized.length) {
    const character = sanitized[cursor];
    if (/\s/.test(character)) { cursor += 1; continue; }
    if (/[0-9.]/.test(character)) {
      const match = sanitized.slice(cursor).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!match) return preview ? null : NaN;
      tokens.push(match[0]);
      cursor += match[0].length;
      continue;
    }
    if ("+-*/()%^".includes(character)) {
      tokens.push(character);
      cursor += 1;
      continue;
    }
    return preview ? null : NaN;
  }

  let position = 0;
  const peek = () => tokens[position];
  const consume = () => tokens[position++];
  const isNumber = (token) => token !== undefined && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token);

  function parseExpression() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const nextValue = parseTerm();
      value = operator === "+" ? value + nextValue : value - nextValue;
    }
    return value;
  }

  function parseTerm() {
    let value = parsePower();
    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const nextValue = parsePower();
      value = operator === "*" ? value * nextValue : value / nextValue;
    }
    return value;
  }

  function parsePower() {
    const base = parseFactor();
    if (peek() === "^") {
      consume();
      return Math.pow(base, parsePower());
    }
    return base;
  }

  function parseFactor() {
    let value = parseUnary();
    while (peek() === "%") {
      consume();
      value /= 100;
    }
    return value;
  }

  function parseUnary() {
    if (peek() === "+") { consume(); return parseUnary(); }
    if (peek() === "-") { consume(); return -parseUnary(); }
    return parsePrimary();
  }

  function parsePrimary() {
    if (peek() === "(") {
      consume();
      const value = parseExpression();
      if (consume() !== ")") throw new Error("Unclosed group");
      return value;
    }
    const token = consume();
    if (!isNumber(token)) throw new Error("Expected a number");
    return Number(token);
  }

  try {
    if (!tokens.length) return preview ? null : NaN;
    const value = parseExpression();
    if (position !== tokens.length || !Number.isFinite(value)) throw new Error("Invalid expression");
    return value;
  } catch {
    return preview ? null : NaN;
  }
}

function setError() {
  resultEl.textContent = "CAN’T SOLVE THAT";
  resultEl.classList.add("is-error");
  stateEl.textContent = "CHECK INPUT";
}

function currentValue() {
  if (!expression) return null;
  const value = evaluateExpression(expression);
  return Number.isFinite(value) ? value : null;
}

function setSolvedValue(value, label = "") {
  if (!Number.isFinite(value)) { setError(); return; }
  expression = rawNumber(formatNumber(value));
  pendingUnary = [];
  displayExpression = label;
  justCalculated = true;
  updateDisplay();
}

function toRadians(value) {
  return angleMode === "DEG" ? value * (Math.PI / 180) : value;
}

function evaluateUnary(functionName, value) {
  const functions = {
    sqrt: () => Math.sqrt(value),
    square: () => value ** 2,
    reciprocal: () => 1 / value,
    log: () => Math.log10(value),
    ln: () => Math.log(value),
    sin: () => Math.sin(toRadians(value)),
    cos: () => Math.cos(toRadians(value)),
    tan: () => {
      const radians = toRadians(value);
      // Floating-point sine/cosine can turn tan(90°) into a huge finite number.
      // Treat angles at the vertical asymptote as undefined instead.
      return Math.abs(Math.cos(radians)) < 1e-12 ? NaN : Math.tan(radians);
    },
    factorial: () => {
      if (!Number.isInteger(value) || value < 0 || value > 170) return NaN;
      let answer = 1;
      for (let index = 2; index <= value; index += 1) answer *= index;
      return answer;
    },
  };

  return functions[functionName]?.();
}

function applyUnary(functionName) {
  if (justCalculated) {
    displayExpression = "";
    justCalculated = false;
  }
  pendingUnary.push(functionName);
  updateDisplay();
}

function insertConstant(name) {
  const constant = name === "pi" ? String(Math.PI) : String(Math.E);
  if (justCalculated) expression = "";
  displayExpression = "";
  if (expression && (/[0-9)]$/.test(expression))) expression += "×";
  expression += constant;
  justCalculated = false;
  updateDisplay();
}

function memoryAction(action) {
  if (action === "clear") {
    memoryValue = null;
  } else if (action === "recall") {
    if (memoryValue !== null) setSolvedValue(memoryValue);
  } else {
    const value = currentValue();
    if (value === null) { setError(); return; }
    memoryValue = action === "add" ? (memoryValue ?? 0) + value : (memoryValue ?? 0) - value;
  }
  updateDisplay();
}

function runDiagnostics() {
  const checks = [
    ["2+2", 4],
    ["09-8", 1],
    ["2+2*3", 8],
    ["50%", 0.5],
    ["3^2", 9],
    ["(10-4)/2", 3],
  ];
  const passed = checks.filter(([input, expected]) => evaluateExpression(input) === expected).length;
  diagnosticResult.textContent = `${passed}/${checks.length} CHECKS PASSED`;
  diagnosticResult.classList.toggle("diagnostic-good", passed === checks.length);
}

function calculate() {
  if (!expression) {
    if (pendingUnary.length) setError();
    return;
  }
  const value = evaluateExpression(expression);
  if (!Number.isFinite(value)) { setError(); return; }
  const shownExpression = pendingUnary.length ? formatPendingExpression(expression) : (displayExpression || expression);
  let finalValue = value;
  for (const functionName of pendingUnary) finalValue = evaluateUnary(functionName, finalValue);
  if (!Number.isFinite(finalValue)) { setError(); return; }
  const solved = formatNumber(finalValue);
  history.unshift({ expression: shownExpression, value: solved });
  history = history.slice(0, 6);
  expression = rawNumber(solved);
  pendingUnary = [];
  displayExpression = shownExpression;
  justCalculated = true;
  displayEl.classList.add("is-solved");
  window.setTimeout(() => displayEl.classList.remove("is-solved"), 500);
  renderHistory();
  updateDisplay();
}

function addValue(value) {
  if (justCalculated && (/[0-9.]/.test(value) || value === "(")) expression = "";
  displayExpression = "";
  justCalculated = false;
  const lastChar = expression.at(-1);
  const isOperator = Object.hasOwn(operatorMap, value);

  if (isOperator && !expression && value !== "−") return;
  if (isOperator && value === "−" && Object.hasOwn(operatorMap, lastChar)) {
    // A minus after another operator is a unary sign: 2 × −2.
    // It must be kept, not treated as a replacement for the × or ÷ button.
    if (lastChar !== "−" || !isUnaryMinusAtEnd(expression)) expression += value;
  } else if (isOperator && Object.hasOwn(operatorMap, lastChar)) {
    // A second binary operator replaces the previous one: 8 + × becomes 8 ×.
    // If the trailing minus is already unary, leave it alone until a number arrives.
    if (!isUnaryMinusAtEnd(expression)) expression = expression.slice(0, -1) + value;
  }
  else if (value === "." && (lastChar === "." || /[+−×÷^]\d*\.\d*$/.test(expression))) return;
  else if (value === "%" && (!/\d$/.test(expression))) return;
  else expression += value;
  updateDisplay();
}

function backspace() {
  expression = expression.slice(0, -1);
  displayExpression = "";
  justCalculated = false;
  updateDisplay();
}

function clearAll() {
  expression = "";
  pendingUnary = [];
  displayExpression = "";
  justCalculated = false;
  updateDisplay();
}

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = `<div class="empty-history"><span>∅</span><p>Your solved expressions<br />will land here.</p></div>`;
    return;
  }
  historyList.innerHTML = history.map((item, index) => `
    <div class="history-item" data-index="${index}" title="Use this result">
      <span class="history-expression">${item.expression} =</span>
      <span class="history-value">${item.value}</span>
    </div>
  `).join("");
}

keys.forEach((key) => {
  key.addEventListener("click", () => {
    key.classList.add("pressed");
    window.setTimeout(() => key.classList.remove("pressed"), 120);
    const { action, value } = key.dataset;
    if (action === "clear") clearAll();
    else if (action === "backspace") backspace();
    else if (action === "calculate") calculate();
    else addValue(value);
  });
});

scienceKeys.forEach((key) => {
  key.addEventListener("click", () => {
    key.classList.add("pressed");
    window.setTimeout(() => key.classList.remove("pressed"), 120);
    const { action, function: functionName, value, memory } = key.dataset;
    if (action === "unary") applyUnary(functionName);
    else if (action === "constant") insertConstant(value);
    else if (action === "memory") memoryAction(memory);
    else addValue(value);
  });
});

document.addEventListener("keydown", (event) => {
  const key = event.key;
  const isClearShortcut = key === "Escape" || key.toLowerCase() === "c";
  const matching = [...keys].find((button) => button.dataset.value === key || (key === "Enter" && button.dataset.action === "calculate") || (key === "Backspace" && button.dataset.action === "backspace") || (isClearShortcut && button.dataset.action === "clear"));
  if (!matching && !/[0-9+\-*/.%]/.test(key)) return;
  event.preventDefault();
  if (matching) matching.click();
  else if (key === "*") addValue("×");
  else if (key === "/") addValue("÷");
  else if (key === "-") addValue("−");
  else addValue(key);
});

historyList.addEventListener("click", (event) => {
  const item = event.target.closest(".history-item");
  if (!item) return;
  const selected = history[Number(item.dataset.index)];
  expression = rawNumber(selected.value);
  pendingUnary = [];
  displayExpression = selected.expression;
  justCalculated = false;
  updateDisplay();
});

document.querySelector("#clearHistory").addEventListener("click", () => {
  history = [];
  renderHistory();
});

angleToggle.addEventListener("click", () => {
  angleMode = angleMode === "DEG" ? "RAD" : "DEG";
  angleToggle.textContent = angleMode;
});

document.querySelector("#runDiagnostics").addEventListener("click", runDiagnostics);

document.querySelector("#themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  document.querySelector("#themeToggle").textContent = document.body.classList.contains("light-mode") ? "☼" : "◐";
});

updateDisplay();
