/**
 * Pattern ("رند") detectors.
 *
 * The catalogue (keys, Persian labels, priorities) mirrors the 39 algorithms
 * rond.ir exposes in its filter. rond.ir does not publish the rules behind
 * them and listing items carry no label, so each detector below is our own
 * interpretation, checked against sample listings. Detectors marked
 * `heuristic` are the least certain ones; the estimator therefore never relies
 * on labels alone (see estimate.ts).
 */

export interface PatternDef {
  key: string;
  label: string;
  /** rond.ir priority: lower number = more valuable pattern */
  priority: number;
  heuristic?: boolean;
  /** Returns strength 0..1 when matched, 0 otherwise. `s` is the 7-digit body. */
  detect: (s: string, prefix: string) => number;
}

export interface PatternMatch {
  key: string;
  label: string;
  priority: number;
  strength: number;
}

const runAt = (s: string, i: number, len: number) =>
  i + len <= s.length && s.slice(i, i + len) === s[i].repeat(len);

/** All the same digit over [i, i+len) */
function sameRun(len: number, where: "start" | "mid" | "end") {
  return (s: string) => {
    const n = s.length;
    if (where === "start") return runAt(s, 0, len) ? 1 : 0;
    if (where === "end") return runAt(s, n - len, len) ? 1 : 0;
    for (let i = 1; i + len < n; i++) if (runAt(s, i, len)) return 1;
    return 0;
  };
}

const d = (c: string) => c.charCodeAt(0) - 48;

/** Consecutive ascending/descending digits (cyclic 9→0 / 0→9 allowed) */
function sequential(seg: string): boolean {
  if (seg.length < 2) return false;
  const step = (d(seg[1]) - d(seg[0]) + 10) % 10;
  if (step !== 1 && step !== 9) return false;
  for (let i = 1; i < seg.length; i++) {
    if ((d(seg[i]) - d(seg[i - 1]) + 10) % 10 !== step) return false;
  }
  return true;
}

function longestSeqAt(s: string, from: "start" | "end"): number {
  let best = 0;
  for (let len = 3; len <= s.length; len++) {
    const seg = from === "start" ? s.slice(0, len) : s.slice(s.length - len);
    if (sequential(seg)) best = len;
  }
  return best;
}

const isMirror = (seg: string) => seg === [...seg].reverse().join("");

/** x x y y z z with y=x±1, z=y±1 (same direction) */
function stairs(seg: string): boolean {
  if (seg.length !== 6) return false;
  if (!(seg[0] === seg[1] && seg[2] === seg[3] && seg[4] === seg[5])) return false;
  return sequential(seg[0] + seg[2] + seg[4]);
}

/** a a a b b b (+1) */
function tripleStairs(seg: string): boolean {
  return (
    seg.length === 6 &&
    seg.slice(0, 3) === seg[0].repeat(3) &&
    seg.slice(3) === seg[3].repeat(3) &&
    sequential(seg[0] + seg[3])
  );
}

const hasAbab = (seg: string) => /(\d)(\d)\1\2/.test(seg) && /(\d)(?!\1)(\d)\1\2/.test(seg);
const isAbab = (seg: string) => /^(\d)(?!\1)(\d)\1\2$/.test(seg);

const zerosTail = (s: string, z: number) => new RegExp(`[1-9]0{${z}}$`).test(s);
const zerosHead = (s: string, z: number) => new RegExp(`^[1-9]0{${z}}(?!0)`).test(s);

function birthDate(s: string): number {
  const y4 = Number(s.slice(3));
  if (y4 >= 1330 && y4 <= 1410) return 1;
  const yy = Number(s.slice(1, 3));
  const mm = Number(s.slice(3, 5));
  const dd = Number(s.slice(5, 7));
  const yearOk = yy >= 30 || yy <= 10;
  return yearOk && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 ? 0.5 : 0;
}

