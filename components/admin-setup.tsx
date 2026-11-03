"use client";
import { Button, Card, Chip, Input, Label, TextArea, TextField } from "@heroui/react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type Check = { ok: boolean; title: string; detail: string };
type Described = Record<string, { set: boolean; preview: string; fromEnv: boolean }>;

/** Health checks + editable settings (AvalAI key/models, rond.ir cookie). */
export function AdminSetup() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [settings, setSettings] = useState<Described | null>(null);
  const [form, setForm] = useState({ AVALAI_API_KEY: "", AVALAI_MODELS: "", ROND_COOKIE: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  const runChecks = async () => {
    setChecking(true);
    const res = await fetch("/api/admin/status");
    setChecks(res.ok ? (await res.json()).checks : [{ ok: false, title: "خطا", detail: `HTTP ${res.status}` }]);
    setChecking(false);
  };

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Described | null) => {
        setSettings(d);
        if (d) setForm((f) => ({ ...f, AVALAI_MODELS: d.AVALAI_MODELS.preview }));
      });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved("");
    // Empty secret fields mean "keep the current value".
    const body: Record<string, string> = { AVALAI_MODELS: form.AVALAI_MODELS };
    if (form.AVALAI_API_KEY.trim()) body.AVALAI_API_KEY = form.AVALAI_API_KEY;
    if (form.ROND_COOKIE.trim()) body.ROND_COOKIE = form.ROND_COOKIE;
    const res = await fetch("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) return setSaved("ذخیره نشد");
    setSettings(await res.json());
    setForm((f) => ({ ...f, AVALAI_API_KEY: "", ROND_COOKIE: "" }));
    setSaved("ذخیره شد");
    runChecks();
  };

  const state = (key: string) => {
    const s = settings?.[key];
    if (!s?.set) return <Chip size="sm" variant="soft" color="danger">تنظیم نشده</Chip>;
    return (
      <Chip size="sm" variant="soft" color="success">
        تنظیم شده {s.preview && <span className="digits">{s.preview}</span>} {s.fromEnv && "(از .env)"}
      </Chip>
    );
  };

  return (
    <>
      <Card>
        <Card.Header className="flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <Card.Title>وضعیت</Card.Title>
            <Card.Description>چرا قیمت نمی‌آید؟ این‌جا معلوم می‌شود.</Card.Description>
          </div>
          <Button size="sm" onPress={runChecks} isPending={checking}>
            <RefreshCw size={14} /> بررسی وضعیت
          </Button>
        </Card.Header>
        <Card.Content>
          {!checks ? (
            <p className="text-sm text-muted">دکمهٔ «بررسی وضعیت» را بزنید.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {checks.map((c) => (
                <li key={c.title} className="flex gap-3 text-sm">
                  {c.ok ? <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} /> : <XCircle className="mt-0.5 shrink-0 text-danger" size={18} />}
                  <div>
                    <p className="font-semibold">{c.title}</p>
                    <p className="leading-7 text-muted">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>تنظیمات</Card.Title>
          <Card.Description>این مقادیر در دیتابیس ذخیره می‌شوند و بر .env مقدم‌اند. خالی گذاشتن کلید یا کوکی یعنی مقدار فعلی بماند.</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">کلید AvalAI</span>
              {state("AVALAI_API_KEY")}
            </div>
            <TextField type="password" aria-label="کلید AvalAI" value={form.AVALAI_API_KEY} onChange={(v) => setForm({ ...form, AVALAI_API_KEY: v })}>
              <Input dir="ltr" placeholder="aa-..." autoComplete="off" />
            </TextField>
          </div>

          <TextField value={form.AVALAI_MODELS} onChange={(v) => setForm({ ...form, AVALAI_MODELS: v })}>
            <Label>مدل‌های AvalAI (به ترتیب: اول رایگان، بعد ارزان؛ با ویرگول)</Label>
            <Input dir="ltr" placeholder="gpt-4.1-nano,gemini-2.0-flash-lite,gpt-4o-mini" />
          </TextField>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">کوکی rond.ir</span>
              {state("ROND_COOKIE")}
            </div>
            <TextArea
              dir="ltr"
              rows={2}
              aria-label="کوکی rond.ir"
              placeholder="__arcsjs=...; __arcsjsc=..."
              value={form.ROND_COOKIE}
              onChange={(e) => setForm({ ...form, ROND_COOKIE: e.target.value })}
              className="w-full font-mono text-xs"
            />
            <p className="text-xs leading-6 text-muted">
              rond.ir را در مرورگر باز کنید ← F12 ← Application ← Cookies ← https://rond.ir ← مقدار __arcsjs و __arcsjsc را به شکل بالا بنویسید. حدود ۲۴ ساعت اعتبار دارد.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onPress={save} isPending={saving}>ذخیره و بررسی</Button>
            {saved && <span className="text-sm text-muted">{saved}</span>}
          </div>
        </Card.Content>
      </Card>
    </>
  );
}
