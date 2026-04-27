import type { SearchResult } from "./vector";

export interface GapFinding {
  section: string;
  status: "COMPLIANT" | "PARTIAL" | "GAP";
  requirement: string;
  finding: string;
  guidelineReference: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface DocumentSummary {
  title: string;
  purpose: string;
  scope: string;
  covers: string[];
  excludes: string[];
  keyProcesses: string[];
  documentType: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
}

export interface GapReport {
  overallScore: string;
  summary: DocumentSummary;
  criticalGaps: GapFinding[];
  minorGaps: GapFinding[];
  compliantAreas: GapFinding[];
  allFindings: GapFinding[];
  analysedAt: string;
  guidelines: string[];
  documentName: string;
}

// ── Pass 1: Understand the document ──────────────────────────────────────────

const SUMMARISER_PROMPT = `You are a pharmaceutical regulatory expert. Read the SOP below and produce a structured understanding of it.

Return ONLY valid JSON, no markdown:
{
  "title": "The document title as written",
  "documentType": "e.g. SOP, Policy, Protocol, Work Instruction, Guideline",
  "purpose": "One sentence: what this document is designed to achieve",
  "scope": "One sentence: what operations, systems, or products this covers",
  "covers": ["List of specific topics, processes, or activities explicitly addressed"],
  "excludes": ["List of things explicitly excluded or out of scope — very important"],
  "keyProcesses": ["The main procedural steps or workflow elements described"],
  "riskLevel": "HIGH if GMP-critical (manufacturing, testing, validation, data integrity), MEDIUM if quality-adjacent, LOW if administrative"
}`;

async function summariseDocument(sopText: string, apiKey: string, isOpenRouter = false): Promise<DocumentSummary> {
  const url = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://integrate.api.nvidia.com/v1/chat/completions";

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
  if (isOpenRouter) { headers["HTTP-Referer"] = "https://kjrlabs.in"; headers["X-Title"] = "Pharma Compliance Gap Analyser"; }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: isOpenRouter ? "anthropic/claude-3.5-sonnet" : "meta/llama-3.3-70b-instruct",
      messages: [
        { role: "system", content: SUMMARISER_PROMPT },
        { role: "user", content: `=== DOCUMENT ===\n${sopText.slice(0, 8000)}` },
      ],
      temperature: 0.0,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) throw new Error(`Summariser error: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
}

// ── Pass 2: Gap analysis with document context ────────────────────────────────

function buildAnalysisPrompt(summary: DocumentSummary): string {
  return `You are a pharmaceutical GMP regulatory auditor conducting a formal inspection-level gap analysis.

DOCUMENT CONTEXT (use this to inform every finding):
- Type: ${summary.documentType}
- Purpose: ${summary.purpose}
- Scope: ${summary.scope}
- This document covers: ${summary.covers.join("; ")}
- This document explicitly excludes: ${summary.excludes.length ? summary.excludes.join("; ") : "nothing stated"}
- Key processes described: ${summary.keyProcesses.join("; ")}
- GMP Risk Level: ${summary.riskLevel}

Use this context when evaluating each requirement. If the document's scope makes a requirement non-applicable, note that. If the document explicitly excludes something required, that is a GAP.

CLASSIFICATION RULES:

GAP: Requirement is completely absent from the document. Not mentioned, not implied. Also GAP when the document explicitly contradicts or excludes a requirement.

PARTIAL: Requirement is genuinely touched upon but one or more specific sub-elements are missing. Only use when there is real partial coverage.

COMPLIANT: Requirement is explicitly and specifically addressed. You can point to a section. Mark COMPLIANT when:
  - Document has a section or statement satisfying the requirement
  - Requirement is "have a procedure" and this IS that procedure
  - Requirement asks for defined responsibilities and document has a responsibilities section
  - Requirement asks for defined records and document specifies those records
  - Core requirement is met — do not downgrade for lack of additional detail

KNOWN GAPS to look for (mark GAP if absent):
- ICH Q9 risk tools (FMEA, risk matrix) in change/risk assessment
- Patient safety as primary consideration in impact assessment
- Senior management review of quality system performance
- Post-implementation effectiveness monitoring
- Emergency or retrospective change provisions
- Re-validation/re-qualification after major changes
- Change control scope covering outsourced activities
- Record retention per ICH Q7 (3 years post batch expiry for APIs)
- CAPA linkage for changes from deviations

Always cite exact section numbers (e.g., "ICH Q10, Section 3.2.3").
The "finding" field: 1–2 precise sentences. For COMPLIANT — reference the SOP section. For GAP/PARTIAL — name exactly what is missing.

Return ONLY valid JSON:
{
  "findings": [
    {
      "section": "SOP section reference or 'Not addressed'",
      "status": "GAP" | "PARTIAL" | "COMPLIANT",
      "requirement": "Exact requirement with section number",
      "finding": "1-2 sentence specific observation",
      "guidelineReference": "e.g. ICH Q10, Section 3.2.3",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}`;
}

async function runAnalysis(
  sopText: string,
  summary: DocumentSummary,
  guidelineChunks: SearchResult[],
  apiKey: string,
  isOpenRouter = false
): Promise<GapFinding[]> {
  const systemPrompt = buildAnalysisPrompt(summary);

  const chunksText = guidelineChunks
    .map((c, i) => `[REQ-${String(i + 1).padStart(2, "0")}] ${c.metadata.guidelineReference || c.metadata.source} — ${c.metadata.section}\n${c.metadata.text}`)
    .join("\n\n---\n\n");

  const userMessage = `Audit the SOP below against every requirement block. Produce one finding per [REQ-XX] block. Use the document context from your system prompt.

=== SOP TEXT ===
${sopText.slice(0, 12000)}

=== REQUIREMENTS TO AUDIT ===
${chunksText}`;

  const url = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://integrate.api.nvidia.com/v1/chat/completions";

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
  if (isOpenRouter) { headers["HTTP-Referer"] = "https://kjrlabs.in"; headers["X-Title"] = "Pharma Compliance Gap Analyser"; }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: isOpenRouter ? "anthropic/claude-3.5-sonnet" : "meta/llama-3.3-70b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.0,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) throw new Error(`Analysis error: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
  return parsed.findings;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runGapAnalysis(
  sopText: string,
  guidelineChunks: SearchResult[],
  guidelineNames: string[],
  documentName: string
): Promise<GapReport> {
  const nvidiaKey = process.env.NVIDIA_API_KEY!;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  // Pass 1: Summarise document
  let summary: DocumentSummary;
  try {
    summary = await summariseDocument(sopText, nvidiaKey, false);
  } catch {
    try {
      summary = await summariseDocument(sopText, openRouterKey!, true);
    } catch {
      // Fallback minimal summary if both fail
      summary = {
        title: documentName,
        documentType: "SOP",
        purpose: "Not determined",
        scope: "Not determined",
        covers: [],
        excludes: [],
        keyProcesses: [],
        riskLevel: "HIGH",
      };
    }
  }

  // Pass 2: Gap analysis with document context
  let findings: GapFinding[];
  try {
    findings = await runAnalysis(sopText, summary, guidelineChunks, nvidiaKey, false);
  } catch (err) {
    console.warn("NVIDIA NIM failed on analysis, falling back:", err);
    findings = await runAnalysis(sopText, summary, guidelineChunks, openRouterKey!, true);
  }

  // Deduplicate
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
    summary,
    criticalGaps,
    minorGaps,
    compliantAreas,
    allFindings: findings,
    analysedAt: new Date().toISOString(),
    guidelines: guidelineNames,
    documentName,
  };
}
