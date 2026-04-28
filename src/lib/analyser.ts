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

function buildRequirementGenPrompt(summary: DocumentSummary): string {
  return `You are a pharmaceutical regulatory compliance expert. You have deep, thorough knowledge of every guideline listed below.

Given a document summary and the applicable guidelines, identify ALL specific requirements from those guidelines that this document SHOULD address.

DOCUMENT BEING AUDITED:
- Type: ${summary.documentType}
- Purpose: ${summary.purpose}
- Scope: ${summary.scope}
- Covers: ${summary.covers.join("; ")}
- Excludes: ${summary.excludes.length ? summary.excludes.join("; ") : "nothing stated"}
- Key processes: ${summary.keyProcesses.join("; ")}
- GMP Activities: ${summary.gmpActivities.join("; ")}
- Product types: ${summary.applicableProductTypes.join("; ")}

HOW TO SELECT REQUIREMENTS:
1. For each applicable guideline, identify the SECTIONS that are relevant to "${summary.gmpActivities.join(", ")}". Ignore sections about unrelated topics.
2. From those sections, extract every specific, auditable requirement.
3. Include exact section numbers from the guideline.
4. Pay special attention to these commonly missed areas:
   - Scope coverage: does the guideline require certain activities (e.g. outsourced operations) to be in scope?
   - Risk management tools: does the guideline require specific methodologies (FMEA, fault tree, risk matrix)?
   - Patient safety: is it required as a primary consideration?
   - Management oversight: does the guideline require management review or senior management involvement?
   - Post-action reviews: effectiveness checks, periodic reviews, trending
   - Emergency or expedited provisions
   - Re-validation or re-qualification triggers
   - Record retention periods with specific durations
   - Cross-system linkages (e.g. CAPA, deviation, training)
   - Continuous improvement and knowledge management
5. Aim for 20–30 requirements. Be thorough — it is better to include a borderline requirement than miss a real gap.
6. Each requirement must be specific and auditable — not vague.

Return ONLY valid JSON, no markdown, no preamble:
{
  "requirements": [
    {
      "id": "REQ-01",
      "guidelineReference": "Guideline name, Section X.Y.Z",
      "section": "X.Y.Z Section Title",
      "requirement": "The specific requirement statement",
      "whyRelevant": "Brief explanation of why this applies to this document"
    }
  ]
}`;
}

export async function generateRequirements(
  summary: DocumentSummary,
  guidelineNames: string[]
): Promise<Requirement[]> {
  const systemPrompt = buildRequirementGenPrompt(summary);

  const userMessage = `APPLICABLE GUIDELINES TO DRAW REQUIREMENTS FROM:
${guidelineNames.join(", ")}

Identify 20–30 specific, auditable requirements from these guidelines that this ${summary.documentType} about "${summary.purpose}" should address. Be thorough.`;

  const content = await callLLMWithFallback(
    systemPrompt,
    userMessage,
    6144
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

Your job: identify GAPS and PARTIAL compliance for each requirement. You are looking for what is MISSING or INSUFFICIENT — not what is compliant.

DOCUMENT CONTEXT:
- Type: ${summary.documentType}
- Purpose: ${summary.purpose}
- Scope: ${summary.scope}
- Covers: ${summary.covers.join("; ")}
- Excludes: ${summary.excludes.length ? summary.excludes.join("; ") : "nothing stated"}

CLASSIFICATION RULES (apply strictly):

GAP — Use when:
- The requirement is completely absent from the document
- The document explicitly excludes or contradicts something the guideline requires
- The document mentions the topic generically but does NOT address the SPECIFIC regulatory requirement
- Example: SOP says "risk evaluation" but does NOT mention specific risk tools (FMEA, fault tree, risk matrix) → GAP for a risk tool requirement

PARTIAL — Use when:
- The requirement is genuinely touched upon but specific mandatory sub-elements are missing
- The general topic is covered but not with the specificity the guideline demands
- A cross-reference to another SOP exists but the requirement is not addressed within THIS document
- Example: SOP has "impact assessment" section but does not explicitly consider patient safety → PARTIAL

If a requirement IS fully and explicitly addressed in the document, simply SKIP it — do not include it in findings. We only want gaps and partial compliance.

IMPORTANT:
- Read the ENTIRE document text before classifying. Requirements may be addressed in unexpected sections.
- If the document EXCLUDES something that a guideline REQUIRES (e.g. excludes outsourced activities), that is a GAP.
- Be strict: a vague mention of a topic is NOT compliance. The document must specifically address what the guideline requires.

Finding field: 1–2 precise sentences stating EXACTLY what is missing or insufficient.

Return ONLY valid JSON, no markdown, no preamble, no trailing text:
{
  "findings": [
    {
      "section": "SOP section where partial coverage exists, or 'Not addressed'",
      "status": "GAP" | "PARTIAL",
      "requirement": "The requirement text as given",
      "finding": "1-2 sentence observation of what is missing",
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

  const userMessage = `Audit the document below against every requirement listed. Only report GAP and PARTIAL findings — skip requirements that are fully addressed.

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

  return {
    overallScore: `${criticalGaps.length} gaps, ${minorGaps.length} partial — out of ${requirements.length} requirements checked`,
    summary,
    criticalGaps,
    minorGaps,
    compliantAreas: [],
    allFindings: findings,
    analysedAt: new Date().toISOString(),
    guidelines: guidelineNames,
    documentName,
  };
}