export const PATTERNS: PatternDef[] = [
  { key: "mirror", label: "آینه‌ای", priority: 1, detect: (s) => (isMirror(s) ? 1 : isMirror(s.slice(1)) || isMirror(s.slice(0, 6)) ? 0.8 : 0) },
  { key: "stairs_start", label: "پله‌ای از اول", priority: 5, detect: (s) => (stairs(s.slice(0, 6)) || tripleStairs(s.slice(0, 6)) ? 1 : 0) },
  { key: "stairs_end", label: "پله‌ای از آخر", priority: 10, detect: (s) => (stairs(s.slice(1)) || tripleStairs(s.slice(1)) ? 1 : 0) },
  { key: "five_same_start", label: "پنج رقم یکی از اول", priority: 15, detect: sameRun(5, "start") },
  { key: "five_same_mid", label: "پنج رقم یکی از وسط", priority: 20, detect: sameRun(5, "mid") },
  { key: "five_same_end", label: "پنج رقم یکی از آخر", priority: 25, detect: sameRun(5, "end") },
  { key: "balance", label: "ترازویی", priority: 30, heuristic: true, detect: (s) => (s[0] === s[6] && s[1] === s[5] && s[2] === s[4] ? 0 : s.slice(0, 3) === s.slice(4) && s[3] !== s[2] ? 0.8 : 0) },
  { key: "birthdate", label: "تاریخ تولدی", priority: 35, heuristic: true, detect: birthDate },
  { key: "seq_start", label: "ترتیبی از اول", priority: 40, detect: (s) => (longestSeqAt(s, "start") >= 4 ? 1 : longestSeqAt(s, "start") === 3 ? 0.5 : 0) },
  { key: "seq_end", label: "ترتیبی از آخر", priority: 45, detect: (s) => (longestSeqAt(s, "end") >= 4 ? 1 : longestSeqAt(s, "end") === 3 ? 0.5 : 0) },
  { key: "repeat_two", label: "تکرار ۲ رقم یکی", priority: 50, detect: (s) => (/(\d\d)\1\1/.test(s) ? 1 : 0) },
  { key: "repeat_prefix", label: "تکرار پیش شماره", priority: 55, heuristic: true, detect: (s, p) => (s.includes(p.slice(1)) ? 1 : s.includes(p.slice(2)) ? 0.4 : 0) },
  { key: "pairs_start", label: "جفت جفت از اول", priority: 60, detect: (s) => (isAbab(s.slice(0, 4)) || /^(\d)\1(?!\1)(\d)\2/.test(s) ? 1 : 0) },
  { key: "pairs_end", label: "جفت جفت از آخر", priority: 65, detect: (s) => (isAbab(s.slice(3)) || /(\d)\1(?!\1)(\d)\2$/.test(s) ? 1 : 0) },
  { key: "pair_edges", label: "جفت اول و آخر", priority: 70, detect: (s) => (s[0] === s[1] && s[5] === s[6] ? 1 : 0) },
  { key: "pairs_sep", label: "جفت جفت مجزا", priority: 75, detect: (s) => (hasAbab(s) || /(\d)\1\d?(\d)\2/.test(s) ? 0.7 : 0) },
  { key: "four_same_start", label: "چهار رقم یکی از اول", priority: 80, detect: sameRun(4, "start") },
  { key: "four_same_mid", label: "چهار رقم یکی از وسط", priority: 85, detect: sameRun(4, "mid") },
  { key: "four_same_end", label: "چهار رقم یکی از آخر", priority: 90, detect: sameRun(4, "end") },
  { key: "lettered", label: "حروفی", priority: 95, heuristic: true, detect: () => 0 },
  { key: "tens_k_start", label: "ده دهی از اول", priority: 100, detect: (s) => (/^[1-9]0[1-9]/.test(s) ? 0.3 : 0) },
  { key: "tens_end", label: "ده دهی از آخر", priority: 105, detect: (s) => (/[1-9]0$/.test(s) && !/00$/.test(s) ? 0.4 : 0) },
  { key: "ten_thousand_start", label: "ده هزاری از اول", priority: 110, detect: (s) => (zerosHead(s, 4) ? 1 : 0) },
  { key: "ten_thousand_end", label: "ده هزاری از آخر", priority: 115, detect: (s) => (zerosTail(s, 4) ? 1 : 0) },
  { key: "three_steps", label: "سه پله", priority: 120, detect: (s) => (/(\d)\1(\d)\2(\d)\3/.test(s) ? 0.8 : 0) },
  { key: "three_pairs_start", label: "سه جفت از اول", priority: 125, detect: (s) => (/^(\d)\1(\d)\2(\d)\3/.test(s) ? 1 : 0) },
  { key: "three_pairs_end", label: "سه جفت از آخر", priority: 130, detect: (s) => (/(\d)\1(\d)\2(\d)\3$/.test(s) ? 1 : 0) },
  { key: "three_pairs_sep", label: "سه جفت مجزا", priority: 135, detect: (s) => ((s.match(/(\d)\1/g) ?? []).length >= 3 ? 0.7 : 0) },
  { key: "three_same_start", label: "سه رقم یکی از اول", priority: 140, detect: sameRun(3, "start") },
  { key: "three_same_mid", label: "سه رقم یکی از وسط", priority: 145, detect: sameRun(3, "mid") },
  { key: "three_same_end", label: "سه رقم یکی از آخر", priority: 150, detect: sameRun(3, "end") },
  { key: "six_same_start", label: "شش رقم یکی از اول", priority: 155, detect: sameRun(6, "start") },
  { key: "six_same_end", label: "شش رقم یکی از آخر", priority: 160, detect: sameRun(6, "end") },
  { key: "hundreds", label: "صد صدی", priority: 165, detect: (s) => (/[1-9]00$/.test(s) && !/000$/.test(s) ? 0.6 : /^[1-9]00(?!0)/.test(s) ? 0.5 : 0) },
  { key: "low_code", label: "کد پایین", priority: 170, heuristic: true, detect: (s) => (/^[0-3]+$/.test(s) ? 0.6 : 0) },
  { key: "spoken", label: "گفتاری", priority: 175, heuristic: true, detect: () => 0 },
  { key: "two_digits", label: "متشکل از دو رقم", priority: 180, detect: (s) => (new Set(s).size === 2 ? 1 : 0) },
  { key: "million", label: "میلیونی", priority: 185, detect: (s) => (zerosHead(s, 6) || /^[1-9]0{6}$/.test(s) ? 1 : 0) },
  { key: "thousand_start", label: "هزاری از اول", priority: 190, detect: (s) => (zerosHead(s, 3) ? 1 : 0) },
  { key: "thousand_end", label: "هزاری از آخر", priority: 195, detect: (s) => (zerosTail(s, 3) ? 1 : 0) },
  { key: "seven_same", label: "هفت رقم یکی", priority: 200, detect: (s) => (new Set(s).size === 1 ? 1 : 0) },
];

export const ORDINARY = { key: "ordinary", label: "معمولی", priority: 205 };

export function detectPatterns(body: string, prefix = "0912"): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const p of PATTERNS) {
    const strength = p.detect(body, prefix);
    if (strength > 0) out.push({ key: p.key, label: p.label, priority: p.priority, strength });
  }
  if (out.length === 0) out.push({ ...ORDINARY, strength: 1 });
  return out.sort((a, b) => a.priority - b.priority);
}

export interface Features {
  maxRun: number;
  distinct: number;
  zeros: number;
  seqEdge: number;
}

export function features(body: string): Features {
  let maxRun = 1;
  let cur = 1;
  for (let i = 1; i < body.length; i++) {
    cur = body[i] === body[i - 1] ? cur + 1 : 1;
    if (cur > maxRun) maxRun = cur;
  }
  return {
    maxRun,
    distinct: new Set(body).size,
    zeros: (body.match(/0/g) ?? []).length,
    seqEdge: Math.max(longestSeqAt(body, "start"), longestSeqAt(body, "end")),
  };
}
