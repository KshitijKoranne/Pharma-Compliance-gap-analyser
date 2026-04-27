"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import type { GapReport, GapFinding } from "@/lib/analyser";
import { GUIDELINES } from "@/lib/guidelines-registry";

const CATEGORIES = [
  { id: "ICH",    fullName: "ICH Quality Guidelines",         description: "Q1–Q14 series — stability, impurities, analytical validation, GMP, risk management, QbD, lifecycle" },
  { id: "EU_GMP", fullName: "EU Good Manufacturing Practice", description: "EudraLex Volume 4 — sterile manufacturing, computerised systems, qualification & validation" },
  { id: "FDA",    fullName: "US FDA Regulations & Guidance",  description: "21 CFR regulations and FDA guidance — electronic records, CGMP, process validation" },
  { id: "WHO",    fullName: "WHO GMP Guidelines",             description: "World Health Organization good manufacturing practices for pharmaceutical products" },
  { id: "ISO",    fullName: "ISO Standards",                  description: "ISO 9001, ISO 13485 — quality management systems for medical devices and pharma" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

// Animated finding card
function FindingCard({ finding, index }: { finding: GapFinding; index: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 120);
    return () => clearTimeout(t);
  }, [index]);

  const isGap = finding.status === "GAP";
  const isPartial = finding.status === "PARTIAL";
  const isCompliant = finding.status === "COMPLIANT";

  const colors = isGap
    ? { border: "var(--danger-border)", bg: "var(--danger-bg)", label: "var(--danger)", dot: "#ef4444" }
    : isPartial
    ? { border: "var(--warning-border)", bg: "var(--warning-bg)", label: "var(--warning)", dot: "#f59e0b" }
    : { border: "var(--success-border)", bg: "var(--success-bg)", label: "var(--success)", dot: "#22c55e" };

  const statusLabel = isGap ? "Gap" : isPartial ? "Partial" : "Compliant";

  return (
    <div style={{
      border: `1px solid ${colors.border}`,
      background: colors.bg,
      borderRadius: 10,
      padding: "14px 16px",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(10px)",
      transition: "opacity 0.35s ease, transform 0.35s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, fontWeight: 700, color: colors.label,
            padding: "3px 9px", borderRadius: 20,
            border: `1px solid ${colors.border}`, background: "transparent",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.dot, display: "inline-block", flexShrink: 0 }} />
            {statusLabel}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "'DM Mono', monospace" }}>
            {finding.guidelineReference}
          </span>
        </div>
        {finding.confidence === "LOW" && (
          <span style={{ fontSize: 11, color: "var(--warning)", background: "var(--warning-bg)", padding: "2px 8px", borderRadius: 20, border: "1px solid var(--warning-border)" }}>
            Verify manually
          </span>
        )}
      </div>

      {finding.section && finding.section !== "NONE" && finding.section !== "General" && (
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          {finding.section}
        </div>
      )}

      <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.65, marginBottom: 10 }}>
        <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>Requirement: </span>
        {finding.requirement}
      </div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
        <span style={{ fontWeight: 700 }}>Finding: </span>
        {finding.finding}
      </div>
    </div>
  );
}

