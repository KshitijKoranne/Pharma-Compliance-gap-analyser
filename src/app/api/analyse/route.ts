import { NextRequest } from "next/server";
import mammoth from "mammoth";
import { searchGuidelines, type SearchResult } from "@/lib/vector";
import { runGapAnalysis } from "@/lib/analyser";
import { GUIDELINES } from "@/lib/guidelines-registry";

export const maxDuration = 120;

function sse(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(sse(data)));

      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const guidelineIdsRaw = formData.get("guidelineIds") as string | null;

        if (!file) { send({ type: "error", message: "No file uploaded" }); controller.close(); return; }
        if (!guidelineIdsRaw) { send({ type: "error", message: "No guidelines selected" }); controller.close(); return; }

        const guidelineIds: string[] = JSON.parse(guidelineIdsRaw);

        // Step 1: Parse document
        send({ type: "progress", step: "parsing", label: "Reading document...", pct: 8 });
        const buffer = Buffer.from(await file.arrayBuffer());
        const { value: sopText } = await mammoth.extractRawText({ buffer });

        if (!sopText || sopText.trim().length < 100) {
          send({ type: "error", message: "Document appears empty or could not be parsed" });
          controller.close(); return;
        }

        // Step 2: Semantic search
        send({ type: "progress", step: "searching", label: "Finding relevant guideline sections...", pct: 22 });

        const L = sopText.length;
        const queries = [
          sopText.slice(0, 1500),
          sopText.slice(Math.floor(L * 0.25), Math.floor(L * 0.25) + 1500),
          sopText.slice(Math.floor(L * 0.5),  Math.floor(L * 0.5)  + 1500),
          sopText.slice(Math.floor(L * 0.75), Math.floor(L * 0.75) + 1500),
        ];

        const allChunksMap = new Map<string, SearchResult>();
        await Promise.all(queries.map(async (q) => {
          const results = await searchGuidelines(q, guidelineIds, 12);
          for (const r of results) if (!allChunksMap.has(r.id)) allChunksMap.set(r.id, r);
        }));

        const chunks = [...allChunksMap.values()].sort((a, b) => b.score - a.score).slice(0, 30);

        if (chunks.length === 0) {
          send({ type: "error", message: "No relevant guideline content found." });
          controller.close(); return;
        }

        // Step 3: Summarise document (Pass 1)
        send({ type: "progress", step: "summarising", label: "Understanding document intent and scope...", pct: 42 });

        const selectedGuidelines = GUIDELINES.filter((g) => guidelineIds.includes(g.id));
        const guidelineNames = selectedGuidelines.map((g) => g.shortName);

        // Step 4: Gap analysis (Pass 2)
        send({ type: "progress", step: "analysing", label: "Running gap analysis against guidelines...", pct: 65 });

        const report = await runGapAnalysis(sopText, chunks, guidelineNames, file.name);

        // Step 5: Done
        send({ type: "progress", step: "finalising", label: "Compiling report...", pct: 92 });
        await new Promise((r) => setTimeout(r, 400));

        send({ type: "complete", report });
        controller.close();

      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Analysis failed" });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
