import { NextResponse } from "next/server";
import { importPages } from "@/lib/import";
import { invalidateListings } from "@/lib/listings";
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
  const result = await importPages(json, "admin-import");
  invalidateListings();
  return NextResponse.json(result);
}
