"use client";

import { useState, useRef, useEffect } from "react";
import type { GapReport, GapFinding } from "@/lib/analyser";
import { GUIDELINES } from "@/lib/guidelines-registry";

const CATEGORIES = [
  {
    id: "ICH",
    label: "ICH",
    fullName: "ICH Quality Guidelines",
    description: "Q1–Q14 series — stability, impurities, analytical validation, GMP, risk management, QbD, lifecycle",
    icon: "◈",
  },
  {
    id: "EU_GMP",
    label: "EU GMP",
    fullName: "EU Good Manufacturing Practice",
    description: "EudraLex Volume 4 — sterile manufacturing, computerised systems, qualification & validation",
    icon: "◉",
  },
  {
    id: "FDA",
    label: "US FDA",
    fullName: "US FDA Regulations & Guidance",
    description: "21 CFR regulations and FDA guidance — electronic records, CGMP, process validation",
    icon: "◎",
  },
  {
    id: "WHO",
    label: "WHO",
    fullName: "WHO GMP Guidelines",
    description: "World Health Organization good manufacturing practices for pharmaceutical products",
    icon: "○",
  },
  {
    id: "ISO",
    label: "ISO",
    fullName: "ISO Standards",
    description: "ISO 9001, ISO 13485 — quality management systems for medical devices and pharma",
    icon: "◇",
  },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

const STATUS_META = {
  COMPLIANT: { label: "Compliant", dot: "bg-green-500" },
  PARTIAL:   { label: "Partial",   dot: "bg-amber-500" },
  GAP:       { label: "Gap",       dot: "bg-red-500" },
};

export default function Home() {
  const [dark, setDark] = useState(false);
  const [selectedCats, setSelectedCats] = useState<Set<CategoryId>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GapReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "gaps" | "partial" | "compliant">("gaps");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
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
    if (f?.name.endsWith(".docx")) setFile(f);
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
      setActiveTab("gaps");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const tabFindings: Record<string, GapFinding[]> = report
    ? { all: report.allFindings, gaps: report.criticalGaps, partial: report.minorGaps, compliant: report.compliantAreas }
    : { all: [], gaps: [], partial: [], compliant: [] };

  const canRun = !!file && selectedCats.size > 0 && getSelectedGuidelineIds().length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)", boxShadow: "var(--shadow-sm)" }}
        className="sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ background: "var(--accent)", borderRadius: 8 }} className="w-8 h-8 flex items-center justify-center">
              <span className="text-white text-xs font-bold">GX</span>
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Compliance Gap Analyser</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>by KJR Labs</div>
            </div>
          </div>
          <button onClick={toggleTheme}
            style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}
            className="flex items-center gap-2 transition-all hover:opacity-80">
            {dark ? "☀ Light" : "◑ Dark"}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Regulatory Compliance Gap Analysis
          </h1>
          <p className="text-base" style={{ color: "var(--text-secondary)", maxWidth: 520, margin: "0 auto" }}>
            Upload your SOP or policy document and check it against international pharmaceutical regulatory frameworks instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">

          {/* LEFT */}
          <div className="space-y-4">

            {/* Upload */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>Upload Document</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Supported format: .docx</div>
              </div>
              <div style={{ padding: 16 }}>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? "var(--accent)" : file ? "var(--success)" : "var(--border-strong)"}`,
                    borderRadius: 10,
                    padding: "28px 20px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: dragOver ? "var(--accent-subtle)" : file ? "var(--success-bg)" : "var(--bg-subtle)",
                    transition: "all 0.15s",
                  }}>
                  <input ref={fileRef} type="file" accept=".docx" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(null); } }} />
                  {file ? (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>✓</div>
                      <div className="font-medium text-sm" style={{ color: "var(--success)" }}>{file.name}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{(file.size / 1024).toFixed(0)} KB —{" "}
                        <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                          Remove
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 28, marginBottom: 8, color: "var(--text-muted)" }}>↑</div>
                      <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Drop your document here</div>
                      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>or click to browse files</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Framework */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>Regulatory Framework</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Select one or more to check against</div>
              </div>
              <div style={{ padding: 12 }} className="space-y-2">
                {CATEGORIES.map((cat) => {
                  const count = ingestedCount(cat.id);
                  const selected = selectedCats.has(cat.id);
                  const available = count > 0;
                  return (
                    <button key={cat.id} onClick={() => available && toggleCat(cat.id)} disabled={!available}
                      style={{
                        width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: available ? "pointer" : "not-allowed",
                        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "var(--accent-subtle)" : available ? "var(--bg-subtle)" : "var(--bg-subtle)",
                        opacity: available ? 1 : 0.4, transition: "all 0.15s",
                      }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected ? "var(--accent)" : "var(--border-strong)"}`,
                            background: selected ? "var(--accent)" : "transparent", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                          }}>
                            {selected && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                          </div>
                          <div>
                            <div className="font-semibold text-sm" style={{ color: selected ? "var(--accent)" : "var(--text-primary)" }}>
                              {cat.fullName}
                            </div>
                          </div>
                        </div>
                        {available && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", marginLeft: 8 }}>
                            {count} guidelines
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-1.5" style={{ color: "var(--text-muted)", paddingLeft: 30, lineHeight: 1.5 }}>
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
                width: "100%", padding: "14px", borderRadius: 10, border: "none", cursor: canRun && !loading ? "pointer" : "not-allowed",
                background: canRun && !loading ? "var(--accent)" : "var(--bg-subtle)",
                color: canRun && !loading ? "white" : "var(--text-muted)",
                fontFamily: "inherit", fontWeight: 600, fontSize: 15, transition: "all 0.15s",
                boxShadow: canRun && !loading ? "0 2px 8px rgba(29,78,216,0.3)" : "none",
              }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                  Analysing document...
                </span>
              ) : "Run Gap Analysis"}
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
              <div style={{ minHeight: 480, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: 40, color: "var(--border-strong)" }}>◎</div>
                <div className="font-medium" style={{ color: "var(--text-muted)" }}>No analysis yet</div>
                <div className="text-sm" style={{ color: "var(--text-muted)", maxWidth: 280, textAlign: "center" }}>
                  Upload a document and select a regulatory framework to get started
                </div>
              </div>
            )}

            {loading && (
              <div style={{ minHeight: 480, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <div className="font-medium" style={{ color: "var(--text-secondary)" }}>Running analysis</div>
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>This typically takes 30–60 seconds</div>
              </div>
            )}

            {report && (
              <div className="space-y-4">
                {/* Score cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Gaps Found", value: report.criticalGaps.length, color: "var(--danger)", bg: "var(--danger-bg)", border: "var(--danger-border)" },
                    { label: "Partial", value: report.minorGaps.length, color: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
                    { label: "Compliant", value: report.compliantAreas.length, color: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" },
                  ].map((s) => (
                    <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div className="text-xs mt-1 font-medium" style={{ color: s.color }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Meta */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", boxShadow: "var(--shadow-sm)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Document</div>
                      <div className="text-sm font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>{report.documentName}</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {report.guidelines.slice(0, 4).map((g) => (
                        <span key={g} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--accent)", opacity: 0.8 }}>
                          {g}
                        </span>
                      ))}
                      {report.guidelines.length > 4 && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                          +{report.guidelines.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                    {([
                      { key: "gaps",      label: "Gaps",      count: tabFindings.gaps.length },
                      { key: "partial",   label: "Partial",   count: tabFindings.partial.length },
                      { key: "compliant", label: "Compliant", count: tabFindings.compliant.length },
                      { key: "all",       label: "All",       count: tabFindings.all.length },
                    ] as const).map((tab) => (
                      <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        style={{
                          flex: 1, padding: "12px 8px", border: "none", cursor: "pointer", fontFamily: "inherit",
                          fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400, transition: "all 0.15s",
                          background: activeTab === tab.key ? "var(--bg-subtle)" : "transparent",
                          color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-muted)",
                          borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
                        }}>
                        {tab.label}
                        <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>({tab.count})</span>
                      </button>
                    ))}
                  </div>

                  {/* Findings list */}
                  <div style={{ maxHeight: 520, overflowY: "auto", padding: 12 }} className="space-y-2">
                    {tabFindings[activeTab].length === 0 ? (
                      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                        No {activeTab} findings
                      </div>
                    ) : tabFindings[activeTab].map((f, i) => {
                      const meta = STATUS_META[f.status];
                      const borderColor = f.status === "COMPLIANT" ? "var(--success-border)" : f.status === "PARTIAL" ? "var(--warning-border)" : "var(--danger-border)";
                      const bgColor = f.status === "COMPLIANT" ? "var(--success-bg)" : f.status === "PARTIAL" ? "var(--warning-bg)" : "var(--danger-bg)";
                      const textColor = f.status === "COMPLIANT" ? "var(--success)" : f.status === "PARTIAL" ? "var(--warning)" : "var(--danger)";
                      return (
                        <div key={i} style={{ border: `1px solid ${borderColor}`, background: bgColor, borderRadius: 10, padding: "14px 16px" }}>
                          <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                            <div className="flex items-center gap-2">
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: textColor, padding: "3px 8px", borderRadius: 20, border: `1px solid ${borderColor}`, background: "transparent" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: textColor, display: "inline-block" }} />
                                {meta.label}
                              </span>
                              <span className="text-xs font-medium mono" style={{ color: "var(--text-secondary)" }}>{f.guidelineReference}</span>
                            </div>
                            {f.confidence === "LOW" && (
                              <span style={{ fontSize: 11, color: "var(--warning)", background: "var(--warning-bg)", padding: "2px 8px", borderRadius: 20, border: "1px solid var(--warning-border)" }}>
                                Verify manually
                              </span>
                            )}
                          </div>
                          {f.section && (
                            <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {f.section}
                            </div>
                          )}
                          <div className="text-sm mb-2" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
                            <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Requirement: </span>
                            {f.requirement}
                          </div>
                          <div className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6, paddingTop: 10, borderTop: `1px solid ${borderColor}` }}>
                            <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Finding: </span>
                            {f.finding}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-xs text-right" style={{ color: "var(--text-muted)" }}>
                  Analysed {new Date(report.analysedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
