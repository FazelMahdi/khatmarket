const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";

export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (c) => {
    const i = FA.indexOf(c);
    return String(i >= 0 ? i : AR.indexOf(c));
  });
}

export interface ParsedNumber {
  /** Canonical 11-digit form: 09xxxxxxxxx */
  full: string;
  /** Operator pre-code, e.g. 0912 */
  prefix: string;
  /** Last 7 digits */
  body: string;
}

/** Returns null when the input is not a valid Iranian mobile number. */
export function parseMobile(input: string): ParsedNumber | null {
  let d = toLatinDigits(input).replace(/[\s\-().+]/g, "");
  if (d.startsWith("0098")) d = d.slice(4);
  else if (d.startsWith("98") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith("9")) d = "0" + d;
  if (!/^09\d{9}$/.test(d)) return null;
  return { full: d, prefix: d.slice(0, 4), body: d.slice(4) };
}

export function formatMobile(full: string): string {
  return `${full.slice(0, 4)} ${full.slice(4, 7)} ${full.slice(7)}`;
}
