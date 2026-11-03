import { NextResponse } from "next/server";
import { avalaiListModels, avalaiModels } from "@/lib/ai/avalai";
import { prisma } from "@/lib/db";
import { CHALLENGE, rondApi } from "@/lib/rond/client";
import { getSession } from "@/lib/session";
import { getSetting } from "@/lib/settings";

type Check = { ok: boolean; title: string; detail: string };

async function rondCheck(): Promise<Check> {
  const title = "دسترسی به rond.ir";
  const cookie = await getSetting("ROND_COOKIE");
  try {
    const types = await rondApi.types("09121003088");
    return { ok: true, title, detail: `وصل است؛ rond.ir نوع 09121003088 را «${types.map((t) => t.algorithm).join("، ") || "معمولی"}» برگرداند.` };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === CHALLENGE) {
      return {
        ok: false,
        title,
        detail: cookie
          ? "کوکی rond.ir منقضی شده است. کوکی تازه را از مرورگر بردارید و در تنظیمات همین صفحه بگذارید."
          : "کوکی rond.ir تنظیم نشده است. rond.ir را در مرورگر باز کنید، کوکی‌های __arcsjs و __arcsjsc را بردارید و در تنظیمات همین صفحه بگذارید.",
      };
    }
    return { ok: false, title, detail: `به rond.ir وصل نشد (${msg.slice(0, 120)}). اینترنت یا فیلتر شبکهٔ سرور را بررسی کنید.` };
  }
}

async function avalaiCheck(): Promise<Check> {
  const title = "AvalAI";
  if (!(await getSetting("AVALAI_API_KEY"))) return { ok: false, title, detail: "کلید AvalAI تنظیم نشده است؛ بدون آن فقط برآورد الگوریتمی نمایش داده می‌شود." };
  try {
    const available = await avalaiListModels();
    const wanted = await avalaiModels();
    const usable = wanted.filter((m) => available.includes(m));
    const missing = wanted.filter((m) => !available.includes(m));
    return {
      ok: usable.length > 0,
      title,
      detail: usable.length
        ? `کلید کار می‌کند. مدل‌های قابل استفاده به ترتیب: ${usable.join("، ")}${missing.length ? ` (در دسترس نیست: ${missing.join("، ")})` : ""}`
        : `کلید کار می‌کند ولی هیچ‌کدام از مدل‌های تنظیم‌شده (${wanted.join("، ")}) در حساب شما نیست. چند مدل در دسترس: ${available.slice(0, 12).join("، ")}`,
    };
  } catch (e) {
    return { ok: false, title, detail: `AvalAI جواب نداد: ${(e as Error).message.slice(0, 160)}` };
  }
}

async function dataCheck(): Promise<Check> {
  const title = "داده‌های rond.ir در دیتابیس";
  const [synced, by0912, lastRun] = await Promise.all([
    prisma.listing.count({ where: { source: "rond.ir", active: true } }),
    prisma.listing.count({ where: { source: "rond.ir", active: true, prefix: "0912", price: { not: null } } }),
    prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const run = lastRun ? ` آخرین همگام‌سازی: ${lastRun.status === "ok" ? "موفق" : lastRun.status === "failed" ? `ناموفق (${lastRun.error ?? ""})` : "در حال اجرا"}.` : " هنوز همگام‌سازی اجرا نشده (npm run rond:sync).";
  return {
    ok: by0912 >= 1000,
    title,
    detail: `${synced.toLocaleString("fa-IR")} آگهی فعال، ${by0912.toLocaleString("fa-IR")} آگهی قیمت‌دار 0912.${by0912 >= 1000 ? " جستجو روی همهٔ آن‌ها انجام می‌شود." : " کمتر از ۱۰۰۰ است، پس جستجو زنده روی rond.ir انجام می‌شود."}${run}`,
  };
}

export async function GET() {
  if ((await getSession())?.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const checks = await Promise.all([rondCheck(), dataCheck(), avalaiCheck()]);
  return NextResponse.json({ checks });
}
