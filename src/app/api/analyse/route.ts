import { NextRequest } from "next/server";
import mammoth from "mammoth";
import { searchGuidelines, type SearchResult } from "@/lib/vector";
import {
  summariseDocument,
  filterGuidelines,
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

        if (!file) { send({ type: "error", message: "No file uploaded" }); controller.close(); return; }
        if (!guidelineIdsRaw) { send({ type: "error", message: "No guidelines selected" }); controller.close(); return; }

        const userSelectedIds: string[] = JSON.parse(guidelineIdsRaw);

        // ── Step 1: Parse ─────────────────────────────────────────────────
        send({ type: "progress", step: "parsing", label: "Reading document...", pct: 5 });
        const buffer = Buffer.from(await file.arrayBuffer());
        const { value: sopText } = await mammoth.extractRawText({ buffer });

        if (!sopText || sopText.trim().length < 100) {
          send({ type: "error", message: "Document appears empty or could not be parsed" });
          controller.close(); return;
        }

        // ── Step 2: Summarise (Pass 1) ────────────────────────────────────
        send({ type: "progress", step: "summarising", label: "Understanding document...", pct: 12 });
        const summary = await summariseDocument(sopText);
        console.log("Summary:", JSON.stringify(summary, null, 2));

        // ── Step 3: Filter guidelines (Pass 1.5) ─────────────────────────
        send({ type: "progress", step: "filtering", label: "Selecting relevant guidelines...", pct: 25 });
        const relevantIds = await filterGuidelines(summary, GUIDELINES, userSelectedIds);
        const relevantGuidelines = GUIDELINES.filter((g) => relevantIds.includes(g.id));
        console.log("Relevant:", relevantGuidelines.map((g) => g.shortName));

        // ── Step 4: Fetch ALL chunks for each relevant guideline ──────────
        send({ type: "progress", step: "searching", label: "Reading guideline sections...", pct: 38 });

        // Use a broad query (document summary) with high topK per guideline
        // This retrieves the most relevant chunks from each guideline
        const queryText = `${summary.purpose} ${summary.scope} ${summary.gmpActivities.join(" ")} ${summary.keyProcesses.join(" ")}`;

        const guidelineChunksMap = new Map<string, { name: string; chunks: SearchResult[] }>();

        await Promise.all(
          relevantGuidelines.map(async (g) => {
            // Fetch up to 50 chunks per guideline — gets most/all sections
            const chunks = await searchGuidelines(queryText, [g.id], 50);
            guidelineChunksMap.set(g.id, { name: g.shortName, chunks });
            console.log(`  ${g.shortName}: ${chunks.length} chunks retrieved`);
          })
        );

        const totalChunks = [...guidelineChunksMap.values()].reduce((s, v) => s + v.chunks.length, 0);
        if (totalChunks === 0) {
          send({ type: "error", message: "No guideline content found." });
          controller.close(); return;
        }

        // ── Step 5: Per-guideline audit (Pass 2) ──────────────────────────
        const guidelineCount = guidelineChunksMap.size;
        send({
          type: "progress", step: "analysing",
          label: `Auditing against ${guidelineCount} guideline${guidelineCount > 1 ? "s" : ""}...`,
          pct: 52,
        });

        const report = await runGapAnalysis(sopText, summary, guidelineChunksMap, file.name);

        // ── Step 6: Done ──────────────────────────────────────────────────
        send({ type: "progress", step: "finalising", label: "Compiling report...", pct: 92 });
        await new Promise((r) => setTimeout(r, 400));

        send({ type: "complete", report });
        controller.close();
      } catch (err) {
        console.error("Pipeline error:", err);
        send({ type: "error", message: err instanceof Error ? err.message : "Analysis failed" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
