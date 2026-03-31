import { NextResponse } from "next/server";
import { listBenchmarkDecks } from "@/lib/extract/benchmark";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    decks: listBenchmarkDecks(),
  });
}
