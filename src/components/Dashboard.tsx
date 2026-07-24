import type { PrinterMapping } from "../App";
import type { PrintJob } from "./QueuesView";

interface BridgeStatus {
  running: boolean;
  version: string;
  uptime: number;
  totalJobs: number;
  failedJobs: number;
  port?: number;
  activePrintersCount?: number;
}

interface Props {
  status: BridgeStatus | null;
  mappings: PrinterMapping[];
  jobs: PrintJob[];
  onSelectPrinter: (id: string) => void;
  onTestPrint: (mapping: PrinterMapping) => void;
}

export default function Dashboard({
  status,
  mappings,
  jobs,
  onSelectPrinter,
  onTestPrint,
}: Props) {
  const formatUptime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 4 Stat Cards */}
      <div
        className="dashboard-stats"
        style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
      >
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">System Uptime</span>
            <div className="stat-icon uptime">⏱</div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value">
              {status ? formatUptime(status.uptime) : "00h 00m 00s"}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Successful Jobs</span>
            <div className="stat-icon success">✓</div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value success">{status?.totalJobs ?? 0}</span>
            <span className="stat-unit">Completed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Failed Jobs</span>
            <div className="stat-icon error">⚠️</div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value error">{status?.failedJobs ?? 0}</span>
            <span className="stat-unit">Errors</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Configured Printers</span>
            <div
              className="stat-icon"
              style={{ background: "#eff6ff", color: "#3b82f6" }}
            >
              🖨️
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-value" style={{ color: "#3b82f6" }}>
              {mappings.length}
            </span>
            <span className="stat-unit">Instances</span>
          </div>
        </div>
      </div>

      {/* Grid Row: Active Printers Summary & Recent Jobs */}
      <div
        className="dashboard-lower-grid"
        style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}
      >
        {/* Printers Overview Card */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 20,
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "var(--text-primary)",
              }}
            >
              🖨️ Active Printer Instances
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {mappings.length} configured
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mappings.length > 0 ? (
              mappings.map((m) => {
                const isOnline = m.enabled !== false;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: "var(--text-primary)",
                        }}
                      >
                        {m.logicalName}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Target: {m.physicalName || "Not assigned"} (
                        {m.type.toUpperCase()})
                      </div>
                    </div>

                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 99,
                          fontSize: 10,
                          fontWeight: 700,
                          background: isOnline
                            ? "var(--success-light)"
                            : "#f1f5f9",
                          color: isOnline
                            ? "var(--success)"
                            : "var(--text-muted)",
                        }}
                      >
                        {isOnline ? "● Aktif" : "○ Nonaktif"}
                      </span>
                      <button
                        onClick={() => onSelectPrinter(m.id)}
                        style={{
                          padding: "4px 10px",
                          background: "var(--primary)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Configure
                      </button>
                      <button
                        onClick={() => onTestPrint(m)}
                        style={{
                          padding: "4px 8px",
                          background: "#ffffff",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        🖨️
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                No printer configured yet.
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Card */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 20,
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "var(--text-primary)",
              }}
            >
              📊 Recent Print Activity
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Last {jobs.slice(0, 5).length} jobs
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {jobs.length > 0 ? (
              jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        color: "var(--primary)",
                        marginRight: 8,
                      }}
                    >
                      {job.id}
                    </span>
                    <span style={{ fontWeight: 600 }}>{job.printer}</span>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {job.time}
                    </span>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background:
                          job.status === "COMPLETED"
                            ? "var(--success-light)"
                            : "var(--error-light)",
                        color:
                          job.status === "COMPLETED"
                            ? "var(--success)"
                            : "var(--error)",
                      }}
                    >
                      {job.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                No recent print jobs recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
