import type { TableCell } from "@/types/canvas";

// The formulas of table cells: a small spreadsheet language, parsed and
// evaluated here (never with eval). Cell references are A1 style (column
// letters, row number from 1); ranges are A1:B3.
//
// Operators: + - * / ^ & (text), comparisons = <> < > <= >=, a trailing %
// and parentheses. Functions: SUM AVERAGE (AVG) MIN MAX COUNT COUNTA
// COUNTBLANK PRODUCT MEDIAN ABS SQRT INT ROUND ROUNDUP ROUNDDOWN POWER MOD
// PI IF IFERROR AND OR NOT CONCAT (CONCATENATE) LEN UPPER LOWER TRIM LEFT
// RIGHT SUMIF COUNTIF.

export type FormulaError = { error: string };
export type Value = number | string | boolean | FormulaError;

export const isFormulaError = (value: Value): value is FormulaError =>
  typeof value === "object";

const error = (code: string): FormulaError => ({ error: code });

/** Thrown inside the evaluator to carry an error value up to the cell. */
class Failure {
  constructor(readonly value: FormulaError) {}
}

const fail = (code: string): never => {
  throw new Failure(error(code));
};

// ---- Cell references

/** "A" is 0, "Z" 25, "AA" 26. */
export const colName = (index: number) => {
  let name = "";
  let n = index + 1;

  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }

  return name;
};

const colIndex = (letters: string) => {
  let n = 0;

  for (const char of letters.toUpperCase()) {
    n = n * 26 + (char.charCodeAt(0) - 64);
  }

  return n - 1;
};

const REF = /^\$?([A-Za-z]{1,3})\$?(\d{1,5})$/;

/** "B3" → { r: 2, c: 1 }, or null when it isn't a cell reference. */
export const parseRef = (text: string) => {
  const match = REF.exec(text);
  if (!match) return null;

  const r = Number(match[2]) - 1;
  return r < 0 ? null : { r, c: colIndex(match[1]) };
};

export const refName = (r: number, c: number) => `${colName(c)}${r + 1}`;

// ---- Numbers in text

/** A number typed in a cell: "12", "-3.5", "1,200", "$4.50", "20%". */
export const parseNumber = (text: string): number | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const match =
    /^([-+]?)\$?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%?)$|^([-+]?)\$?(\.\d+)(%?)$/.exec(
      trimmed
    );
  if (!match) return null;

  const sign = (match[1] ?? match[5]) === "-" ? -1 : 1;
  const digits = match[2] ? match[2].replace(/,/g, "") + (match[3] ?? "") : match[6];
  const percent = (match[4] ?? match[7]) === "%";
  const number = Number(digits);

  return Number.isFinite(number) ? sign * (percent ? number / 100 : number) : null;
};

// ---- Tokens

type Token = { k: "num" | "str" | "id" | "op"; s: string; n?: number };

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      i++;
    } else if (/[0-9.]/.test(char)) {
      const match = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(source.slice(i));
      if (!match) return fail("#ERROR!");
      tokens.push({ k: "num", s: match[0], n: Number(match[0]) });
      i += match[0].length;
    } else if (char === '"') {
      let text = "";
      i++;

      while (i < source.length && !(source[i] === '"' && source[i + 1] !== '"')) {
        if (source[i] === '"') i++;
        text += source[i];
        i++;
      }

      if (source[i] !== '"') return fail("#ERROR!");
      i++;
      tokens.push({ k: "str", s: text });
    } else if (/[A-Za-z_$]/.test(char)) {
      const match = /^[A-Za-z_$][A-Za-z0-9_$.]*/.exec(source.slice(i))!;
      tokens.push({ k: "id", s: match[0] });
      i += match[0].length;
    } else {
      const two = source.slice(i, i + 2);
      if (two === "<=" || two === ">=" || two === "<>") {
        tokens.push({ k: "op", s: two });
        i += 2;
      } else if ("+-*/^&=<>(),:%".includes(char)) {
        tokens.push({ k: "op", s: char });
        i++;
      } else {
        return fail("#ERROR!");
      }
    }
  }

  return tokens;
};

