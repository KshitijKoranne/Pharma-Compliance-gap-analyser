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

const SYSTEM_PROMPT = `You are a pharmaceutical GMP regulatory auditor conducting a formal inspection-level gap analysis. You work to FDA 483 and EMA deficiency letter standards. You are known for being exacting and uncompromising.

CLASSIFICATION RULES — follow these exactly, no exceptions:

GAP: The requirement is ABSENT from the SOP. Not mentioned. Not implied. Not partially addressed. Completely missing. Also use GAP when the SOP explicitly contradicts a requirement (e.g., excludes something that must be included).

PARTIAL: The requirement is MENTIONED or TOUCHED UPON in the SOP but does not fully satisfy it. Something specific is missing from the implementation. Use this only when there is genuine partial coverage — not as a soft version of GAP.

COMPLIANT: The requirement is EXPLICITLY and SPECIFICALLY addressed in the SOP text. You can point to a specific sentence or paragraph that satisfies it. "Implied" compliance does not count. "General intent" does not count.

CRITICAL RULES:
1. If you cannot quote or closely paraphrase specific SOP text that addresses the requirement, it is NOT compliant.
2. "The SOP does not explicitly mention X" = GAP, not PARTIAL.
3. "The SOP mentions X but omits Y which is required" = PARTIAL.
4. Risk assessment methodology (e.g., FMEA, risk matrix per ICH Q9) being absent = GAP.
5. Patient safety as primary risk consideration being absent = GAP.
6. Management review of change control outcomes being absent = GAP.
7. Effectiveness checks / post-implementation monitoring being absent = GAP.
8. Emergency or retrospective change provisions being absent = GAP.
9. Re-validation or re-qualification requirement after major changes being absent = GAP.
10. Outsourced activities / contract manufacturers exclusion from scope = GAP.
11. Record retention period that conflicts with ICH Q7 = GAP.
12. Missing CAPA linkage for identified gaps = GAP.

Always cite exact section numbers (e.g., "ICH Q10, Section 3.2.3"). Never cite just a guideline name.

The "finding" field must be specific: name the exact element missing, or quote the SOP text that satisfies the requirement. One or two precise sentences only.

Return ONLY valid JSON — no markdown fences, no preamble:
{
  "findings": [
    {
      "section": "SOP section reference (e.g. '5.3 Impact Assessment') or 'Not addressed' if absent",
      "status": "GAP" | "PARTIAL" | "COMPLIANT",
      "requirement": "Exact requirement with section number",
      "finding": "Specific one or two sentence observation citing SOP text or naming the missing element",
      "guidelineReference": "e.g. ICH Q10, Section 3.2.3",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}`;

async function callLLM(sopText: string, guidelineChunks: SearchResult[], apiKey: string, isOpenRouter = false): Promise<GapFinding[]> {
  const chunksText = guidelineChunks
    .map((c, i) => `[REQ-${String(i + 1).padStart(2, "0")}] ${c.metadata.guidelineReference || c.metadata.source} — ${c.metadata.section}\n${c.metadata.text}`)
    .join("\n\n---\n\n");

  const userMessage = `You are auditing the following SOP. Apply inspection-level scrutiny. Check every requirement block below against the SOP text. Do not skip any requirement.

For each [REQ-XX] block, produce exactly one finding. If the SOP does not address it at all, status = GAP. If partially, status = PARTIAL. Only if explicitly and specifically addressed, status = COMPLIANT.

=== SOP TEXT ===
${sopText.slice(0, 12000)}

=== REQUIREMENTS TO AUDIT AGAINST (check every single one) ===
${chunksText}

Return one finding per requirement block above. Be strict.`;

  const url = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://integrate.api.nvidia.com/v1/chat/completions";

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
  if (isOpenRouter) { headers["HTTP-Referer"] = "https://kjrlabs.in"; headers["X-Title"] = "Pharma Compliance Gap Analyser"; }

  const body = {
    model: isOpenRouter ? "anthropic/claude-3.5-sonnet" : "meta/llama-3.3-70b-instruct",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMessage }],
    temperature: 0.0,
    max_tokens: 8192,
  };

  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`LLM error (${isOpenRouter ? "OpenRouter" : "NVIDIA"}): ${await response.text()}`);

  const data = await response.json();
  const content = data.choices[0].message.content;
  const clean = content.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(clean);
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

  // Deduplicate findings by guidelineReference + requirement similarity
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
