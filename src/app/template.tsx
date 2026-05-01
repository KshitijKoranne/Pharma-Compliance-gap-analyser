export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div style={{
        background: "var(--warning-bg)",
        borderBottom: "1px solid var(--warning-border)",
        color: "var(--text-primary)",
        fontSize: 13,
        lineHeight: 1.5,
        padding: "10px 24px",
        textAlign: "center",
      }}>
        <strong>System SOP scope:</strong>{" "}
        This tool is intended for system-level QA/GMP SOPs such as change control, deviation, CAPA, training,
        documentation control, validation governance, data integrity, supplier qualification, and quality risk management.
        It is not intended for operational SOPs, manufacturing instructions, analytical methods, batch records,
        equipment operation procedures, or other execution-level SOPs.
      </div>
      {children}
    </>
  );
}
