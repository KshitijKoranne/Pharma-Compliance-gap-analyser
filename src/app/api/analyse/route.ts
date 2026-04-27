import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { searchGuidelines, type SearchResult } from "@/lib/vector";
import { runGapAnalysis } from "@/lib/analyser";
import { GUIDELINES } from "@/lib/guidelines-registry";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const guidelineIdsRaw = formData.get("guidelineIds") as string | null;

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (!guidelineIdsRaw) return NextResponse.json({ error: "No guidelines selected" }, { status: 400 });

    const guidelineIds: string[] = JSON.parse(guidelineIdsRaw);
    if (!guidelineIds.length) return NextResponse.json({ error: "Select at least one guideline" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { value: sopText } = await mammoth.extractRawText({ buffer });

    if (!sopText || sopText.trim().length < 100)
      return NextResponse.json({ error: "Document appears empty or could not be parsed" }, { status: 400 });

    // Multi-pass semantic search: query with 4 different SOP segments
    // to maximise diversity of guideline chunks retrieved
    const L = sopText.length;
    const queries = [
      sopText.slice(0, 1500),
      sopText.slice(Math.floor(L * 0.25), Math.floor(L * 0.25) + 1500),
      sopText.slice(Math.floor(L * 0.5),  Math.floor(L * 0.5)  + 1500),
      sopText.slice(Math.floor(L * 0.75), Math.floor(L * 0.75) + 1500),
    ];

    const allChunksMap = new Map<string, SearchResult>();

    await Promise.all(
      queries.map(async (q) => {
        const results = await searchGuidelines(q, guidelineIds, 12);
        for (const r of results) {
          if (!allChunksMap.has(r.id)) allChunksMap.set(r.id, r);
        }
      })
    );

    const chunks = [...allChunksMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);

    if (chunks.length === 0)
      return NextResponse.json({ error: "No relevant guideline content found. Ensure guidelines are ingested." }, { status: 400 });

    const selectedGuidelines = GUIDELINES.filter((g) => guidelineIds.includes(g.id));
    const guidelineNames = selectedGuidelines.map((g) => g.shortName);
    const report = await runGapAnalysis(sopText, chunks, guidelineNames, file.name);

    return NextResponse.json({ report });
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Analysis failed" }, { status: 500 });
  }
}
