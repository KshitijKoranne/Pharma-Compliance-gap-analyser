import type { Guideline } from "./guidelines-registry";
import type { SearchResult } from "./vector";

// ── JSON extraction ─────────────────────────────────────────────────────────

function extractJSON(raw: string): string {
  let cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  const startObj = cleaned.indexOf("{");
  const startArr = cleaned.indexOf("[");
  let start: number;
  let closeChar: string;
  if (startObj === -1 && startArr === -1) throw new Error(`No JSON in LLM response: ${raw.slice(0, 120)}...`);
  if (startArr === -1 || (startObj !== -1 && startObj < startArr)) { start = startObj; closeChar = "}"; }
  else { start = startArr; closeChar = "]"; }
  const end = cleaned.lastIndexOf(closeChar);
  if (end <= start) throw new Error(`Malformed JSON in LLM response: ${raw.slice(0, 120)}...`);
  return cleaned.slice(start, end + 1);
}

// ── LLM helper ──────────────────────────────────────────────────────────────

async function callLLM(system: string, user: string, key: string, isOR: boolean, maxTok: number): Promise<string> {
  const url = isOR ? "https://openrouter.ai/api/v1/chat/completions" : "https://integrate.api.nvidia.com/v1/chat/completions";
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  if (isOR) { headers["HTTP-Referer"] = "https://kjrlabs.in"; headers["X-Title"] = "Pharma Compliance Gap Analyser"; }
  const res = await fetch(url, {
    method: "POST", headers,
    body: JSON.stringify({
      model: isOR ? "anthropic/claude-3.5-sonnet" : "meta/llama-3.3-70b-instruct",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.0, max_tokens: maxTok,
    }),
  });
  if (!res.ok) throw new Error(`LLM error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function llm(system: string, user: string, maxTok: number): Promise<string> {
  const nk = process.env.NVIDIA_API_KEY!;
  const ork = process.env.OPENROUTER_API_KEY;
  const hasOR = ork && ork !== "placeholder";
  try { return await callLLM(system, user, nk, false, maxTok); }
  catch (e) { console.warn("NVIDIA failed:", e); if (!hasOR) throw e; return await callLLM(system, user, ork!, true, maxTok); }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface GapFinding {
  section: string;
  status: "GAP" | "PARTIAL";
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

// ── Pass 1: Understand the document ─────────────────────────────────────────

export async function summariseDocument(sopText: string): Promise<DocumentSummary> {
  const beginChars = 5000;
  const endChars = 3000;
  let docSlice = sopText.length <= beginChars + endChars
    ? sopText
    : sopText.slice(0, beginChars) + "\n\n[... middle omitted ...]\n\n" + sopText.slice(-endChars);

  const system = `You are a pharmaceutical regulatory expert. Read the document and produce a structured understanding.
This application is intended for SYSTEM-LEVEL QA/GMP SOPs only, such as change control, deviation, CAPA, training, documentation control, validation governance, data integrity, supplier qualification, quality risk management, complaints, recalls, and pharmaceutical quality system procedures.
It is NOT intended for operational SOPs, manufacturing instructions, analytical test methods, batch records, equipment operation procedures, work instructions, protocols, specifications, or execution-level documents.
If the uploaded document appears to be outside the intended system SOP scope, clearly state that in purpose, scope, covers, excludes, and documentType. Do not force-fit operational documents into a system SOP assessment.
Read the ENTIRE text, especially the References section.

Return ONLY valid JSON, no markdown, no preamble:
{
  "title": "Document title as written",
  "documentType": "Classify as System SOP, Operational SOP, Policy, Protocol, Work Instruction, Batch Record, Specification, Analytical Method, Equipment Procedure, or Other",
  "purpose": "One sentence: what this document achieves; include an out-of-scope warning if it is not a system SOP",
  "scope": "One sentence: what operations/systems/products this covers; include whether it appears system-level or execution-level",
  "covers": ["Specific topics, processes, activities explicitly addressed"],
  "excludes": ["Things explicitly excluded or out of scope, including system SOP limitation where applicable"],
  "keyProcesses": ["Main procedural steps or workflow elements"],
  "riskLevel": "HIGH/MEDIUM/LOW",
  "regulatoryReferences": ["Every standard cited, e.g. ICH Q10, 21 CFR Part 211"],
  "applicableProductTypes": ["e.g. API, finished dosage form, biologics"],
  "gmpActivities": ["From: manufacturing, testing, packaging, labelling, storage, distribution, change control, deviation management, CAPA, validation, qualification, calibration, cleaning, stability, documentation, training, supplier management, complaints, recalls, risk management, quality system, data integrity, technology transfer"]
}`;

  const content = await llm(system, `=== DOCUMENT ===\n${docSlice}`, 1024);
  const p = JSON.parse(extractJSON(content));
  return {
    title: p.title || "Unknown", documentType: p.documentType || "Unknown",
    purpose: p.purpose || "Not determined", scope: p.scope || "Not determined",
    covers: p.covers || [], excludes: p.excludes || [],
    keyProcesses: p.keyProcesses || [], riskLevel: p.riskLevel || "HIGH",
    regulatoryReferences: p.regulatoryReferences || [],
    applicableProductTypes: p.applicableProductTypes || [],
    gmpActivities: p.gmpActivities || [],
  };
}

// ── Pass 1.5: Filter guidelines ─────────────────────────────────────────────

export async function filterGuidelines(
  summary: DocumentSummary, available: Guideline[], userIds: string[]
): Promise<string[]> {
  const candidates = available.filter((g) => userIds.includes(g.id));
  const registry = candidates.map((g) => `- ${g.id}: ${g.shortName} — ${g.description}`).join("\n");

  const system = `You are a pharmaceutical regulatory expert. Given a document summary and available guidelines, determine which guidelines are relevant for auditing this document.

APPLICATION SCOPE:
- This tool is for system-level QA/GMP SOPs only.
- Examples in scope: change control, deviation, CAPA, training, documentation control, validation governance, data integrity, supplier qualification, quality risk management, complaints, recalls, and pharmaceutical quality system procedures.
- Examples out of scope: operational SOPs, manufacturing instructions, analytical test methods, batch records, equipment operation procedures, work instructions, protocols, specifications, and execution-level documents.

RULES:
1. ONLY include guidelines directly relevant to the document's purpose and GMP activities.
2. Pharmacopoeial test guidelines (Q4B annexes) → only for analytical test documents.
3. Biotech guidelines (Q5A-Q5E) → only for biological product documents.
4. Stability guidelines (Q1A-Q1E) → only for stability protocols/studies.
5. Impurity guidelines (Q3A-Q3D) → only for impurity specs/methods.
6. If the document appears outside the system SOP scope, keep relevantGuidelineIds narrow and explain that limitation in reasoning.
7. When in doubt, EXCLUDE.

Return ONLY valid JSON: { "relevantGuidelineIds": ["ID1", "ID2"], "reasoning": "..." }`;

  const user = `DOCUMENT: ${summary.documentType} — "${summary.title}"
Purpose: ${summary.purpose}
Scope: ${summary.scope}
Covers: ${summary.covers.join("; ")}
Excludes: ${summary.excludes.length ? summary.excludes.join("; ") : "none"}
GMP activities: ${summary.gmpActivities.join("; ")}
Product types: ${summary.applicableProductTypes.join("; ")}
Cited references: ${summary.regulatoryReferences.length ? summary.regulatoryReferences.join("; ") : "none"}

AVAILABLE GUIDELINES:\n${registry}`;

  const content = await llm(system, user, 512);
  let ids: string[] = (JSON.parse(extractJSON(content)).relevantGuidelineIds || []);

  // Safety net: include guidelines the document itself cites
  const cited = summary.regulatoryReferences.map((r) => r.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const g of candidates) {
    if (ids.includes(g.id)) continue;
    const norm = g.shortName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cited.some((c) => norm.includes(c) || c.includes(norm))) ids.push(g.id);
  }

  const valid = new Set(candidates.map((g) => g.id));
  ids = ids.filter((id) => valid.has(id));
  if (ids.length === 0) return userIds;

  console.log(`Filter: ${userIds.length} → ${ids.length}`, ids);
  return ids;
}

// ── Pass 2: Per-guideline audit using REAL guideline chunks ─────────────────

function buildPerGuidelineAuditPrompt(summary: DocumentSummary, guidelineName: string): string {
  return `You are a pharmaceutical GMP regulatory auditor. You will receive:
1. A ${summary.documentType} document
2. Sections from ${guidelineName} (the actual guideline text)

Application scope: this tool is intended for system-level QA/GMP SOPs only. In-scope examples include change control, deviation, CAPA, training, documentation control, validation governance, data integrity, supplier qualification, quality risk management, complaints, recalls, and pharmaceutical quality system procedures. It is not intended for operational SOPs, manufacturing instructions, analytical methods, batch records, equipment operation procedures, work instructions, protocols, specifications, or other execution-level SOPs.

Your task: Read the document thoroughly. Read every guideline section provided. For each guideline section, determine if the document adequately addresses the requirements in that section. If the document appears to be outside the intended system SOP scope, make that limitation clear in findings and avoid creating irrelevant operational findings.

DOCUMENT BEING AUDITED:
- Type: ${summary.documentType}
- Purpose: ${summary.purpose}
- Scope: ${summary.scope}
- Covers: ${summary.covers.join("; ")}
- Excludes: ${summary.excludes.length ? summary.excludes.join("; ") : "nothing stated"}
- GMP Activities: ${summary.gmpActivities.join("; ")}

INSTRUCTIONS:
1. Read EVERY guideline section provided below.
2. For each section, identify specific requirements that this ${summary.documentType} should address.
3. ONLY report findings where the document has a GAP or PARTIAL compliance.
4. SKIP sections that are not relevant to this document's purpose — e.g. if auditing a Change Control SOP, skip sections about production equipment details or packaging operations.
5. SKIP requirements that the document fully satisfies — we only want problems.
6. Prefer system-level governance, QA process, responsibility, documentation, review, approval, risk management, records, effectiveness check, escalation, and lifecycle requirements over execution-level operational details.

CLASSIFICATION:
- GAP: The requirement is absent, or the document explicitly excludes/contradicts it, or the document only vaguely mentions the topic without addressing the specific requirement.
- PARTIAL: The requirement is partially addressed but specific sub-elements are missing.

Be strict: a vague mention is NOT compliance. The document must specifically address what the guideline requires.

Return ONLY valid JSON, no markdown, no preamble:
{
  "findings": [
    {
      "section": "Document section reference or 'Not addressed'",
      "status": "GAP" | "PARTIAL",
      "requirement": "The specific requirement from the guideline, with section number",
      "finding": "1-2 sentences: what exactly is missing or insufficient",
      "guidelineReference": "${guidelineName}, Section X.Y",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}`;
}

export async function auditAgainstGuideline(
  sopText: string,
  summary: DocumentSummary,
  guidelineName: string,
  chunks: SearchResult[]
): Promise<GapFinding[]> {
  if (chunks.length === 0) return [];

  const system = buildPerGuidelineAuditPrompt(summary, guidelineName);

  // Build guideline sections text from real chunks, sorted by section
  const sortedChunks = [...chunks].sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex);
  const sectionsText = sortedChunks
    .map((c, i) => `[SECTION ${i + 1}] ${c.metadata.section}\n${c.metadata.text}`)
    .join("\n\n---\n\n");

  const user = `=== DOCUMENT TEXT ===
${sopText.slice(0, 12000)}

=== ${guidelineName} — GUIDELINE SECTIONS (${chunks.length} sections) ===
${sectionsText}`;

  const content = await llm(system, user, 4096);
  const parsed = JSON.parse(extractJSON(content));
  return parsed.findings || [];
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function runGapAnalysis(
  sopText: string,
  summary: DocumentSummary,
  guidelineChunksMap: Map<string, { name: string; chunks: SearchResult[] }>,
  documentName: string
): Promise<GapReport> {
  // Run per-guideline audits in parallel
  const auditPromises = [...guidelineChunksMap.entries()].map(
    ([_id, { name, chunks }]) => auditAgainstGuideline(sopText, summary, name, chunks)
  );

  const allResults = await Promise.all(auditPromises);
  let findings = allResults.flat();

  // Deduplicate across guidelines
  const seen = new Set<string>();
  findings = findings.filter((f) => {
    const key = `${f.guidelineReference}||${f.requirement.slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const gaps = findings.filter((f) => f.status === "GAP");
  const partial = findings.filter((f) => f.status === "PARTIAL");
  const guidelineNames = [...guidelineChunksMap.values()].map((v) => v.name);

  return {
    overallScore: `${gaps.length} gaps, ${partial.length} partial — across ${guidelineNames.length} guidelines`,
    summary,
    criticalGaps: gaps,
    minorGaps: partial,
    compliantAreas: [],
    allFindings: findings,
    analysedAt: new Date().toISOString(),
    guidelines: guidelineNames,
    documentName,
  };
}
