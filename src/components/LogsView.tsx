import { useState } from "react";

interface LogsViewProps {
  logs: string[];
  onClear: () => void;
}

export default function LogsView({ logs, onClear }: LogsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "PRINT" | "ERROR" | "WS">("ALL");

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === "PRINT") return log.includes("[PRINT]") || log.includes("[PRINT-DIRECT]");
    if (filterType === "ERROR") return log.includes("[ERROR]") || log.includes("Error");
    if (filterType === "WS") return log.includes("[WS]");
    return true;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join("\n"));
    alert("Logs copied to clipboard!");
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([logs.join("\n")], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `print-bridge-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            📄 Live System Logs & Diagnostics
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Real-time server activity, WebSocket connections, and print events ({filteredLogs.length} entries)
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleDownload}
            style={{
              padding: "8px 14px",
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            💾 Download (.txt)
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: "8px 14px",
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📋 Copy Logs
          </button>
          <button
            onClick={onClear}
            style={{
              padding: "8px 14px",
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Filter logs by keyword..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 3, borderRadius: 6 }}>
          <button
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              background: filterType === "ALL" ? "#ffffff" : "transparent",
              color: filterType === "ALL" ? "var(--primary)" : "var(--text-muted)",
              boxShadow: filterType === "ALL" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
            onClick={() => setFilterType("ALL")}
          >
            ALL
          </button>
          <button
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              background: filterType === "PRINT" ? "#ffffff" : "transparent",
              color: filterType === "PRINT" ? "var(--primary)" : "var(--text-muted)",
              boxShadow: filterType === "PRINT" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
            onClick={() => setFilterType("PRINT")}
          >
            PRINTS
          </button>
          <button
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              background: filterType === "ERROR" ? "#ffffff" : "transparent",
              color: filterType === "ERROR" ? "var(--error)" : "var(--text-muted)",
              boxShadow: filterType === "ERROR" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
            onClick={() => setFilterType("ERROR")}
          >
            ERRORS
          </button>
          <button
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              background: filterType === "WS" ? "#ffffff" : "transparent",
              color: filterType === "WS" ? "var(--primary)" : "var(--text-muted)",
              boxShadow: filterType === "WS" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
            onClick={() => setFilterType("WS")}
          >
            WEBSOCKET
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#0f172a",
          color: "#38bdf8",
          borderRadius: "var(--radius-lg)",
          padding: 20,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          lineHeight: 1.8,
          minHeight: 350,
          maxHeight: 500,
          overflowY: "auto",
          border: "1px solid #1e293b",
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, idx) => {
            const isError = log.includes("[ERROR]") || log.includes("Error");
            const isSuccess = log.includes("- SUCCESS");
            return (
              <div
                key={idx}
                style={{
                  marginBottom: 4,
                  color: isError ? "#f87171" : isSuccess ? "#4ade80" : "#38bdf8",
                }}
              >
                {log}
              </div>
            );
          })
        ) : (
          <div style={{ color: "#64748b", textAlign: "center", paddingTop: 40 }}>
            No logs match the filter criteria.
          </div>
        )}
      </div>
    </div>
  );
}
