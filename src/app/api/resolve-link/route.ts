import { NextRequest, NextResponse } from "next/server";
import { parseMusicUrl } from "@/lib/music-url/parse";
import { resolveLink } from "@/lib/music-url/resolve";

// Simple in-memory rate limiter: max 30 requests per IP per minute.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now >= entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.url === "string" ? body.url.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const parsed = parseMusicUrl(raw);
  if (!parsed) {
    return NextResponse.json(
      { error: "Unsupported or invalid music URL" },
      { status: 422 },
    );
  }

  try {
    const result = await resolveLink(parsed);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[resolve-link]", err);
    return NextResponse.json(
      { error: err.message ?? "Resolution failed" },
      { status: 502 },
    );
  }
}
