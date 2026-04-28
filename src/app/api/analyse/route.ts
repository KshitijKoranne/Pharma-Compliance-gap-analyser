import { NextRequest } from "next/server";
import mammoth from "mammoth";
import { searchGuidelines, type SearchResult } from "@/lib/vector";
import {
  summariseDocument,
  filterGuidelines,
  generateSearchQueries,
  runGapAnalysis,
} from "@/lib/analyser";
import { GUIDELINES } from "@/lib/guidelines-registry";

export const maxDuration = 120;

function sse(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(sse(data)));

      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const guidelineIdsRaw = formData.get("guidelineIds") as string | null;

        if (!file) {
          send({ type: "error", message: "No file uploaded" });
          controller.close();
          return;
        }
        if (!guidelineIdsRaw) {
          send({ type: "error", message: "No guidelines selected" });
          controller.close();
          return;
        }

        const userSelectedIds: string[] = JSON.parse(guidelineIdsRaw);

        // ── Step 1: Parse document ────────────────────────────────────────
        send({ type: "progress", step: "parsing", label: "Reading document...", pct: 5 });
        const buffer = Buffer.from(await file.arrayBuffer());
        const { value: sopText } = await mammoth.extractRawText({ buffer });

        if (!sopText || sopText.trim().length < 100) {
          send({ type: "error", message: "Document appears empty or could not be parsed" });
          controller.close();
          return;
        }

        // ── Step 2: Summarise document (Pass 1) ──────────────────────────
        send({ type: "progress", step: "summarising", label: "Understanding document scope and intent...", pct: 15 });
        const summary = await summariseDocument(sopText);
        console.log("Document summary:", JSON.stringify(summary, null, 2));

        // ── Step 3: Filter guidelines (Pass 1.5) ─────────────────────────
        send({ type: "progress", step: "filtering", label: "Identifying relevant guidelines...", pct: 30 });
        const relevantIds = await filterGuidelines(summary, GUIDELINES, userSelectedIds);

        const selectedGuidelines = GUIDELINES.filter((g) => relevantIds.includes(g.id));
        const guidelineNames = selectedGuidelines.map((g) => g.shortName);

        // ── Step 4: Smart semantic search ─────────────────────────────────
        send({ type: "progress", step: "searching", label: "Finding relevant requirements...", pct: 45 });

        // Generate targeted queries from document understanding
        const smartQueries = generateSearchQueries(summary);
        console.log("Search queries:", smartQueries);

        // Also include one raw SOP slice as a fallback catch-all
        const rawSlice = sopText.slice(0, 1500);

        const allChunksMap = new Map<string, SearchResult>();

        // Run smart queries
        await Promise.all(
          smartQueries.map(async (q) => {
            const results = await searchGuidelines(q, relevantIds, 8);
            for (const r of results) {
              if (!allChunksMap.has(r.id)) allChunksMap.set(r.id, r);
            }
          })
        );

        // Run one raw query as fallback
        const rawResults = await searchGuidelines(rawSlice, relevantIds, 8);
        for (const r of rawResults) {
          if (!allChunksMap.has(r.id)) allChunksMap.set(r.id, r);
        }

        const chunks = [...allChunksMap.values()]
          .sort((a, b) => b.score - a.score)
          .slice(0, 30);

        if (chunks.length === 0) {
          send({ type: "error", message: "No relevant guideline content found for the filtered guidelines." });
          controller.close();
          return;
        }

        console.log(`Search: ${allChunksMap.size} unique chunks found, using top ${chunks.length}`);

        // ── Step 5: Gap analysis (Pass 2) ─────────────────────────────────
        send({ type: "progress", step: "analysing", label: "Running gap analysis...", pct: 65 });

        const report = await runGapAnalysis(
          sopText,
          chunks,
          guidelineNames,
          file.name,
          summary
        );

        // ── Step 6: Done ──────────────────────────────────────────────────
        send({ type: "progress", step: "finalising", label: "Compiling report...", pct: 92 });
        await new Promise((r) => setTimeout(r, 400));

        send({ type: "complete", report });
        controller.close();
      } catch (err) {
        console.error("Analysis pipeline error:", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Analysis failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
