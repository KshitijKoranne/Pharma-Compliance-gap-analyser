import { NextRequest } from "next/server";
import mammoth from "mammoth";
import {
  summariseDocument,
  filterGuidelines,
  generateRequirements,
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
        console.log("Relevant guidelines:", guidelineNames);

        // ── Step 4: Generate requirements (Pass 2) ────────────────────────
        send({ type: "progress", step: "searching", label: "Identifying applicable requirements...", pct: 45 });
        const requirements = await generateRequirements(summary, guidelineNames);
        console.log(`Generated ${requirements.length} requirements`);

        if (requirements.length === 0) {
          send({ type: "error", message: "Could not identify applicable requirements for this document." });
          controller.close();
          return;
        }

        // ── Step 5: Audit document (Pass 3) ───────────────────────────────
        send({ type: "progress", step: "analysing", label: "Auditing document against requirements...", pct: 65 });
        const report = await runGapAnalysis(
          sopText,
          guidelineNames,
          file.name,
          summary,
          requirements
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