// ---- Syntax tree

type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ref"; r: number; c: number }
  | { t: "range"; r1: number; c1: number; r2: number; c2: number }
  | { t: "neg"; a: Node }
  | { t: "pct"; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "fn"; name: string; args: Node[] };

const parse = (source: string): Node => {
  const tokens = tokenize(source);
  let pos = 0;

  const peek = () => tokens[pos];
  const isOp = (s: string) => peek()?.k === "op" && peek().s === s;
  const take = () => tokens[pos++];
  const expect = (s: string) => {
    if (!isOp(s)) fail("#ERROR!");
    pos++;
  };

  const primary = (): Node => {
    const token = take();
    if (!token) return fail("#ERROR!");

    if (token.k === "num") return { t: "num", v: token.n! };
    if (token.k === "str") return { t: "str", v: token.s };

    if (token.k === "op" && token.s === "(") {
      const inner = comparison();
      expect(")");
      return inner;
    }

    if (token.k === "id") {
      const upper = token.s.toUpperCase();

      if (isOp("(")) {
        pos++;
        const args: Node[] = [];

        if (!isOp(")")) {
          do {
            args.push(comparison());
          } while (isOp(",") && pos++ >= 0);
        }

        expect(")");
        return { t: "fn", name: upper, args };
      }

      if (upper === "TRUE" || upper === "FALSE") {
        return { t: "bool", v: upper === "TRUE" };
      }

      const ref = parseRef(token.s);
      if (!ref) return fail("#NAME?");

      if (isOp(":")) {
        pos++;
        const next = take();
        const end = next?.k === "id" ? parseRef(next.s) : null;
        if (!end) return fail("#ERROR!");

        return {
          t: "range",
          r1: Math.min(ref.r, end.r),
          c1: Math.min(ref.c, end.c),
          r2: Math.max(ref.r, end.r),
          c2: Math.max(ref.c, end.c),
        };
      }

      return { t: "ref", r: ref.r, c: ref.c };
    }

    return fail("#ERROR!");
  };

  const unary = (): Node => {
    if (isOp("-")) {
      pos++;
      return { t: "neg", a: unary() };
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }

    let node = primary();
    while (isOp("%")) {
      pos++;
      node = { t: "pct", a: node };
    }
    return node;
  };

  const power = (): Node => {
    const base = unary();

    if (isOp("^")) {
      pos++;
      return { t: "bin", op: "^", a: base, b: power() };
    }

    return base;
  };

  const binary = (next: () => Node, ops: string[]) => (): Node => {
    let node = next();

    while (peek()?.k === "op" && ops.includes(peek().s)) {
      const op = take().s;
      node = { t: "bin", op, a: node, b: next() };
    }

    return node;
  };

  const product = binary(power, ["*", "/"]);
  const sum = binary(product, ["+", "-"]);
  const concat = binary(sum, ["&"]);
  const comparison = binary(concat, ["=", "<>", "<", ">", "<=", ">="]);

  const tree = comparison();
  if (pos < tokens.length) fail("#ERROR!");
  return tree;
};

// ---- Evaluation

const toNumber = (value: Value): number => {
  if (isFormulaError(value)) throw new Failure(value);
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === "") return 0;

  const parsed = parseNumber(value);
  return parsed === null ? fail("#VALUE!") : parsed;
};

