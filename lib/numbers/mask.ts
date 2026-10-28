/**
 * Digit-box masks, the way people search rond.ir: keep the digits that make a
 * number rond, leave the rest blank. "_" is a blank box. For 09121003088 the
 * body is 1003088 and the "zeros" mask is "_00_0__", written 0912-00-0.
 */

export interface MaskCandidate {
  /** 7 chars, digit or "_" */
  mask: string;
  /** Number of fixed boxes */
  fixed: number;
  /** Why this mask was built (Persian, for the UI) */
  reason: string;
}

const isSeq = (s: string) => {
  if (s.length < 3) return false;
  const step = (+s[1] - +s[0] + 10) % 10;
  if (step !== 1 && step !== 9) return false;
  for (let i = 2; i < s.length; i++) if ((+s[i] - +s[i - 1] + 10) % 10 !== step) return false;
  return true;
};

interface Group {
  positions: number[];
  reason: string;
}

function groups(body: string): Group[] {
  const out: Group[] = [];
  const n = body.length;

  // Every digit that repeats, wherever it is (e.g. the three zeros of 1003088).
  const byDigit = new Map<string, number[]>();
  [...body].forEach((d, i) => byDigit.set(d, [...(byDigit.get(d) ?? []), i]));
  for (const [d, pos] of byDigit) {
    if (pos.length >= 2) out.push({ positions: pos, reason: `تکرار رقم ${d}` });
  }

  // Consecutive runs (88, 000) and ascending/descending sequences (4567).
  for (let i = 0; i < n; ) {
    let j = i + 1;
    while (j < n && body[j] === body[i]) j++;
    if (j - i >= 2) out.push({ positions: range(i, j), reason: `${body[i].repeat(j - i)} پشت سر هم` });
    i = j;
  }
  for (let len = n; len >= 3; len--) {
    for (let i = 0; i + len <= n; i++) {
      const seg = body.slice(i, i + len);
      if (isSeq(seg)) out.push({ positions: range(i, i + len), reason: `ترتیبی ${seg}` });
    }
  }

  // Mirror halves (1234321) and repeated blocks (1212, 123123).
  for (let len = 2; len <= 3; len++) {
    for (let i = 0; i + 2 * len <= n; i++) {
      for (let k = i + len; k + len <= n; k++) {
        if (body.slice(i, i + len) === body.slice(k, k + len) && new Set(body.slice(i, i + len)).size > 1) {
          out.push({ positions: [...range(i, i + len), ...range(k, k + len)], reason: `تکرار ${body.slice(i, i + len)}` });
        }
      }
    }
  }
  const half = Math.floor(n / 2);
  if ([...body.slice(0, half)].every((c, i) => c === body[n - 1 - i]) && new Set(body).size > 1) {
    out.push({ positions: range(0, n), reason: "آینه‌ای" });
  }
  return out;
}

const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);

const toMask = (body: string, pos: Iterable<number>) => {
  const set = new Set(pos);
  return [...body].map((c, i) => (set.has(i) ? c : "_")).join("");
};

/** Candidate masks, most specific first. */
export function buildMasks(body: string): MaskCandidate[] {
  const gs = groups(body);
  const seen = new Map<string, MaskCandidate>();
  const add = (pos: number[], reason: string) => {
    const mask = toMask(body, pos);
    const fixed = mask.replace(/_/g, "").length;
    if (fixed < 2 || fixed > 6 || seen.has(mask)) return;
    seen.set(mask, { mask, fixed, reason });
  };

  gs.forEach((g) => add(g.positions, g.reason));
  // Pairs of structures (e.g. the zeros plus the trailing 88).
  for (let a = 0; a < gs.length; a++) {
    for (let b = a + 1; b < gs.length; b++) {
      add([...gs[a].positions, ...gs[b].positions], `${gs[a].reason} + ${gs[b].reason}`);
    }
  }
  // Start/end blocks, as people often search "starts with 100" or "ends with 088".
  for (const len of [3, 4]) {
    const head = body.slice(0, len);
    const tail = body.slice(-len);
    if (/(\d)\1|0/.test(head) || isSeq(head)) add(range(0, len), `شروع با ${head}`);
    if (/(\d)\1|0/.test(tail) || isSeq(tail)) add(range(body.length - len, body.length), `پایان با ${tail}`);
  }

  return [...seen.values()].sort((x, y) => y.fixed - x.fixed);
}

export function matchesMask(body: string, mask: string): boolean {
  for (let i = 0; i < mask.length; i++) if (mask[i] !== "_" && mask[i] !== body[i]) return false;
  return true;
}

/** rond.ir-style notation: 0912 + "_00_0__" -> "0912-00-0" */
export function formatMask(prefix: string, mask: string): string {
  return prefix + mask.replace(/_+$/, "").replace(/_/g, "-");
}

/** SQL LIKE pattern for a full number ("_" is LIKE's single-char wildcard). */
export const likePattern = (prefix: string, mask: string) => prefix + mask;
