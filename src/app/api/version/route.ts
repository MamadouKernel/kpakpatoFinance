import { NextResponse } from "next/server";

// Jamais mis en cache : sert à savoir quelle version est actuellement en ligne.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA || "dev" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
