"use client";

import { useState, useRef } from "react";
import type { Guideline } from "@/lib/guidelines-registry";
import type { GapReport, GapFinding } from "@/lib/analyser";
import { GUIDELINES, GUIDELINES_BY_CATEGORY } from "@/lib/guidelines-registry";

const CATEGORY_LABELS: Record<string, string> = {
  ICH: "ICH Quality Guidelines",
  EU_GMP: "EU GMP (EudraLex Vol. 4)",
  FDA: "US FDA",
  WHO: "WHO",
  ISO: "ISO",
};

const STATUS_CONFIG = {
  COMPLIANT: {
    label: "Compliant",
    bg: "bg-emerald-950/40",
    border: "border-emerald-700/40",
    badge: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
    dot: "bg-emerald-400",
  },
  PARTIAL: {
    label: "Partial",
    bg: "bg-amber-950/40",
    border: "border-amber-700/40",
    badge: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
    dot: "bg-amber-400",
  },
  GAP: {
    label: "Gap",
    bg: "bg-red-950/40",
    border: "border-red-800/40",
    badge: "bg-red-900/60 text-red-300 border border-red-700/50",
    dot: "bg-red-400",
  },
};

const CONFIDENCE_LABEL: Record<string, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low — verify manually",
};

export default function Home() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GapReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "gaps" | "partial" | "compliant">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const ingestedCount = GUIDELINES.filter((g) => g.ingested).length;

  function toggleGuideline(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".docx")) setFile(f);
  }

  async function handleAnalyse() {
    if (!file || selectedIds.size === 0) return;
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("guidelineIds", JSON.stringify([...selectedIds]));

      const res = await fetch("/api/analyse", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setReport(data.report);
      setActiveTab("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const tabFindings: Record<string, GapFinding[]> = report
    ? {
        all: report.allFindings,
        gaps: report.criticalGaps,
        partial: report.minorGaps,
        compliant: report.compliantAreas,
      }
    : { all: [], gaps: [], partial: [], compliant: [] };

  return (
    <div className="min-h-screen bg-[#0a0c0f] text-slate-200" style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      {/* Header */}
      <header className="border-b border-slate-800/60 bg-[#0a0c0f]/80 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-slate-600 bg-slate-800 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-300">GX</span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-widest text-slate-100 uppercase">
                Compliance Gap Analyser
              </h1>
              <p className="text-xs text-slate-500 tracking-wider">KJR Labs — Pharma QA Tooling</p>
            </div>
          </div>
          <div className="text-xs text-slate-600 tabular-nums">
            {ingestedCount}/{GUIDELINES.length} guidelines indexed
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">

          {/* LEFT PANEL */}
          <div className="space-y-4">

            {/* File Upload */}
            <div className="rounded border border-slate-700/50 bg-slate-900/40">
              <div className="px-4 py-3 border-b border-slate-700/50">
                <h2 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                  01 — Document
                </h2>
              </div>
              <div className="p-4">
                <div
                  className={`border-2 border-dashed rounded p-6 text-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-blue-500 bg-blue-950/20"
                      : file
                      ? "border-emerald-600/50 bg-emerald-950/10"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                  />
                  {file ? (
                    <div>
                      <div className="text-emerald-400 text-xs font-bold tracking-wider mb-1">LOADED</div>
                      <div className="text-slate-200 text-sm truncate">{file.name}</div>
                      <div className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-slate-500 text-xs tracking-wider mb-2">Drop .docx file here</div>
                      <div className="text-slate-600 text-xs">or click to browse</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Guidelines Selection */}
            <div className="rounded border border-slate-700/50 bg-slate-900/40">
              <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-widest uppercase text-slate-400">
                  02 — Guidelines
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">{selectedIds.size} selected</span>
              </div>
              <div className="p-2 max-h-[420px] overflow-y-auto">
                {Object.entries(GUIDELINES_BY_CATEGORY).map(([cat, guidelines]) => (
                  <div key={cat} className="mb-3">
                    <div className="px-2 py-1 text-xs font-bold tracking-widest uppercase text-slate-500">
                      {CATEGORY_LABELS[cat] || cat}
                    </div>
                    {(guidelines as Guideline[]).map((g) => (
                      <button
                        key={g.id}
                        onClick={() => g.ingested && toggleGuideline(g.id)}
                        disabled={!g.ingested}
                        className={`w-full text-left px-2 py-2 rounded text-xs transition-all flex items-start gap-2 ${
                          !g.ingested
                            ? "opacity-30 cursor-not-allowed"
                            : selectedIds.has(g.id)
                            ? "bg-blue-900/30 border border-blue-700/50"
                            : "hover:bg-slate-800/60 border border-transparent"
                        }`}
                      >
                        <div className={`mt-0.5 w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                          selectedIds.has(g.id)
                            ? "bg-blue-500 border-blue-500"
                            : "border-slate-600"
                        }`}>
                          {selectedIds.has(g.id) && (
                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12">
                              <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-200 font-medium">{g.shortName}</div>
                          <div className="text-slate-500 text-xs mt-0.5 truncate">{g.description}</div>
                          {!g.ingested && (
                            <div className="text-amber-600/70 text-xs mt-0.5">not yet indexed</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleAnalyse}
              disabled={!file || selectedIds.size === 0 || loading}
              className={`w-full py-3 px-4 rounded text-sm font-bold tracking-widest uppercase transition-all ${
                !file || selectedIds.size === 0 || loading
                  ? "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700"
                  : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-3 h-3 border border-white/30 border-t-white rounded-full inline-block" />
                  Analysing...
                </span>
              ) : (
                "Run Gap Analysis"
              )}
            </button>

            {error && (
              <div className="rounded border border-red-800/50 bg-red-950/30 p-3 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* RIGHT PANEL — Results */}
          <div>
            {!report && !loading && (
              <div className="h-full min-h-[400px] flex items-center justify-center rounded border border-slate-800/50 bg-slate-900/20">
                <div className="text-center">
                  <div className="text-slate-700 text-4xl mb-3 font-mono">—</div>
                  <div className="text-slate-600 text-xs tracking-widest uppercase">
                    Upload a document and select guidelines to begin
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="h-full min-h-[400px] flex items-center justify-center rounded border border-slate-800/50 bg-slate-900/20">
                <div className="text-center">
                  <div className="w-8 h-8 border border-blue-500/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
                  <div className="text-slate-400 text-xs tracking-widest uppercase">Running analysis</div>
                  <div className="text-slate-600 text-xs mt-1">This may take 30–60 seconds</div>
                </div>
              </div>
            )}

            {report && (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="rounded border border-slate-700/50 bg-slate-900/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-500 tracking-widest uppercase mb-1">Overall Score</div>
                      <div className="text-2xl font-bold text-slate-100 tabular-nums">{report.overallScore}</div>
                      <div className="text-xs text-slate-500 mt-1">{report.documentName}</div>
                    </div>
                    <div className="flex gap-4 text-center">
                      <div>
                        <div className="text-xl font-bold text-red-400 tabular-nums">{report.criticalGaps.length}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Gaps</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-400 tabular-nums">{report.minorGaps.length}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Partial</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-emerald-400 tabular-nums">{report.compliantAreas.length}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">Compliant</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {report.guidelines.map((g) => (
                      <span key={g} className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-slate-800">
                  {(["all", "gaps", "partial", "compliant"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-2 text-xs tracking-widest uppercase font-medium transition-all border-b-2 -mb-px ${
                        activeTab === tab
                          ? "text-slate-100 border-blue-500"
                          : "text-slate-500 border-transparent hover:text-slate-300"
                      }`}
                    >
                      {tab === "all" ? `All (${tabFindings.all.length})` :
                       tab === "gaps" ? `Gaps (${tabFindings.gaps.length})` :
                       tab === "partial" ? `Partial (${tabFindings.partial.length})` :
                       `Compliant (${tabFindings.compliant.length})`}
                    </button>
                  ))}
                </div>

                {/* Findings list */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {tabFindings[activeTab].map((f, i) => {
                    const cfg = STATUS_CONFIG[f.status];
                    return (
                      <div
                        key={i}
                        className={`rounded border ${cfg.border} ${cfg.bg} p-3`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded font-bold tracking-wider ${cfg.badge}`}>
                              {f.status}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{f.guidelineReference}</span>
                          </div>
                          <span className={`text-xs text-slate-500 whitespace-nowrap ${
                            f.confidence === "LOW" ? "text-amber-600" : ""
                          }`}>
                            {CONFIDENCE_LABEL[f.confidence]}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">{f.section}</div>
                        <div className="text-xs text-slate-300 mb-2 leading-relaxed">
                          <span className="text-slate-500 uppercase tracking-wider text-xs font-bold">Requirement: </span>
                          {f.requirement}
                        </div>
                        <div className="text-xs text-slate-400 leading-relaxed border-t border-slate-700/50 pt-2 mt-2">
                          <span className="text-slate-500 uppercase tracking-wider text-xs font-bold">Finding: </span>
                          {f.finding}
                        </div>
                      </div>
                    );
                  })}

                  {tabFindings[activeTab].length === 0 && (
                    <div className="text-center py-10 text-slate-600 text-xs tracking-wider uppercase">
                      No {activeTab} findings
                    </div>
                  )}
                </div>

                {/* Export note */}
                <div className="text-xs text-slate-600 text-right tracking-wider">
                  Analysed {new Date(report.analysedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
