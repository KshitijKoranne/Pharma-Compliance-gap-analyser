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

const SYSTEM_PROMPT = `You are a senior pharmaceutical regulatory auditor with 25 years of experience conducting GMP inspections and gap analyses. You have conducted audits for WHO, FDA, and EMA. You are known for being thorough, critical, and precise — you never give a "pass" unless the document explicitly and unambiguously satisfies the requirement.

YOUR CRITICAL RULES:
1. NEVER mark something COMPLIANT unless the SOP text EXPLICITLY and SPECIFICALLY addresses the requirement. Vague or implied compliance is PARTIAL at best.
2. ALWAYS cite the exact guideline section number (e.g., "ICH Q10, Section 3.2.3" not just "ICH Q10").
3. For each requirement in the guideline chunks, you MUST produce a finding — do not skip requirements.
4. Be specific about WHAT is missing in every GAP or PARTIAL finding. Name the exact element that is absent.
5. The "finding" field must quote or reference specific SOP text when marking COMPLIANT — if you cannot point to specific SOP text, it is not COMPLIANT.
6. Typical areas to scrutinise in pharma SOPs: risk assessment methodology, patient safety consideration, management review, effectiveness checks, outsourced activities, emergency/retrospective change provisions, re-validation requirements, record retention periods, and CAPA linkage.

Return ONLY a valid JSON object — no markdown, no preamble, no explanation outside the JSON:
{
  "findings": [
    {
      "section": "SOP section heading or paragraph reference (e.g. '5.3 Impact Assessment')",
      "status": "COMPLIANT" | "PARTIAL" | "GAP",
      "requirement": "Exact requirement from the guideline with section number",
      "finding": "Specific observation: what the SOP says, partially addresses, or is explicitly missing. Quote SOP text where relevant.",
      "guidelineReference": "e.g. ICH Q10, Section 3.2.3",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}

Confidence: HIGH = clear from SOP text, MEDIUM = ambiguous, LOW = cannot determine from text alone.`;

async function callNvidiaNim(sopText: string, guidelineChunks: SearchResult[]): Promise<GapFinding[]> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("Missing NVIDIA_API_KEY");

  const chunksText = guidelineChunks
    .map((c, i) => `[REQ ${i + 1}] ${c.metadata.guidelineReference || c.metadata.source}, ${c.metadata.section}\n${c.metadata.text}`)
    .join("\n\n---\n\n");

  const userMessage = `Perform a thorough gap analysis of this pharmaceutical SOP against the regulatory requirements below.

Be rigorous. Assume this document will be reviewed by an FDA or EMA inspector. For each requirement block below, produce a finding. Do not skip any requirement.

=== SOP DOCUMENT (full text) ===
${sopText.slice(0, 10000)}

=== REGULATORY REQUIREMENTS TO CHECK AGAINST ===
${chunksText}

Analyse every requirement above. Return findings for ALL of them.`;

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.05,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) throw new Error(`NVIDIA NIM error: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
  return parsed.findings;
}

async function callOpenRouter(sopText: string, guidelineChunks: SearchResult[]): Promise<GapFinding[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const chunksText = guidelineChunks
    .map((c, i) => `[REQ ${i + 1}] ${c.metadata.guidelineReference || c.metadata.source}, ${c.metadata.section}\n${c.metadata.text}`)
    .join("\n\n---\n\n");

  const userMessage = `Perform a thorough gap analysis of this pharmaceutical SOP against the regulatory requirements below. Be rigorous — assume FDA/EMA inspection level scrutiny.

=== SOP DOCUMENT ===
${sopText.slice(0, 10000)}

=== REGULATORY REQUIREMENTS ===
${chunksText}

Produce a finding for every requirement. Return JSON only.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://kjrlabs.in",
      "X-Title": "Pharma Compliance Gap Analyser",
    },
    body: JSON.stringify({
      model: "auto",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.05,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) throw new Error(`OpenRouter error: ${await response.text()}`);
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
    findings = await callNvidiaNim(sopText, guidelineChunks);
  } catch (err) {
    console.warn("NVIDIA NIM failed, falling back to OpenRouter:", err);
    findings = await callOpenRouter(sopText, guidelineChunks);
  }

  // Strict categorisation: GAP + HIGH/MEDIUM confidence = critical
  const criticalGaps = findings.filter((f) => f.status === "GAP" && f.confidence !== "LOW");
  const minorGaps = findings.filter((f) => f.status === "PARTIAL" || (f.status === "GAP" && f.confidence === "LOW"));
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