export default function Home() {
  const [dark, setDark] = useState(false);
  const [selectedCats, setSelectedCats] = useState<Set<CategoryId>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GapReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gaps" | "partial" | "compliant" | "all">("gaps");
  const fileRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

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

  async function handleAnalyse() {
    const ids = getSelectedGuidelineIds();
    if (!file || !ids.length) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("guidelineIds", JSON.stringify(ids));
      const res = await fetch("/api/analyse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setReport(data.report);
      setActiveTab(data.report.criticalGaps.length > 0 ? "gaps" : "partial");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const tabFindings: Record<string, GapFinding[]> = report
    ? { gaps: report.criticalGaps, partial: report.minorGaps, compliant: report.compliantAreas, all: report.allFindings }
    : { gaps: [], partial: [], compliant: [], all: [] };

  const canRun = !!file && selectedCats.size > 0 && getSelectedGuidelineIds().length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)", boxShadow: "var(--shadow-sm)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/icon-50.png" alt="Compliance Gap Analyser" width={28} height={28} style={{ borderRadius: 6 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.2 }}>Compliance Gap Analyser</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>by KJR Labs</div>
            </div>
          </div>
          <button onClick={toggleTheme} style={{
            border: "1px solid var(--border)", background: "var(--bg-subtle)", borderRadius: 8,
            padding: "6px 14px", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13,
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          }}>
            {dark ? "☀ Light" : "◑ Dark"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 10px" }}>
            Regulatory Compliance Gap Analysis
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
            Upload your SOP or policy document and instantly identify compliance gaps against international pharmaceutical regulatory frameworks.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24, alignItems: "start" }}
          className="analysis-grid">

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Upload */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Upload Document</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Supported: .docx (Word document)</div>
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
                    <>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--success)" }}>{file.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        {(file.size / 1024).toFixed(0)} KB —{" "}
                        <span style={{ color: "var(--accent)", cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); setFile(null); setReport(null); }}>Remove</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 28, color: "var(--text-muted)", marginBottom: 8 }}>↑</div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: "var(--text-secondary)" }}>Drop your document here</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>or click to browse files</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Framework */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Regulatory Framework</div>
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
                        textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: available ? "pointer" : "not-allowed",
                        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "var(--accent-subtle)" : "var(--bg-subtle)",
                        opacity: available ? 1 : 0.35, transition: "all 0.15s", width: "100%",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            border: `2px solid ${selected ? "var(--accent)" : "var(--border-strong)"}`,
                            background: selected ? "var(--accent)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                          }}>
                            {selected && <span style={{ color: "white", fontSize: 11, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 14, color: selected ? "var(--accent)" : "var(--text-primary)" }}>
                            {cat.fullName}
                          </span>
                        </div>
                        {available && <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", marginLeft: 8 }}>{count}</span>}
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
                padding: "14px", borderRadius: 12, border: "none", fontFamily: "inherit",
                fontWeight: 700, fontSize: 15, cursor: canRun && !loading ? "pointer" : "not-allowed",
                background: canRun && !loading ? "var(--accent)" : "var(--bg-subtle)",
                color: canRun && !loading ? "white" : "var(--text-muted)",
                transition: "all 0.15s",
                boxShadow: canRun && !loading ? "0 2px 12px rgba(29,78,216,0.25)" : "none",
              }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                  Analysing document...
                </span>
              ) : "Run Gap Analysis →"}
            </button>

            {error && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)", fontSize: 13, lineHeight: 1.5 }}>
                {error}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div ref={resultsRef}>
            {!report && !loading && (
              <div style={{
                minHeight: 500, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14,
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14,
                boxShadow: "var(--shadow-sm)",
              }}>
                <Image src="/icon-50.png" alt="" width={48} height={48} style={{ opacity: 0.25 }} />
                <div style={{ fontWeight: 500, color: "var(--text-muted)", fontSize: 15 }}>No analysis yet</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 260, textAlign: "center", lineHeight: 1.6 }}>
                  Upload a document and select a regulatory framework to get started
                </div>
              </div>
            )}

            {loading && (
              <div style={{
                minHeight: 500, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14,
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14,
              }}>
                <Image src="/icon-50.png" alt="" width={48} height={48} style={{ opacity: 0.5, animation: "pulse 1.5s ease-in-out infinite" }} />
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-secondary)" }}>Analysing document</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Checking against regulatory requirements...</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", opacity: 0.6 }}>This typically takes 30–60 seconds</div>
              </div>
            )}

            {report && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Score cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "Gaps Found",  value: report.criticalGaps.length,  color: "var(--danger)",  bg: "var(--danger-bg)",  border: "var(--danger-border)" },
                    { label: "Partial",     value: report.minorGaps.length,     color: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
                    { label: "Compliant",   value: report.compliantAreas.length, color: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" },
                  ].map((s, i) => (
                    <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "18px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: 34, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: s.color, marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Meta info */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Document</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{report.documentName}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {report.guidelines.slice(0, 5).map((g) => (
                      <span key={g} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--accent)", opacity: 0.8, fontWeight: 500 }}>{g}</span>
                    ))}
                    {report.guidelines.length > 5 && (
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: "var(--bg-subtle)", color: "var(--text-muted)" }}>+{report.guidelines.length - 5} more</span>
                    )}
                  </div>
                </div>

                {/* Tabs + Findings */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                    {([
                      { key: "gaps",      label: "Gaps",      count: tabFindings.gaps.length,      color: "var(--danger)" },
                      { key: "partial",   label: "Partial",   count: tabFindings.partial.length,   color: "var(--warning)" },
                      { key: "compliant", label: "Compliant", count: tabFindings.compliant.length, color: "var(--success)" },
                      { key: "all",       label: "All",       count: tabFindings.all.length,       color: "var(--text-secondary)" },
                    ] as const).map((tab) => (
                      <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        style={{
                          flex: 1, padding: "13px 8px", border: "none", cursor: "pointer", fontFamily: "inherit",
                          fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 400,
                          background: activeTab === tab.key ? "var(--bg-subtle)" : "transparent",
                          color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-muted)",
                          borderBottom: `2px solid ${activeTab === tab.key ? tab.color : "transparent"}`,
                          transition: "all 0.15s",
                        }}>
                        {tab.label}
                        <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 600, color: activeTab === tab.key ? tab.color : "var(--text-muted)" }}>
                          ({tab.count})
                        </span>
                      </button>
                    ))}
                  </div>

                  <div style={{ padding: 14, maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    {tabFindings[activeTab].length === 0 ? (
                      <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                        No {activeTab} findings
                      </div>
                    ) : tabFindings[activeTab].map((f, i) => (
                      <FindingCard key={`${activeTab}-${i}`} finding={f} index={i} />
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                  Analysed {new Date(report.analysedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @media (max-width: 860px) {
          .analysis-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
