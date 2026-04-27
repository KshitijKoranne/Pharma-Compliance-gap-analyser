import type { SearchResult } from "./vector";

export interface GapFinding {
  section: string;
  status: "COMPLIANT" | "PARTIAL" | "GAP";
  requirement: string;
  finding: string;
  guidelineReference: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface GapReport {
  overallScore: string;
  criticalGaps: GapFinding[];
  minorGaps: GapFinding[];
  compliantAreas: GapFinding[];
  allFindings: GapFinding[];
  analysedAt: string;
  guidelines: string[];
  documentName: string;
}

const SYSTEM_PROMPT = `You are a pharmaceutical GMP regulatory auditor conducting a formal inspection-level gap analysis. You work to FDA 483 and EMA deficiency letter standards.

CLASSIFICATION — apply these rules strictly:

GAP: The requirement is completely absent from the SOP. Not mentioned, not implied, not partially covered. Also use GAP when the SOP explicitly contradicts a requirement.

PARTIAL: The requirement is genuinely touched upon in the SOP but one or more specific sub-elements required by the guideline are missing. Use PARTIAL only when there is real partial coverage — not as a softened GAP.

COMPLIANT: The SOP explicitly and specifically addresses the requirement. You can point to a section or sentence. Mark COMPLIANT when:
  - The SOP has a section or explicit statement satisfying the requirement
  - The requirement is "have a procedure" and this SOP IS that procedure
  - The requirement asks for defined responsibilities and the SOP has a responsibilities section
  - The requirement asks for defined records and the SOP specifies those records
  - The requirement asks for a defined approval process and the SOP has one
  - Do NOT downgrade to PARTIAL simply because more detail could be added — if the core requirement is met, it is COMPLIANT

GAPS to specifically look for (mark as GAP if absent):
- Quality risk management methodology (ICH Q9 tools: FMEA, risk matrix) in change classification
- Patient safety as the primary consideration in risk/impact assessment
- Senior management review of change control performance/outcomes
- Post-implementation effectiveness check or monitoring
- Emergency change / retrospective change provisions
- Re-validation or re-qualification requirement after major changes
- Change control scope covering outsourced activities and contract manufacturers
- Record retention aligned with ICH Q7 (minimum 3 years post batch expiry for APIs)
- CAPA linkage for changes arising from deviations/non-conformances

Always cite exact section numbers (e.g., "ICH Q10, Section 3.2.3"). Never just a guideline name.

The "finding" field: one to two precise sentences. For COMPLIANT — reference the SOP section or quote text. For GAP/PARTIAL — name exactly what is absent.

Return ONLY valid JSON, no markdown:
{
  "findings": [
    {
      "section": "SOP section reference or 'Not addressed' if absent",
      "status": "GAP" | "PARTIAL" | "COMPLIANT",
      "requirement": "Exact requirement with section number",
      "finding": "One to two sentence specific observation",
      "guidelineReference": "e.g. ICH Q10, Section 3.2.3",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}`;

async function callLLM(sopText: string, guidelineChunks: SearchResult[], apiKey: string, isOpenRouter = false): Promise<GapFinding[]> {
  const chunksText = guidelineChunks
    .map((c, i) => `[REQ-${String(i + 1).padStart(2, "0")}] ${c.metadata.guidelineReference || c.metadata.source} — ${c.metadata.section}\n${c.metadata.text}`)
    .join("\n\n---\n\n");

  const userMessage = `Audit the SOP below against every requirement block listed. Produce one finding per [REQ-XX] block.

Apply balanced judgement: mark COMPLIANT when genuinely met, GAP when genuinely absent, PARTIAL when partially covered. Do not over-penalise or under-penalise.

=== SOP TEXT ===
${sopText.slice(0, 12000)}

=== REQUIREMENTS TO AUDIT (produce one finding for each) ===
${chunksText}`;

  const url = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://integrate.api.nvidia.com/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (isOpenRouter) {
    headers["HTTP-Referer"] = "https://kjrlabs.in";
    headers["X-Title"] = "Pharma Compliance Gap Analyser";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: isOpenRouter ? "anthropic/claude-3.5-sonnet" : "meta/llama-3.3-70b-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.0,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) throw new Error(`LLM error: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
  return parsed.findings;
}

export async function runGapAnalysis(
  sopText: string,
  guidelineChunks: SearchResult[],
  guidelineNames: string[],
  documentName: string
): Promise<GapReport> {
  let findings: GapFinding[];

  try {
    findings = await callLLM(sopText, guidelineChunks, process.env.NVIDIA_API_KEY!, false);
  } catch (err) {
    console.warn("NVIDIA NIM failed, falling back to OpenRouter:", err);
    findings = await callLLM(sopText, guidelineChunks, process.env.OPENROUTER_API_KEY!, true);
  }

  // Deduplicate by guideline ref + requirement prefix
  const seen = new Set<string>();
  findings = findings.filter((f) => {
    const key = `${f.guidelineReference}||${f.requirement.slice(0, 60)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const criticalGaps = findings.filter((f) => f.status === "GAP");
  const minorGaps = findings.filter((f) => f.status === "PARTIAL");
  const compliantAreas = findings.filter((f) => f.status === "COMPLIANT");

  return {
    overallScore: `${compliantAreas.length}/${findings.length} requirements met`,
    criticalGaps,
    minorGaps,
    compliantAreas,
    allFindings: findings,
    analysedAt: new Date().toISOString(),
    guidelines: guidelineNames,
    documentName,
  };
}
