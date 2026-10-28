"use client";
import { Button, Card, Chip, Input, Label, Skeleton, TextField } from "@heroui/react";
import { Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Estimate } from "@/lib/numbers/estimate";

const fmt = new Intl.NumberFormat("fa-IR");
const CONF = { high: ["اطمینان بالا", "success"], medium: ["اطمینان متوسط", "warning"], low: ["اطمینان کم", "danger"] } as const;

export function Estimator() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Estimate | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/estimate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ number: value }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setResult(null);
      return setError(data.error ?? "خطا در محاسبه");
    }
    setResult(data);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-2 sm:p-4">
        <Card.Content>
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextField className="flex-1" name="number" isInvalid={!!error}>
              <Label>شماره موبایل</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                placeholder="09121234567"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="digits text-lg tracking-widest"
              />
            </TextField>
            <Button type="submit" isPending={busy} size="lg" className="sm:w-48">
              <Search size={18} /> برآورد قیمت
            </Button>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Card.Content>
      </Card>

      {busy && <Skeleton className="h-48 w-full rounded-3xl" />}
      {!busy && result && <Result r={result} />}
    </div>
  );
}

function Result({ r }: { r: Estimate }) {
  const [label, color] = CONF[r.confidence];
  return (
    <Card className="overflow-hidden p-2 sm:p-4">
      <Card.Header className="flex-row items-center justify-between gap-2">
        <Card.Title className="digits text-xl sm:text-2xl">{r.number}</Card.Title>
        <Chip color={color} variant="soft">{label}</Chip>
      </Card.Header>
      <Card.Content className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          {r.patterns.map((p) => (
            <Chip key={p.key} variant="secondary"><Sparkles size={12} /> {p.label}</Chip>
          ))}
        </div>

        {r.price ? (
          <div className="rounded-2xl bg-accent/10 p-5">
            <p className="text-sm text-muted">قیمت تقریبی</p>
            <p className="mt-1 text-3xl font-extrabold sm:text-4xl">
              {fmt.format(r.price.mid)} <span className="text-base font-medium text-muted">تومان</span>
            </p>
            {r.price.low !== r.price.high && (
              <p className="mt-2 text-sm text-muted">
                بازه محتمل: {fmt.format(r.price.low)} تا {fmt.format(r.price.high)} تومان
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-2xl bg-default p-5 text-sm">آگهی مشابهی برای برآورد پیدا نشد.</p>
        )}

        {r.search && (
          <div className="flex flex-col gap-2 rounded-2xl border border-separator p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted">جستجوی معادل در rond.ir</span>
              <Link
                href={`/search?prefix=${r.prefix}&mask=${r.search.mask}`}
                className="digits rounded-lg bg-default px-3 py-1 text-lg font-bold tracking-wider hover:bg-accent/15"
              >
                {r.search.display}
              </Link>
            </div>
            <p className="text-xs text-muted">
              {r.search.reason} — {fmt.format(r.search.count)} آگهی قیمت‌دار با همین الگو
            </p>
            {r.alternatives.length > 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {r.alternatives
                  .filter((a) => a.mask !== r.search!.mask)
                  .map((a) => (
                    <Link
                      key={a.mask}
                      href={`/search?prefix=${r.prefix}&mask=${a.mask}`}
                      className="digits rounded-full border border-separator px-2.5 py-0.5 text-xs hover:border-accent"
                      title={a.reason}
                    >
                      {a.display} · {fmt.format(a.count)}
                    </Link>
                  ))}
              </div>
            )}
          </div>
        )}

        {!r.search && r.alternatives.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-separator p-4">
            <span className="text-sm text-muted">جستجوهای پیشنهادی (آگهی کافی برای قیمت‌گذاری با الگو نبود)</span>
            <div className="flex flex-wrap gap-1.5">
              {r.alternatives.map((a) => (
                <Link
                  key={a.mask}
                  href={`/search?prefix=${r.prefix}&mask=${a.mask}`}
                  className="digits rounded-full border border-separator px-2.5 py-0.5 text-xs hover:border-accent"
                  title={a.reason}
                >
                  {a.display} · {fmt.format(a.count)}
                </Link>
              ))}
            </div>
          </div>
        )}

        {r.neighbors.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">{r.method === "mask" ? "آگهی‌های همین الگو" : r.method === "rond" ? "مشابه‌ترین شماره‌ها در rond.ir" : "نزدیک‌ترین آگهی‌ها"}</h3>
            <ul className="divide-y divide-separator rounded-2xl border border-separator">
              {r.neighbors.slice(0, r.method === "rond" ? 10 : 5).map((n) => (
                <li key={n.number} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="digits font-medium">{n.number}</span>
                  <span className="text-muted">
                    {r.method === "rond" && `${fmt.format(Math.round(n.similarity * 100))}٪ شباهت · `}
                    {n.patterns.slice(0, 2).join("، ")}
                  </span>
                  <span>{fmt.format(n.price)} تومان</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {r.method !== "rond" && r.pricedListings < 1000 && (
          <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs">
            فقط {fmt.format(r.pricedListings)} آگهی در دیتابیس است؛ برای قیمت دقیق داده‌های rond.ir را جمع کنید (npm run rond:collect).
          </p>
        )}
        <p className="text-xs text-muted">
          بر اساس {fmt.format(r.pricedListings)} آگهی قیمت‌دار{r.method === "rond" && " که همین حالا در rond.ir پیدا شد"}. قیمت‌ها قیمت درخواستی فروشنده‌ها هستند و قیمت قطعی معامله نیستند.
        </p>
      </Card.Content>
    </Card>
  );
}
