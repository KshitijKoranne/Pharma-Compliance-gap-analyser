import type React from "react";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div style={{
        background: "linear-gradient(90deg, rgba(36, 86, 216, 0.08), rgba(18, 113, 91, 0.08))",
        borderBottom: "1px solid var(--border)",
        color: "var(--text-secondary)",
        fontSize: 13,
        lineHeight: 1.5,
        padding: "10px 24px",
        textAlign: "center",
        backdropFilter: "blur(14px)",
      }}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}>
          <span style={{
            color: "var(--accent)",
            fontWeight: 700,
            letterSpacing: "0.01em",
          }}>
            System SOP scope
          </span>
          <span>
            Built for system-level QA/GMP SOPs such as change control, deviation, CAPA, training,
            documentation control, validation governance, data integrity, supplier qualification, and QRM.
            Not intended for operational SOPs, analytical methods, batch records, equipment procedures, or execution-level SOPs.
          </span>
        </span>
      </div>
      {children}
    </>
  );
}
