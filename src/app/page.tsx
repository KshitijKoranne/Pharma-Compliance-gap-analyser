"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import type { GapFinding } from "@/lib/analyser";
import { GUIDELINES } from "@/lib/guidelines-registry";

const CATEGORIES = [
  { id: "ICH",    fullName: "ICH Quality Guidelines",           description: "Q1–Q14 series — stability, impurities, analytical validation, GMP, risk management, QbD, lifecycle" },
  { id: "EU_GMP", fullName: "EU Good Manufacturing Practice",   description: "EudraLex Volume 4 — sterile manufacturing, computerised systems, qualification & validation" },
  { id: "FDA",    fullName: "US FDA Regulations & Guidance",    description: "21 CFR regulations and FDA guidance — electronic records, CGMP, process validation" },
  { id: "WHO",    fullName: "WHO GMP Guidelines",               description: "World Health Organization GMP for pharmaceutical products" },
  { id: "ISO",    fullName: "ISO Standards",                    description: "ISO 9001, ISO 13485 — quality management systems for medical devices and pharma" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

interface GapReport {
  overallScore: string;
  criticalGaps: GapFinding[];
  minorGaps: GapFinding[];
  compliantAreas: GapFinding[];
  allFindings: GapFinding[];
  analysedAt: string;
  guidelines: string[];
  documentName: string;
}

export default function Home() {
  const [dark, setDark] = useState(false);
  const [selectedCats, setSelectedCats] = useState<Set<CategoryId>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GapReport | null>(null);
  const [visibleFindings, setVisibleFindings] = useState<GapFinding[]>([]);
  const [streamDone, setStreamDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "gaps" | "partial" | "compliant">("gaps");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function toggleCat(id: CategoryId) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getSelectedGuidelineIds() {
    return GUIDELINES.filter((g) => g.ingested && selectedCats.has(g.category as CategoryId)).map((g) => g.id);
  }

  function ingestedCount(catId: string) {
    return GUIDELINES.filter((g) => g.category === catId && g.ingested).length;
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".docx")) { setFile(f); setError(null); }
    else setError("Please upload a .docx file");
  }

  // Stream findings card by card with staggered delay
  function streamFindings(findings: GapFinding[]) {
    setVisibleFindings([]);
    setStreamDone(false);
    findings.forEach((finding, i) => {
      setTimeout(() => {
        setVisibleFindings((prev) => [...prev, finding]);
        if (i === findings.length - 1) setStreamDone(true);
      }, i * 180);
    });
  }

  async function handleAnalyse() {
    const ids = getSelectedGuidelineIds();
    if (!file || !ids.length) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setVisibleFindings([]);
    setStreamDone(false);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("guidelineIds", JSON.stringify(ids));
      const res = await fetch("/api/analyse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setReport(data.report);
      setActiveTab("gaps");
      setLoading(false);
      // Stream the gaps tab findings first
      streamFindings(data.report.criticalGaps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setLoading(false);
    }
  }

  function handleTabChange(tab: "all" | "gaps" | "partial" | "compliant") {
    setActiveTab(tab);
    if (!report) return;
    const map = { all: report.allFindings, gaps: report.criticalGaps, partial: report.minorGaps, compliant: report.compliantAreas };
    streamFindings(map[tab]);
  }

  const canRun = !!file && selectedCats.size > 0 && getSelectedGuidelineIds().length > 0;

  const tabCounts = report ? {
    gaps: report.criticalGaps.length,
    partial: report.minorGaps.length,
    compliant: report.compliantAreas.length,
    all: report.allFindings.length,
  } : { gaps: 0, partial: 0, compliant: 0, all: 0 };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/icon.png" alt="Compliance Gap Analyser" width={32} height={32} style={{ borderRadius: 8 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", lineHeight: 1.2 }}>Compliance Gap Analyser</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>by KJR Labs</div>
            </div>
          </div>
          <button onClick={toggleTheme} style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            {dark ? "☀ Light" : "◑ Dark"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8, color: "var(--text-primary)" }}>
            Regulatory Compliance Gap Analysis
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
            Upload your SOP or policy document and instantly check it against international pharmaceutical regulatory frameworks.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 20, alignItems: "start" }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Upload */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>Upload Document</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Supported format: .docx</div>
              </div>
              <div style={{ padding: 16 }}>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? "var(--accent)" : file ? "var(--success)" : "var(--border-strong)"}`,
                    borderRadius: 10, padding: "28px 20px", textAlign: "center", cursor: "pointer",
                    background: dragOver ? "var(--accent-subtle)" : file ? "var(--success-bg)" : "var(--bg-subtle)",
                    transition: "all 0.15s",
                  }}>
                  <input ref={fileRef} type="file" accept=".docx" style={{ display: "none" }}
                    onChange={(e) => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(null); } }} />
                  {file ? (
                    <div>
                      <Image src="/icon.png" alt="" width={36} height={36} style={{ margin: "0 auto 8px", opacity: 0.8 }} />
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--success)" }}>{file.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        {(file.size / 1024).toFixed(0)} KB —{" "}
                        <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setFile(null); }}>Remove</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 8, color: "var(--text-muted)" }}>↑</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>Drop your document here</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>or click to browse files</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Framework */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>Regulatory Framework</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Select one or more to check against</div>
              </div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {CATEGORIES.map((cat) => {
                  const count = ingestedCount(cat.id);
                  const selected = selectedCats.has(cat.id);
                  const available = count > 0;
                  return (
                    <button key={cat.id} onClick={() => available && toggleCat(cat.id)} disabled={!available}
                      style={{
                        width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 10,
                        cursor: available ? "pointer" : "not-allowed",
                        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "var(--accent-subtle)" : "var(--bg-subtle)",
                        opacity: available ? 1 : 0.35, transition: "all 0.15s",
                        fontFamily: "inherit",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            border: `2px solid ${selected ? "var(--accent)" : "var(--border-strong)"}`,
                            background: selected ? "var(--accent)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                          }}>
                            {selected && <span style={{ color: "white", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 14, color: selected ? "var(--accent)" : "var(--text-primary)" }}>
                            {cat.fullName}
                          </span>
                        </div>
                        {available && <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", marginLeft: 8 }}>{count} guidelines</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, paddingLeft: 28, lineHeight: 1.5 }}>
                        {cat.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <button onClick={handleAnalyse} disabled={!canRun || loading}
              style={{
                width: "100%", padding: 14, borderRadius: 10, border: "none",
                cursor: canRun && !loading ? "pointer" : "not-allowed",
                background: canRun && !loading ? "var(--accent)" : "var(--bg-subtle)",
                color: canRun && !loading ? "white" : "var(--text-muted)",
                fontFamily: "inherit", fontWeight: 600, fontSize: 15, transition: "all 0.15s",
                boxShadow: canRun && !loading ? "0 2px 12px rgba(29,78,216,0.35)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
              {loading ? (
                <>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                  Analysing document...
                </>
              ) : (
                <>
                  <Image src="/icon.png" alt="" width={20} height={20} style={{ filter: canRun ? "brightness(10)" : "none", opacity: canRun ? 1 : 0.4 }} />
                  Run Gap Analysis
                </>
              )}
            </button>

            {error && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)", fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div>
            {!report && !loading && (
              <div style={{ minHeight: 500, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <Image src="/icon.png" alt="" width={64} height={64} style={{ opacity: 0.15 }} />
                <div style={{ fontWeight: 500, fontSize: 16, color: "var(--text-muted)" }}>No analysis yet</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 280, textAlign: "center", lineHeight: 1.6 }}>
                  Upload a document and select a regulatory framework to get started
                </div>
              </div>
            )}

            {loading && (
              <div style={{ minHeight: 500, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <Image src="/icon.png" alt="" width={56} height={56} style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
                <div style={{ fontWeight: 500, fontSize: 16, color: "var(--text-secondary)" }}>Analysing your document</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Checking against {getSelectedGuidelineIds().length} guidelines — this takes 30–60 seconds</div>
              </div>
            )}

            {report && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Score cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "Gaps Found",  value: report.criticalGaps.length,  colorVar: "var(--danger)",  bgVar: "var(--danger-bg)",  borderVar: "var(--danger-border)" },
                    { label: "Partial",     value: report.minorGaps.length,     colorVar: "var(--warning)", bgVar: "var(--warning-bg)", borderVar: "var(--warning-border)" },
                    { label: "Compliant",   value: report.compliantAreas.length, colorVar: "var(--success)", bgVar: "var(--success-bg)", borderVar: "var(--success-border)" },
                  ].map((s) => (
                    <div key={s.label} style={{ background: s.bgVar, border: `1px solid ${s.borderVar}`, borderRadius: 12, padding: "16px", textAlign: "center" }}>
                      <div style={{ fontSize: 34, fontWeight: 700, color: s.colorVar, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: s.colorVar, marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Doc + guidelines meta */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Document</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginTop: 2 }}>{report.documentName}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {report.guidelines.slice(0, 5).map((g) => (
                      <span key={g} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--accent)", opacity: 0.85 }}>{g}</span>
                    ))}
                    {report.guidelines.length > 5 && (
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: "var(--bg-subtle)", color: "var(--text-muted)" }}>+{report.guidelines.length - 5} more</span>
                    )}
                  </div>
                </div>

                {/* Tabs + findings */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                    {([
                      { key: "gaps",      label: "Gaps",      count: tabCounts.gaps },
                      { key: "partial",   label: "Partial",   count: tabCounts.partial },
                      { key: "compliant", label: "Compliant", count: tabCounts.compliant },
                      { key: "all",       label: "All",       count: tabCounts.all },
                    ] as const).map((tab) => (
                      <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                        style={{
                          flex: 1, padding: "13px 8px", border: "none", cursor: "pointer", fontFamily: "inherit",
                          fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400, transition: "all 0.15s",
                          background: activeTab === tab.key ? "var(--bg-subtle)" : "transparent",
                          color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-muted)",
                          borderBottom: `2px solid ${activeTab === tab.key ? "var(--accent)" : "transparent"}`,
                        }}>
                        {tab.label} <span style={{ fontSize: 11, opacity: 0.65 }}>({tab.count})</span>
                      </button>
                    ))}
                  </div>

                  <div style={{ maxHeight: 560, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {visibleFindings.length === 0 && streamDone && (
                      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                        No findings in this category
                      </div>
                    )}
                    {visibleFindings.map((f, i) => {
                      const isGap = f.status === "GAP";
                      const isPartial = f.status === "PARTIAL";
                      const borderColor = isGap ? "var(--danger-border)" : isPartial ? "var(--warning-border)" : "var(--success-border)";
                      const bgColor = isGap ? "var(--danger-bg)" : isPartial ? "var(--warning-bg)" : "var(--success-bg)";
                      const textColor = isGap ? "var(--danger)" : isPartial ? "var(--warning)" : "var(--success)";
                      const label = isGap ? "Gap" : isPartial ? "Partial" : "Compliant";
                      return (
                        <div key={i} style={{
                          border: `1px solid ${borderColor}`, background: bgColor, borderRadius: 10, padding: "14px 16px",
                          animation: "fadeSlideIn 0.3s ease forwards", opacity: 0,
                          animationDelay: "0ms", animationFillMode: "forwards",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700,
                                color: textColor, padding: "3px 10px", borderRadius: 20,
                                border: `1px solid ${borderColor}`, background: "transparent",
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: textColor, display: "inline-block" }} />
                                {label}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                                {f.guidelineReference}
                              </span>
                            </div>
                            {f.confidence === "LOW" && (
                              <span style={{ fontSize: 11, color: "var(--warning)", background: "var(--warning-bg)", padding: "2px 8px", borderRadius: 20, border: "1px solid var(--warning-border)" }}>
                                Verify manually
                              </span>
                            )}
                          </div>
                          {f.section && f.section !== "NONE" && f.section !== "General" && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                              {f.section}
                            </div>
                          )}
                          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.65, marginBottom: 10 }}>
                            <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>Requirement: </span>
                            {f.requirement}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, paddingTop: 10, borderTop: `1px solid ${borderColor}` }}>
                            <span style={{ fontWeight: 700 }}>Finding: </span>
                            {f.finding}
                          </div>
                        </div>
                      );
                    })}

                    {/* Typing indicator while streaming */}
                    {!streamDone && visibleFindings.length < (report?.allFindings.length || 0) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 4px" }}>
                        {[0, 1, 2].map((i) => (
                          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
                        ))}
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>Loading findings...</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                  Analysed {new Date(report.analysedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.92); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 900px) {
          main > div > div:first-child { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
