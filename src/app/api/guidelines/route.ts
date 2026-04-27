import { NextResponse } from "next/server";
import { GUIDELINES } from "@/lib/guidelines-registry";

export async function GET() {
  return NextResponse.json({ guidelines: GUIDELINES });
}
