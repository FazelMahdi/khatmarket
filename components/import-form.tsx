"use client";
import { Button, TextArea } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/import", { method: "POST", body: text });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `دریافت: ${data.received} | ذخیره: ${data.upserted} | رد شده: ${data.skipped}` : (data.error ?? "خطا"));
    if (res.ok) {
      setText("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <TextArea
        dir="ltr"
        rows={8}
        placeholder='{"content":[{"simCardNumber":"09121234567","price":100000000,...}]}'
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full font-mono text-xs"
        aria-label="JSON آگهی‌ها"
      />
      <div className="flex items-center gap-3">
        <Button onPress={send} isPending={busy} isDisabled={!text.trim()}>وارد کردن</Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