const toText = (value: Value): string => {
  if (isFormulaError(value)) throw new Failure(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(Number(value.toPrecision(12)));
  return value;
};

const toBool = (value: Value): boolean => {
  if (isFormulaError(value)) throw new Failure(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (value.toUpperCase() === "TRUE") return true;
  if (value.toUpperCase() === "FALSE" || value === "") return false;
  return toNumber(value) !== 0;
};

/** Numbers before text before booleans, like a spreadsheet. */
const compare = (a: Value, b: Value): number => {
  if (isFormulaError(a)) throw new Failure(a);
  if (isFormulaError(b)) throw new Failure(b);

  const rank = (v: number | string | boolean) =>
    typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2;
  const left = a === "" ? 0 : a;
  const right = b === "" ? 0 : b;

  if (rank(left) !== rank(right)) return rank(left) - rank(right);
  if (typeof left === "number") return left - (right as number);
  if (typeof left === "string") {
    return left.toLowerCase().localeCompare((right as string).toLowerCase());
  }
  return Number(left) - Number(right);
};

/** Whether a value meets a SUMIF / COUNTIF condition ("5", ">3", "<>x"). */
const meets = (value: Value, criterion: Value): boolean => {
  if (isFormulaError(value)) return false;

  const text = typeof criterion === "string" ? criterion : toText(criterion);
  const match = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(text)!;
  const op = match[1] ?? "=";
  const operandText = match[2];
  const asNumber = parseNumber(operandText);
  const valueNumber =
    typeof value === "number" ? value : typeof value === "string" ? parseNumber(value) : null;

  let order: number;
  if (asNumber !== null && valueNumber !== null) {
    order = valueNumber - asNumber;
  } else {
    order = toText(value).toLowerCase().localeCompare(operandText.toLowerCase());
  }

  switch (op) {
    case "=":
      return order === 0;
    case "<>":
      return order !== 0;
    case "<":
      return order < 0;
    case ">":
      return order > 0;
    case "<=":
      return order <= 0;
    default:
      return order >= 0;
  }
};

const MAX_ROUND_DIGITS = 15;

/**
 * Returns the value of the cell at (r, c). Each cell is worked out once;
 * a cell that depends on itself gives #CIRC!.
 */
export const createEvaluator = (
  cells: Record<string, TableCell>,
  rows: number,
  cols: number
) => {
  const cache = new Map<string, Value>();
  const working = new Set<string>();

  const valueAt = (r: number, c: number): Value => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return error("#REF!");

    const key = `${r},${c}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const raw = cells[key]?.v ?? "";
    let result: Value;

    if (raw.startsWith("=") && raw.length > 1) {
      if (working.has(key)) return error("#CIRC!");
      working.add(key);

      try {
        result = evaluate(parse(raw.slice(1)));
      } catch (failure) {
        if (failure instanceof Failure) result = failure.value;
        else if (failure instanceof RangeError) result = error("#ERROR!");
        else throw failure;
      }

      working.delete(key);
    } else {
      const number = raw ? parseNumber(raw) : null;
      result = number === null ? raw : number;
    }

    cache.set(key, result);
    return result;
  };

  /** The values of a range, row by row. */
  const rangeValues = (n: Extract<Node, { t: "range" }>) => {
    const out: Value[] = [];

    for (let r = n.r1; r <= n.r2; r++) {
      for (let c = n.c1; c <= n.c2; c++) out.push(valueAt(r, c));
    }

    return out;
  };

  /**
   * The numbers an aggregate function works on: those in ranges (text and
   * blanks are skipped, errors are passed on) and the arguments written in
   * directly (which must be numbers).
   */
  const numbersOf = (args: Node[]) => {
    const numbers: number[] = [];

    for (const arg of args) {
      if (arg.t === "range") {
        for (const v of rangeValues(arg)) {
          if (isFormulaError(v)) throw new Failure(v);
          if (typeof v === "number") numbers.push(v);
        }
      } else {
        numbers.push(toNumber(evaluate(arg)));
      }
    }

    return numbers;
  };

  const flatValues = (args: Node[]) =>
    args.flatMap((arg) => (arg.t === "range" ? rangeValues(arg) : [evaluate(arg)]));

  const round = (value: number, digits: number, mode: "round" | "up" | "down") => {
    const d = Math.max(-MAX_ROUND_DIGITS, Math.min(MAX_ROUND_DIGITS, Math.trunc(digits)));
    const factor = 10 ** d;
    const scaled = Math.abs(value) * factor;
    const eps = 1e-9;
    const rounded =
      mode === "round"
        ? Math.round(scaled + eps)
        : mode === "up"
          ? Math.ceil(scaled - eps)
          : Math.floor(scaled + eps);

    return (Math.sign(value) * rounded) / factor;
  };

  const arity = (args: Node[], min: number, max = min) => {
    if (args.length < min || args.length > max) fail("#ERROR!");
  };

  const call = (name: string, args: Node[]): Value => {
    switch (name) {
      case "SUM":
        return numbersOf(args).reduce((a, b) => a + b, 0);
      case "AVERAGE":
      case "AVG": {
        const numbers = numbersOf(args);
        return numbers.length
          ? numbers.reduce((a, b) => a + b, 0) / numbers.length
          : fail("#DIV/0!");
      }
      case "MIN": {
        const numbers = numbersOf(args);
        return numbers.length ? Math.min(...numbers) : 0;
      }
      case "MAX": {
        const numbers = numbersOf(args);
        return numbers.length ? Math.max(...numbers) : 0;
      }
      case "PRODUCT": {
        const numbers = numbersOf(args);
        return numbers.length ? numbers.reduce((a, b) => a * b, 1) : 0;
      }
      case "MEDIAN": {
        const numbers = numbersOf(args).sort((a, b) => a - b);
        if (!numbers.length) return fail("#NUM!");
        const mid = Math.floor(numbers.length / 2);
        return numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
      }
      case "COUNT":
        return flatValues(args).filter((v) => typeof v === "number").length;
      case "COUNTA":
        return flatValues(args).filter((v) => v !== "").length;
      case "COUNTBLANK":
        return flatValues(args).filter((v) => v === "").length;
      case "ABS":
        arity(args, 1);
        return Math.abs(toNumber(evaluate(args[0])));
      case "SQRT": {
        arity(args, 1);
        const n = toNumber(evaluate(args[0]));
        return n < 0 ? fail("#NUM!") : Math.sqrt(n);
      }
      case "INT":
        arity(args, 1);
        return Math.floor(toNumber(evaluate(args[0])));
      case "ROUND":
      case "ROUNDUP":
      case "ROUNDDOWN": {
        arity(args, 1, 2);
        const mode = name === "ROUND" ? "round" : name === "ROUNDUP" ? "up" : "down";
        return round(
          toNumber(evaluate(args[0])),
          args[1] ? toNumber(evaluate(args[1])) : 0,
          mode
        );
      }
      case "POWER": {
        arity(args, 2);
        const result = toNumber(evaluate(args[0])) ** toNumber(evaluate(args[1]));
        return Number.isFinite(result) ? result : fail("#NUM!");
      }
      case "MOD": {
        arity(args, 2);
        const a = toNumber(evaluate(args[0]));
        const b = toNumber(evaluate(args[1]));
        return b === 0 ? fail("#DIV/0!") : a - b * Math.floor(a / b);
      }
      case "PI":
        arity(args, 0);
        return Math.PI;
      case "IF":
        arity(args, 2, 3);
        return toBool(evaluate(args[0]))
          ? evaluate(args[1])
          : args[2]
            ? evaluate(args[2])
            : false;
      case "IFERROR":
        arity(args, 2);
        try {
          const first = evaluate(args[0]);
          return isFormulaError(first) ? evaluate(args[1]) : first;
        } catch (failure) {
          if (failure instanceof Failure) return evaluate(args[1]);
          throw failure;
        }
      case "AND":
        return flatValues(args).every((v) => v === "" || toBool(v));
      case "OR":
        return flatValues(args).some((v) => v !== "" && toBool(v));
      case "NOT":
        arity(args, 1);
        return !toBool(evaluate(args[0]));
      case "CONCAT":
      case "CONCATENATE":
        return flatValues(args).map(toText).join("");
      case "LEN":
        arity(args, 1);
        return toText(evaluate(args[0])).length;
      case "UPPER":
        arity(args, 1);
        return toText(evaluate(args[0])).toUpperCase();
      case "LOWER":
        arity(args, 1);
        return toText(evaluate(args[0])).toLowerCase();
      case "TRIM":
        arity(args, 1);
        return toText(evaluate(args[0])).trim().replace(/\s+/g, " ");
      case "LEFT":
      case "RIGHT": {
        arity(args, 1, 2);
        const text = toText(evaluate(args[0]));
        const n = Math.max(0, Math.trunc(args[1] ? toNumber(evaluate(args[1])) : 1));
        return name === "LEFT" ? text.slice(0, n) : n === 0 ? "" : text.slice(-n);
      }
      case "SUMIF":
      case "COUNTIF": {
        arity(args, 2, name === "SUMIF" ? 3 : 2);
        const [range, criterionNode, sumNode] = args;
        if (range.t !== "range") return fail("#VALUE!");
        const criterion = evaluate(criterionNode);
        const values = rangeValues(range);
        const sums =
          name === "SUMIF" && sumNode?.t === "range"
            ? rangeValues({
                ...sumNode,
                r2: sumNode.r1 + (range.r2 - range.r1),
                c2: sumNode.c1 + (range.c2 - range.c1),
              })
            : values;
        let total = 0;

        values.forEach((value, index) => {
          if (!meets(value, criterion)) return;
          if (name === "COUNTIF") total += 1;
          else if (typeof sums[index] === "number") total += sums[index] as number;
        });

        return total;
      }
      default:
        return fail("#NAME?");
    }
  };

  const evaluate = (node: Node): Value => {
    switch (node.t) {
      case "num":
      case "str":
      case "bool":
        return node.v;
      case "ref":
        return valueAt(node.r, node.c);
      case "range":
        return fail("#VALUE!");
      case "neg":
        return -toNumber(evaluate(node.a));
      case "pct":
        return toNumber(evaluate(node.a)) / 100;
      case "fn":
        return call(node.name, node.args);
      case "bin": {
        const a = evaluate(node.a);
        const b = evaluate(node.b);

        switch (node.op) {
          case "+":
            return toNumber(a) + toNumber(b);
          case "-":
            return toNumber(a) - toNumber(b);
          case "*":
            return toNumber(a) * toNumber(b);
          case "/": {
            const divisor = toNumber(b);
            return divisor === 0 ? fail("#DIV/0!") : toNumber(a) / divisor;
          }
          case "^": {
            const result = toNumber(a) ** toNumber(b);
            return Number.isFinite(result) ? result : fail("#NUM!");
          }
          case "&":
            return toText(a) + toText(b);
          case "=":
            return compare(a, b) === 0;
          case "<>":
            return compare(a, b) !== 0;
          case "<":
            return compare(a, b) < 0;
          case ">":
            return compare(a, b) > 0;
          case "<=":
            return compare(a, b) <= 0;
          default:
            return compare(a, b) >= 0;
        }
      }
    }
  };

  return valueAt;
};

// ---- Moving references when rows or columns are inserted or deleted

/**
 * Rewrites the cell references of a formula for a row or column change:
 * those at or after `at` move by `delta` (insert: +count), and with
 * `removed` set, references into the deleted span become #REF!.
 */
export const shiftFormula = (
  formula: string,
  axis: "row" | "col",
  at: number,
  delta: number,
  removed = 0
) => {
  if (!formula.startsWith("=")) return formula;

  // Leave text in quotes alone.
  return formula
    .split(/("(?:[^"]|"")*")/)
    .map((part, index) => {
      if (index % 2 === 1) return part;

      return part.replace(
        /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,5})(?![\d(A-Za-z_])/g,
        (whole, d1: string, letters: string, d2: string, digits: string) => {
          if (!parseRef(`${letters}${digits}`)) return whole;

          let r = Number(digits) - 1;
          let c = colIndex(letters);
          const value = axis === "row" ? r : c;

          if (removed > 0 && value >= at && value < at + removed) return "#REF!";
          if (value >= at + Math.max(removed, 0)) {
            if (axis === "row") r += delta;
            else c += delta;
          }

          return `${d1}${colName(c)}${d2}${r + 1}`;
        }
      );
    })
    .join("");
};
