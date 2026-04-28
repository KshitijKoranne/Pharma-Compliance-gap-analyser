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

export interface Requirement {
  id: string;
  guidelineReference: string;
  section: string;
  requirement: string;
  whyRelevant: string;
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
    if (
      citedRefs.some(
        (ref) =>
          shortLower.includes(ref) ||
          ref.includes(shortLower) ||
          shortLower.replace(/[^a-z0-9]/g, "").includes(ref.replace(/[^a-z0-9]/g, ""))
      )
    ) {
      filteredIds.push(g.id);
    }
  }

  const validIds = new Set(candidates.map((g) => g.id));
  filteredIds = filteredIds.filter((id) => validIds.has(id));

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

// ── Pass 2: Generate applicable requirements (LLM-driven) ───────────────────

const REQUIREMENT_GEN_PROMPT = `You are a pharmaceutical regulatory compliance expert with deep knowledge of ICH, EU GMP, FDA, and WHO guidelines.

Given a document summary and a list of applicable guidelines, identify the SPECIFIC requirements from those guidelines that this document SHOULD address.

CRITICAL RULES:
1. Only list requirements that are DIRECTLY relevant to the document's purpose and scope.
2. For each guideline, focus on the SECTIONS that relate to the document's GMP activities — not the entire guideline.
   - For a Change Control SOP audited against ICH Q7: focus on Section 12 (Change Control), Section 2.1 (Quality Management principles), Section 6 (Documentation) — NOT Section 4 (Buildings), Section 5 (Process Equipment), Section 8 (Production).
   - For a Stability Protocol audited against ICH Q1A: focus on storage conditions, testing intervals, data evaluation — NOT manufacturing controls.
3. Include exact section numbers from the guideline.
4. Aim for 15–25 requirements that are genuinely applicable. Quality over quantity.
5. Each requirement should be specific and auditable — not vague.

Return ONLY valid JSON, no markdown, no preamble:
{
  "requirements": [
    {
      "id": "REQ-01",
      "guidelineReference": "ICH Q10, Section 3.2.4",
      "section": "3.2.4 Change Management",
      "requirement": "A change management system should be established to evaluate proposed changes that might affect product quality, regulatory compliance, or patient safety.",
      "whyRelevant": "Core change control requirement — directly addresses this SOP's purpose"
    }
  ]
}`;

export async function generateRequirements(
  summary: DocumentSummary,
  guidelineNames: string[]
): Promise<Requirement[]> {
  const userMessage = `DOCUMENT SUMMARY:
- Title: ${summary.title}
- Type: ${summary.documentType}
- Purpose: ${summary.purpose}
- Scope: ${summary.scope}
- Covers: ${summary.covers.join("; ")}
- Excludes: ${summary.excludes.length ? summary.excludes.join("; ") : "nothing stated"}
- Key processes: ${summary.keyProcesses.join("; ")}
- GMP Activities: ${summary.gmpActivities.join("; ")}
- Product types: ${summary.applicableProductTypes.join("; ")}

APPLICABLE GUIDELINES TO DRAW REQUIREMENTS FROM:
${guidelineNames.join(", ")}

List 15–25 specific, auditable requirements from these guidelines that this ${summary.documentType} should address. Focus on the sections of each guideline that relate to ${summary.gmpActivities.slice(0, 5).join(", ")}.`;

  const content = await callLLMWithFallback(
    REQUIREMENT_GEN_PROMPT,
    userMessage,
    4096
  );

  const parsed = JSON.parse(extractJSON(content));
  const reqs: Requirement[] = parsed.requirements || [];

  // Assign IDs if missing
  return reqs.map((r, i) => ({
    ...r,
    id: r.id || `REQ-${String(i + 1).padStart(2, "0")}`,
  }));
}

// ── Pass 3: Audit SOP against generated requirements ─────────────────────────

function buildAuditPrompt(summary: DocumentSummary): string {
  return `You are a pharmaceutical GMP regulatory auditor. You will receive:
1. The full text of a ${summary.documentType}
2. A list of specific regulatory requirements this document should address

Your job: evaluate whether the document satisfies EACH requirement.

DOCUMENT CONTEXT:
- Type: ${summary.documentType}
- Purpose: ${summary.purpose}
- Scope: ${summary.scope}
- Covers: ${summary.covers.join("; ")}
- Excludes: ${summary.excludes.length ? summary.excludes.join("; ") : "nothing stated"}

CLASSIFICATION RULES (apply strictly):

GAP — The requirement is:
- Completely absent from the document
- The document explicitly excludes or contradicts it
- The document mentions the topic generically but does NOT address the SPECIFIC regulatory requirement
- Example: SOP mentions "risk evaluation" but does NOT reference specific risk tools (FMEA, fault tree, risk matrix) → GAP for an ICH Q9 risk tool requirement

PARTIAL — The requirement is:
- Genuinely touched upon but specific mandatory sub-elements are missing
- The general topic is covered but not with the specificity the guideline demands
- Example: SOP has "impact assessment" section but does not explicitly consider patient safety → PARTIAL

COMPLIANT — The requirement is:
- EXPLICITLY and SPECIFICALLY addressed in the document
- You can cite a specific section/paragraph that satisfies it
- The content matches what the guideline actually requires, not just the topic area

IMPORTANT:
- Read the ENTIRE SOP text before classifying. Requirements may be addressed in unexpected sections.
- "This SOP cross-references another SOP" counts as PARTIAL at best — the requirement should be addressed HERE or explicitly delegated with a specific cross-reference.
- If the document EXCLUDES something that a guideline REQUIRES (e.g. excludes outsourced activities when ICH Q7/Q10 requires them in scope), that is a GAP.

Finding field: 1–2 precise sentences. COMPLIANT → cite the SOP section. GAP/PARTIAL → state EXACTLY what is missing or insufficient.

Return ONLY valid JSON, no markdown, no preamble, no trailing text:
{
  "findings": [
    {
      "section": "SOP section reference or 'Not addressed'",
      "status": "GAP" | "PARTIAL" | "COMPLIANT",
      "requirement": "The requirement text as given",
      "finding": "1-2 sentence precise observation",
      "guidelineReference": "e.g. ICH Q10, Section 3.2.4",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}`;
}

export async function auditDocument(
  sopText: string,
  summary: DocumentSummary,
  requirements: Requirement[]
): Promise<GapFinding[]> {
  const systemPrompt = buildAuditPrompt(summary);

  const reqsText = requirements
    .map(
      (r) =>
        `[${r.id}] ${r.guidelineReference} — ${r.section}\nRequirement: ${r.requirement}\nWhy relevant: ${r.whyRelevant}`
    )
    .join("\n\n---\n\n");

  const userMessage = `Audit the document below against EVERY requirement listed. Produce exactly one finding per requirement. Do not skip any.

=== DOCUMENT TEXT ===
${sopText.slice(0, 14000)}

=== REQUIREMENTS TO AUDIT (${requirements.length} total) ===
${reqsText}`;

  const content = await callLLMWithFallback(systemPrompt, userMessage, 8192);
  const parsed = JSON.parse(extractJSON(content));
  return parsed.findings || [];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runGapAnalysis(
  sopText: string,
  guidelineNames: string[],
  documentName: string,
  summary: DocumentSummary,
  requirements: Requirement[]
): Promise<GapReport> {
  let findings = await auditDocument(sopText, summary, requirements);

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
