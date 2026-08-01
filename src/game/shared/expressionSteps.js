// ── Expression → steps ─────────────────────────────────────────
// Turns a submitted infix expression string (e.g. "(4+5)*2") back into the
// ordered step list the result cards render — the same long, color-coded
// "4 + 5 = 9 / 9 × 2 = 18" style the single-player game and the solver use.
//
// Purely for display: the backend already validated the answer. Operators are
// emitted in the display alphabet (− × ÷) so the shared step renderer colours
// them like everything else.

const OPS = new Set(["+", "-", "*", "/"]);
const ALIAS = { "−": "-", "×": "*", "÷": "/", x: "*", X: "*" };
const DISPLAY_OP = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const PREC = { "+": 1, "-": 1, "*": 2, "/": 2 };

function tokenize(expr) {
  const s = String(expr);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t") {
      i += 1;
      continue;
    }
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < s.length && s[j] >= "0" && s[j] <= "9") j += 1;
      tokens.push(s.slice(i, j));
      i = j;
      continue;
    }
    const n = ALIAS[c] || c;
    if (OPS.has(n) || n === "(" || n === ")") {
      tokens.push(n);
      i += 1;
      continue;
    }
    throw new Error(`unexpected character ${c}`);
  }
  return tokens;
}

function toRpn(tokens) {
  const out = [];
  const stack = [];
  for (const tk of tokens) {
    if (/^\d+$/.test(tk)) {
      out.push(tk);
    } else if (OPS.has(tk)) {
      while (stack.length && OPS.has(stack[stack.length - 1]) && PREC[stack[stack.length - 1]] >= PREC[tk]) {
        out.push(stack.pop());
      }
      stack.push(tk);
    } else if (tk === "(") {
      stack.push(tk);
    } else if (tk === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") out.push(stack.pop());
      if (!stack.length) throw new Error("unbalanced parentheses");
      stack.pop();
    }
  }
  while (stack.length) {
    const op = stack.pop();
    if (op === "(") throw new Error("unbalanced parentheses");
    out.push(op);
  }
  return out;
}

function evalRpn(rpn) {
  const stack = [];
  const steps = [];
  for (const tk of rpn) {
    if (/^\d+$/.test(tk)) {
      stack.push(parseInt(tk, 10));
      continue;
    }
    if (stack.length < 2) throw new Error("malformed expression");
    const b = stack.pop();
    const a = stack.pop();
    let result;
    if (tk === "+") result = a + b;
    else if (tk === "-") result = a - b;
    else if (tk === "*") result = a * b;
    else result = b !== 0 ? Math.trunc(a / b) : 0;
    steps.push({ a, op: DISPLAY_OP[tk], b, result });
    stack.push(result);
  }
  if (stack.length !== 1) throw new Error("malformed expression");
  return { steps, value: stack[0] };
}

// Returns { steps, value } or null if the expression can't be parsed.
export function expressionToSteps(expr) {
  try {
    return evalRpn(toRpn(tokenize(expr)));
  } catch {
    return null;
  }
}
