"use client";
import { Button, Card, Chip, Skeleton } from "@heroui/react";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MCI_PRECODES } from "@/lib/numbers/algorithms";
import { formatMask } from "@/lib/numbers/mask";

const fmt = new Intl.NumberFormat("fa-IR");
const STATUS: Record<string, string> = { LIKE_NEW: "در حد نو", USED: "کارکرده", BRAND_NEW_WITH_NAME: "صفر" };

interface Result {
  total: number;
  priced: number;
  median: number | null;
  items: { number: string; price: number | null; status: string | null; patterns: string[] }[];
}

export function DigitSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [prefix, setPrefix] = useState(params.get("prefix") ?? "0912");
  const [boxes, setBoxes] = useState<string[]>(() => {
    const m = (params.get("mask") ?? "").padEnd(7, "_").slice(0, 7);
    return [...m].map((c) => (c === "_" ? "" : c));
  });
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(() => !!params.get("mask"));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const mask = boxes.map((b) => b || "_").join("");

  const load = useCallback(async (pre: string, m: string) => {
    const res = await fetch(`/api/search?prefix=${pre}&mask=${m}`);
    setResult(res.ok ? await res.json() : null);
    setBusy(false);
  }, []);

  const run = (pre: string, m: string) => {
    setBusy(true);
    load(pre, m);
  };

  useEffect(() => {
    // A shared link (/search?prefix=..&mask=..) runs its search once on open.
    if (!params.get("mask")) return;
    fetch(`/api/search?prefix=${prefix}&mask=${mask}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setResult(data);
        setBusy(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.replace(`/search?prefix=${prefix}&mask=${mask}`);
    run(prefix, mask);
  };

  const setBox = (i: number, v: string) => {
    const d = v.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/\D/g, "").slice(-1);
    setBoxes((b) => b.map((x, j) => (j === i ? d : x)));
    if (d && i < 6) refs.current[i + 1]?.focus();
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-2 sm:p-4">
        <Card.Content>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">شماره</span>
              <div dir="ltr" className="flex items-center gap-1.5 sm:gap-2">
                <select
                  aria-label="پیش‌شماره"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="digits h-12 rounded-xl border border-separator bg-surface px-2 text-base font-semibold"
                >
                  {MCI_PRECODES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                {boxes.map((b, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    aria-label={`رقم ${i + 1}`}
                    inputMode="numeric"
                    value={b}
                    onChange={(e) => setBox(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !b && i > 0) refs.current[i - 1]?.focus();
                    }}
                    className="digits h-12 w-full min-w-0 rounded-xl border border-separator bg-surface text-center text-lg font-bold outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  />
                ))}
              </div>
              <p className="text-xs text-muted">خانه‌های خالی یعنی «هر رقمی». مثلاً برای 09121003088 جستجوی 0912-00-0 یعنی _00_0__.</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" isPending={busy} className="flex-1 sm:flex-none sm:px-10">
                <Search size={18} /> جستجو
              </Button>
              <Button type="button" variant="ghost" onPress={() => setBoxes(Array(7).fill(""))}>
                <X size={16} /> پاک کردن
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      {busy && <Skeleton className="h-40 w-full rounded-3xl" />}
      {!busy && result && (
        <Card className="p-2 sm:p-4">
          <Card.Header className="flex-row flex-wrap items-center justify-between gap-2">
            <Card.Title className="digits">{formatMask(prefix, mask)}</Card.Title>
            <div className="flex flex-wrap gap-2">
              <Chip variant="secondary">{fmt.format(result.total)} آگهی</Chip>
              {result.median != null && <Chip variant="soft" color="accent">میانه {fmt.format(result.median)} تومان</Chip>}
            </div>
          </Card.Header>
          <Card.Content>
            {result.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">آگهی‌ای با این الگو پیدا نشد.</p>
            ) : (
              <ul className="divide-y divide-separator">
                {result.items.map((it) => (
                  <li key={it.number} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span className="digits font-semibold">{it.number}</span>
                    <span className="text-muted">{it.patterns.join("، ")}</span>
                    <span className="text-muted">{it.status ? (STATUS[it.status] ?? it.status) : ""}</span>
                    <span>{it.price ? `${fmt.format(it.price)} تومان` : "توافقی"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
