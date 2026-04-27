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

const SYSTEM_PROMPT = `You are a senior pharmaceutical regulatory compliance expert with 20+ years of experience in GMP auditing, CSV validation, and regulatory submissions. You specialize in gap analysis of pharmaceutical SOPs and quality documents against regulatory guidelines including ICH Q-series, EU GMP, FDA 21 CFR, and WHO GMP.

Your gap analysis must be:
1. SPECIFIC - cite exact section numbers from guidelines (e.g., "ICH Q10, Section 4.2.1" not just "ICH Q10")
2. TRACEABLE - every finding must reference the SOP text or absence thereof
3. ACTIONABLE - gaps must describe exactly what is missing or needs to change
4. CONSERVATIVE - in a regulated environment, partial compliance is non-compliance until corrected

Return ONLY a valid JSON object with this exact structure (no markdown, no preamble):
{
  "findings": [
    {
      "section": "string - SOP section heading or paragraph reference",
      "status": "COMPLIANT" | "PARTIAL" | "GAP",
      "requirement": "string - exact requirement from the guideline with section reference",
      "finding": "string - what the SOP says, partially addresses, or is missing",
      "guidelineReference": "string - e.g. ICH Q10, Section 4.2.1",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}

Confidence levels:
- HIGH: Requirement is clearly present or clearly absent from the SOP
- MEDIUM: Requirement may be partially addressed but needs review
- LOW: Cannot determine from the SOP text alone; recommend manual review`;

async function callNvidiaNim(
  sopText: string,
  guidelineChunks: SearchResult[]
): Promise<GapFinding[]> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("Missing NVIDIA_API_KEY");

  const chunksText = guidelineChunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1}] ${c.metadata.guidelineReference || c.metadata.source} - ${c.metadata.section}\n${c.metadata.text}`
    )
    .join("\n\n---\n\n");

  const userMessage = `Analyse the following SOP document against the provided regulatory guideline requirements.

=== SOP DOCUMENT ===
${sopText.slice(0, 8000)}

=== RELEVANT GUIDELINE REQUIREMENTS ===
${chunksText}

Perform a thorough gap analysis. For each requirement found in the guideline chunks, assess whether the SOP is COMPLIANT, PARTIAL, or has a GAP. Also identify any sections of the SOP that are not addressed by any guideline requirement.`;

  const response = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA NIM error: ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
  return parsed.findings;
}

async function callOpenRouter(
  sopText: string,
  guidelineChunks: SearchResult[]
): Promise<GapFinding[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const chunksText = guidelineChunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1}] ${c.metadata.guidelineReference || c.metadata.source} - ${c.metadata.section}\n${c.metadata.text}`
    )
    .join("\n\n---\n\n");

  const userMessage = `Analyse the following SOP document against the provided regulatory guideline requirements.

=== SOP DOCUMENT ===
${sopText.slice(0, 8000)}

=== RELEVANT GUIDELINE REQUIREMENTS ===
${chunksText}

Perform a thorough gap analysis. For each requirement found in the guideline chunks, assess whether the SOP is COMPLIANT, PARTIAL, or has a GAP.`;

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
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${err}`);
  }

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

  const criticalGaps = findings.filter(
    (f) => f.status === "GAP" && f.confidence !== "LOW"
  );
  const minorGaps = findings.filter(
    (f) => f.status === "PARTIAL" || (f.status === "GAP" && f.confidence === "LOW")
  );
  const compliantAreas = findings.filter((f) => f.status === "COMPLIANT");

  const total = findings.length;
  const compliantCount = compliantAreas.length;

  return {
    overallScore: `${compliantCount}/${total} requirements met`,
    criticalGaps,
    minorGaps,
    compliantAreas,
    allFindings: findings,
    analysedAt: new Date().toISOString(),
    guidelines: guidelineNames,
    documentName,
  };
}
