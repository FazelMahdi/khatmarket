import { NextResponse } from "next/server";
import { invalidateListings } from "@/lib/listings";
import { getSession } from "@/lib/session";
import { describeSettings, SETTING_KEYS, setSetting, type SettingKey } from "@/lib/settings";

const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });

export async function GET() {
  if ((await getSession())?.role !== "ADMIN") return forbidden();
  return NextResponse.json(await describeSettings());
}

/** Body: any of the setting keys; "" clears a value (the .env value applies again). */
export async function POST(req: Request) {
  if ((await getSession())?.role !== "ADMIN") return forbidden();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });
  for (const key of SETTING_KEYS) {
    if (typeof body[key] === "string") await setSetting(key as SettingKey, body[key] as string);
  }
  invalidateListings();
  return NextResponse.json(await describeSettings());
}
