import type { SearchResult } from "./vector";
import type { Guideline } from "./guidelines-registry";

/**
 * Robustly extract JSON from LLM output that may contain prose preamble,
 * markdown fences, or trailing text around the JSON object.
 */
function extractJSON(raw: string): string {
  let cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();

  const startObj = cleaned.indexOf("{");
  const startArr = cleaned.indexOf("[");

  let start: number;
  let closeChar: string;

  if (startObj === -1 && startArr === -1) {
    throw new Error(`No JSON found in LLM response: ${raw.slice(0, 120)}...`);
  } else if (startArr === -1 || (startObj !== -1 && startObj < startArr)) {
    start = startObj;
    closeChar = "}";
  } else {
    start = startArr;
    closeChar = "]";
  }

  const end = cleaned.lastIndexOf(closeChar);
  if (end <= start) {
    throw new Error(`Malformed JSON in LLM response: ${raw.slice(0, 120)}...`);
  }

  return cleaned.slice(start, end + 1);
}

// ── Shared LLM call helper ──────────────────────────────────────────────────

async function callLLM(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  isOpenRouter: boolean,
  maxTokens: number
): Promise<string> {
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
      model: isOpenRouter
        ? "anthropic/claude-3.5-sonnet"
        : "meta/llama-3.3-70b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.0,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/** Try NVIDIA first, fallback to OpenRouter if available */
async function callLLMWithFallback(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const nvidiaKey = process.env.NVIDIA_API_KEY!;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const hasOpenRouter = openRouterKey && openRouterKey !== "placeholder";

  try {
    return await callLLM(systemPrompt, userMessage, nvidiaKey, false, maxTokens);
  } catch (err) {
    console.warn("NVIDIA call failed:", err);
    if (!hasOpenRouter) throw err;
    return await callLLM(systemPrompt, userMessage, openRouterKey!, true, maxTokens);
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

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
  regulatoryReferences: string[];
  applicableProductTypes: string[];
  gmpActivities: string[];
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

const SUMMARISER_PROMPT = `You are a pharmaceutical regulatory expert. Read the document below and produce a structured understanding of it.

IMPORTANT: Read the ENTIRE text carefully, especially the References section — it tells you which regulatory frameworks this document intends to comply with.

Return ONLY valid JSON, no markdown, no preamble, no trailing text:
{
  "title": "The document title as written",
  "documentType": "e.g. SOP, Policy, Protocol, Work Instruction, Batch Record, Specification",
  "purpose": "One sentence: what this document is designed to achieve",
  "scope": "One sentence: what operations, systems, or products this covers",
  "covers": ["List of specific topics, processes, or activities explicitly addressed"],
  "excludes": ["List of things explicitly excluded or out of scope"],
  "keyProcesses": ["The main procedural steps or workflow elements described"],
  "riskLevel": "HIGH if GMP-critical (manufacturing, testing, validation, data integrity), MEDIUM if quality-adjacent (change control, CAPA, training), LOW if administrative",
  "regulatoryReferences": ["Every regulatory standard cited in the document, e.g. ICH Q10, ICH Q9, EU GMP Annex 15, 21 CFR Part 211"],
  "applicableProductTypes": ["e.g. API, finished dosage form, biologics, all pharmaceutical products"],
  "gmpActivities": ["From this list, pick ALL that apply: manufacturing, testing, packaging, labelling, storage, distribution, change control, deviation management, CAPA, validation, qualification, calibration, cleaning, stability, documentation, training, supplier management, complaints, recalls, risk management, quality system, data integrity, technology transfer"]
}`;

export async function summariseDocument(sopText: string): Promise<DocumentSummary> {
  // Send beginning + end of document to capture purpose/scope AND references/retention
  const beginChars = 5000;
  const endChars = 3000;
  let docSlice: string;

  if (sopText.length <= beginChars + endChars) {
    docSlice = sopText;
  } else {
    docSlice =
      sopText.slice(0, beginChars) +
      "\n\n[... middle sections omitted for brevity ...]\n\n" +
      sopText.slice(-endChars);
  }

  const content = await callLLMWithFallback(
    SUMMARISER_PROMPT,
    `=== DOCUMENT ===\n${docSlice}`,
    1024
  );

  const parsed = JSON.parse(extractJSON(content));

  return {
    title: parsed.title || "Unknown",
    documentType: parsed.documentType || "Unknown",
    purpose: parsed.purpose || "Not determined",
    scope: parsed.scope || "Not determined",
    covers: parsed.covers || [],
    excludes: parsed.excludes || [],
    keyProcesses: parsed.keyProcesses || [],
    riskLevel: parsed.riskLevel || "HIGH",
    regulatoryReferences: parsed.regulatoryReferences || [],
    applicableProductTypes: parsed.applicableProductTypes || [],
    gmpActivities: parsed.gmpActivities || [],
  };
}

// ── Pass 1.5: Intelligent Guideline Filtering ────────────────────────────────

const GUIDELINE_FILTER_PROMPT = `You are a pharmaceutical regulatory expert. Given a document summary and a list of available guidelines, determine which guidelines this document should be audited against.

RULES:
1. ONLY include guidelines whose subject matter DIRECTLY relates to the document's purpose and GMP activities.
2. Be SELECTIVE. A change control SOP should be audited against quality system, risk management, and GMP guidelines — NOT against stability testing, impurity limits, dissolution tests, or biotech-specific guidelines.
3. Pharmacopoeial test guidelines (Q4B annexes for dissolution, friability, endotoxins, etc.) are ONLY relevant to analytical test method documents.
4. Biotech guidelines (Q5A-Q5E) are ONLY relevant to biological/biotechnological product documents.
5. Stability guidelines (Q1A-Q1E) are ONLY relevant to stability studies or protocols.
6. Impurity guidelines (Q3A-Q3D) are ONLY relevant to impurity specifications or analytical methods.
7. When in doubt, EXCLUDE. A false gap from an irrelevant guideline is worse than missing a marginal one.

Return ONLY valid JSON, no markdown, no preamble:
{
  "relevantGuidelineIds": ["ICH-Q10", "ICH-Q9R1"],
  "reasoning": "Brief explanation"
}`;

export async function filterGuidelines(
  summary: DocumentSummary,
  availableGuidelines: Guideline[],
  userSelectedIds: string[]
): Promise<string[]> {
  // Only consider guidelines the user actually selected (via category checkboxes)
  const candidates = availableGuidelines.filter((g) => userSelectedIds.includes(g.id));

  const registryText = candidates
    .map((g) => `- ${g.id}: ${g.shortName} — ${g.description}`)
    .join("\n");

  const documentContext = `DOCUMENT SUMMARY:
- Title: ${summary.title}
- Type: ${summary.documentType}
- Purpose: ${summary.purpose}
- Scope: ${summary.scope}
- Covers: ${summary.covers.join("; ")}
- Excludes: ${summary.excludes.length ? summary.excludes.join("; ") : "nothing stated"}
- Key processes: ${summary.keyProcesses.join("; ")}
- GMP activities: ${summary.gmpActivities.join("; ")}
- Product types: ${summary.applicableProductTypes.join("; ")}
- Regulatory references cited in document: ${summary.regulatoryReferences.length ? summary.regulatoryReferences.join("; ") : "none"}

AVAILABLE GUIDELINES:
${registryText}

Return ONLY the IDs of guidelines that are genuinely relevant to audit this document against.`;

  const content = await callLLMWithFallback(
    GUIDELINE_FILTER_PROMPT,
    documentContext,
    512
  );

  const parsed = JSON.parse(extractJSON(content));
  let filteredIds: string[] = parsed.relevantGuidelineIds || [];

  // Safety net: always include guidelines the document itself cites
  const citedRefs = summary.regulatoryReferences.map((r) => r.toLowerCase());
  for (const g of candidates) {
    if (filteredIds.includes(g.id)) continue;

    const shortLower = g.shortName.toLowerCase();
    // Check if any cited reference matches this guideline
    // e.g. "ICH Q10" matches shortName "ICH Q10"
    if (
      citedRefs.some(
        (ref) =>
          shortLower.includes(ref) ||
          ref.includes(shortLower) ||
          // Handle partial matches like "ich q9" matching "ICH Q9(R1)"
          shortLower.replace(/[^a-z0-9]/g, "").includes(ref.replace(/[^a-z0-9]/g, ""))
      )
    ) {
      filteredIds.push(g.id);
    }
  }

  // Validate: only return IDs that exist in user's selection
  const validIds = new Set(candidates.map((g) => g.id));
  filteredIds = filteredIds.filter((id) => validIds.has(id));

  // If filter is too aggressive (0 results), fall back to user selection
  if (filteredIds.length === 0) {
    console.warn("Guideline filter returned 0 results — falling back to user selection");
    return userSelectedIds;
  }

  console.log(
    `Guideline filter: ${userSelectedIds.length} user-selected → ${filteredIds.length} relevant`,
    filteredIds
  );
  return filteredIds;
}

// ── Search Query Generation ──────────────────────────────────────────────────

export function generateSearchQueries(summary: DocumentSummary): string[] {
  const queries: string[] = [];

  // Key processes — most targeted
  for (const proc of summary.keyProcesses.slice(0, 4)) {
    queries.push(proc);
  }

  // GMP activities with regulatory context
  for (const activity of summary.gmpActivities.slice(0, 3)) {
    queries.push(`${activity} requirements GMP pharmaceutical`);
  }

  // Specific topics covered
  for (const topic of summary.covers.slice(0, 3)) {
    queries.push(topic);
  }

  // Purpose-based query
  if (summary.purpose && summary.purpose !== "Not determined") {
    queries.push(summary.purpose);
  }

  // Deduplicate and cap
  const seen = new Set<string>();
  return queries
    .filter((q) => {
      const key = q.toLowerCase().trim();
      if (seen.has(key) || key.length < 10) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

// ── Pass 2: Gap analysis with document context ────────────────────────────────

function buildAnalysisPrompt(summary: DocumentSummary): string {
  return `You are a pharmaceutical GMP regulatory auditor conducting a gap analysis.

DOCUMENT CONTEXT:
- Type: ${summary.documentType}
- Purpose: ${summary.purpose}
- Scope: ${summary.scope}
- Covers: ${summary.covers.join("; ")}
- Excludes: ${summary.excludes.length ? summary.excludes.join("; ") : "nothing stated"}
- Key processes: ${summary.keyProcesses.join("; ")}
- GMP Activities: ${summary.gmpActivities.join("; ")}
- Risk Level: ${summary.riskLevel}

CRITICAL RULE — RELEVANCE GATE:
Before evaluating each [REQ-XX] block, ask: "Does this requirement apply to a ${summary.documentType} about ${summary.gmpActivities.slice(0, 3).join(", ")}?"
If NO → SKIP this requirement entirely. Do NOT include it in findings.
If YES → evaluate and classify as GAP, PARTIAL, or COMPLIANT.

CLASSIFICATION:
- GAP: Relevant requirement is completely absent or explicitly contradicted.
- PARTIAL: Relevant requirement is partially addressed but specific sub-elements are missing.
- COMPLIANT: Relevant requirement is explicitly addressed. Mark COMPLIANT when the document has a section satisfying the requirement, or when "have a procedure" is the requirement and this IS that procedure.

Always cite exact guideline section numbers (e.g., "ICH Q10, Section 3.2.3").
Finding field: 1–2 precise sentences. COMPLIANT → reference the SOP section. GAP/PARTIAL → name what is missing.

Return ONLY valid JSON, no markdown, no preamble:
{
  "findings": [
    {
      "section": "SOP section reference or 'Not addressed'",
      "status": "GAP" | "PARTIAL" | "COMPLIANT",
      "requirement": "The specific requirement with guideline section number",
      "finding": "1-2 sentence observation",
      "guidelineReference": "e.g. ICH Q10, Section 3.2.3",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}`;
}

export async function runAnalysis(
  sopText: string,
  summary: DocumentSummary,
  guidelineChunks: SearchResult[]
): Promise<GapFinding[]> {
  const systemPrompt = buildAnalysisPrompt(summary);

  const chunksText = guidelineChunks
    .map(
      (c, i) =>
        `[REQ-${String(i + 1).padStart(2, "0")}] ${c.metadata.guidelineReference || c.metadata.source} — ${c.metadata.section}\n${c.metadata.text}`
    )
    .join("\n\n---\n\n");

  const userMessage = `Audit the SOP below against each requirement block. SKIP any requirement that is not relevant to this document — do NOT produce a finding for irrelevant requirements.

=== SOP TEXT ===
${sopText.slice(0, 12000)}

=== REQUIREMENTS TO AUDIT ===
${chunksText}`;

  const content = await callLLMWithFallback(systemPrompt, userMessage, 8192);
  const parsed = JSON.parse(extractJSON(content));
  return parsed.findings || [];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runGapAnalysis(
  sopText: string,
  guidelineChunks: SearchResult[],
  guidelineNames: string[],
  documentName: string,
  summary: DocumentSummary
): Promise<GapReport> {
  let findings = await runAnalysis(sopText, summary, guidelineChunks);

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
