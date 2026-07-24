import { useState } from "react";

export interface PrintJob {
  id: string;
  printer: string;
  type: string;
  status: "COMPLETED" | "PRINTING" | "FAILED";
  time: string;
  size: string;
}

interface QueuesViewProps {
  jobs: PrintJob[];
  onClear: () => void;
  onRetryJob?: (job: PrintJob) => void;
}

export default function QueuesView({
  jobs,
  onClear,
  onRetryJob,
}: QueuesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "COMPLETED" | "FAILED"
  >("ALL");

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.printer.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter !== "ALL" && job.status !== statusFilter) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            📊 Print Job Queues & Spooler
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Monitor live print queue status and historical job logs (
            {filteredJobs.length} jobs)
          </p>
        </div>

        <button
          onClick={onClear}
          style={{
            padding: "8px 16px",
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Clear History
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search job ID or printer name..."
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
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "#f1f5f9",
            padding: 3,
            borderRadius: 6,
          }}
        >
          <button
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              background: statusFilter === "ALL" ? "#ffffff" : "transparent",
              color:
                statusFilter === "ALL" ? "var(--primary)" : "var(--text-muted)",
              boxShadow:
                statusFilter === "ALL" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
            onClick={() => setStatusFilter("ALL")}
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
              background:
                statusFilter === "COMPLETED" ? "#ffffff" : "transparent",
              color:
                statusFilter === "COMPLETED"
                  ? "var(--success)"
                  : "var(--text-muted)",
              boxShadow:
                statusFilter === "COMPLETED"
                  ? "0 1px 2px rgba(0,0,0,0.1)"
                  : "none",
            }}
            onClick={() => setStatusFilter("COMPLETED")}
          >
            COMPLETED
          </button>
          <button
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              background: statusFilter === "FAILED" ? "#ffffff" : "transparent",
              color:
                statusFilter === "FAILED"
                  ? "var(--error)"
                  : "var(--text-muted)",
              boxShadow:
                statusFilter === "FAILED"
                  ? "0 1px 2px rgba(0,0,0,0.1)"
                  : "none",
            }}
            onClick={() => setStatusFilter("FAILED")}
          >
            FAILED
          </button>
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 20,
          boxShadow: "var(--shadow-card)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border)",
                color: "var(--text-muted)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              <th style={{ padding: "10px 12px" }}>JOB ID</th>
              <th style={{ padding: "10px 12px" }}>TARGET PRINTER</th>
              <th style={{ padding: "10px 12px" }}>FORMAT</th>
              <th style={{ padding: "10px 12px" }}>PAYLOAD SIZE</th>
              <th style={{ padding: "10px 12px" }}>TIME</th>
              <th style={{ padding: "10px 12px" }}>STATUS</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>
                ACTION
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td
                    style={{
                      padding: "12px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      color: "var(--primary)",
                    }}
                  >
                    {job.id}
                  </td>
                  <td style={{ padding: "12px", fontWeight: 600 }}>
                    {job.printer}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "#f1f5f9",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {job.type}
                    </span>
                  </td>
                  <td
                    style={{ padding: "12px", color: "var(--text-secondary)" }}
                  >
                    {job.size}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {job.time}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 99,
                        fontSize: 11,
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
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    {onRetryJob && (
                      <button
                        onClick={() => onRetryJob(job)}
                        style={{
                          padding: "4px 10px",
                          border: "1px solid var(--border)",
                          background: "#ffffff",
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                        title="Re-send test print to this printer"
                      >
                        🔄 Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  Queue is empty. No matching print jobs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
