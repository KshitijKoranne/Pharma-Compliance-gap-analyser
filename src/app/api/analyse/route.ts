import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { searchGuidelines } from "@/lib/vector";
import { runGapAnalysis } from "@/lib/analyser";
import { GUIDELINES } from "@/lib/guidelines-registry";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const guidelineIdsRaw = formData.get("guidelineIds") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!guidelineIdsRaw) {
      return NextResponse.json({ error: "No guidelines selected" }, { status: 400 });
    }

    const guidelineIds: string[] = JSON.parse(guidelineIdsRaw);
    if (!guidelineIds.length) {
      return NextResponse.json({ error: "Select at least one guideline" }, { status: 400 });
    }

    // Check all selected guidelines are ingested
    const selectedGuidelines = GUIDELINES.filter((g) => guidelineIds.includes(g.id));
    const notIngested = selectedGuidelines.filter((g) => !g.ingested);
    if (notIngested.length > 0) {
      return NextResponse.json(
        {
          error: `These guidelines have not been ingested yet: ${notIngested.map((g) => g.shortName).join(", ")}. Run the ingestion script first.`,
        },
        { status: 400 }
      );
    }

    // Parse .docx
    const buffer = Buffer.from(await file.arrayBuffer());
    const { value: sopText } = await mammoth.extractRawText({ buffer });

    if (!sopText || sopText.trim().length < 100) {
      return NextResponse.json(
        { error: "Document appears to be empty or could not be parsed" },
        { status: 400 }
      );
    }

    // Semantic search for relevant guideline chunks
    const chunks = await searchGuidelines(sopText.slice(0, 3000), guidelineIds, 15);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No relevant guideline content found. Ensure guidelines are ingested." },
        { status: 400 }
      );
    }

    // Run gap analysis
    const guidelineNames = selectedGuidelines.map((g) => g.shortName);
    const report = await runGapAnalysis(sopText, chunks, guidelineNames, file.name);

    return NextResponse.json({ report });
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
