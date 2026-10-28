"use client";
import { Button, Card, Input, Label, TextField } from "@heroui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطای ناشناخته");
    const next = params.get("next");
    router.push(next?.startsWith("/panel") ? next : "/panel");
    router.refresh();
  }

  return (
    <div className="grid min-h-[70dvh] place-items-center py-10">
      <Card className="w-full max-w-md p-2 sm:p-4">
        <Card.Header>
          <Card.Title className="text-2xl">{isLogin ? "ورود به حساب" : "ساخت حساب جدید"}</Card.Title>
          <Card.Description>{isLogin ? "با نام کاربری و رمز عبور وارد شوید." : "فقط یک نام کاربری و رمز عبور لازم است."}</Card.Description>
        </Card.Header>
        <Card.Content>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <TextField name="username" isRequired autoComplete="username">
              <Label>نام کاربری</Label>
              <Input dir="ltr" placeholder="username" />
            </TextField>
            <TextField name="password" type="password" isRequired autoComplete={isLogin ? "current-password" : "new-password"}>
              <Label>رمز عبور</Label>
              <Input dir="ltr" placeholder="••••••••" />
            </TextField>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" isPending={busy} className="w-full">
              {isLogin ? "ورود" : "ثبت‌نام"}
            </Button>
          </form>
        </Card.Content>
        <Card.Footer className="text-sm text-muted">
          {isLogin ? (
            <>حساب ندارید؟ <Link className="mx-1 text-accent underline" href="/register">ثبت‌نام</Link></>
          ) : (
            <>حساب دارید؟ <Link className="mx-1 text-accent underline" href="/login">ورود</Link></>
          )}
        </Card.Footer>
      </Card>
    </div>
  );
}
