import { NextResponse } from "next/server";
import { importPages } from "@/lib/import";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const text = await req.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "JSON نامعتبر است" }, { status: 400 });
  }
  return NextResponse.json(await importPages(json, "admin-import"));
}
