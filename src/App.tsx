import { useCallback, useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import LicenseScreen from "./components/LicenseScreen";
import TrialWorkspace from "./components/TrialWorkspace";
import LogsView from "./components/LogsView";
import PrinterConfig from "./components/PrinterConfig";
import PrinterTabs from "./components/PrinterTabs";
import QueuesView, { type PrintJob } from "./components/QueuesView";
import SettingsView from "./components/SettingsView";

interface PrintOptions {
  copies?: number;
  size?: { width: number; height: number };
  units?: "in" | "mm" | "cm";
  density?: number;
  rasterize?: boolean;
  orientation?: "portrait" | "landscape";
  colorType?: "blackwhite" | "color" | "grayscale";
  margins?: number;
}

export interface PrinterMapping {
  id: string;
  logicalName: string;
  physicalName: string;
  type:
    | "pdf"
    | "base64"
    | "raw"
    | "zpl"
    | "epl"
    | "sbpl"
    | "escpos"
    | "image"
    | string;
  enabled?: boolean;
  config: PrintOptions;
}

interface PhysicalPrinter {
  name: string;
  isDefault: boolean;
}

interface BridgeStatus {
  running: boolean;
  version: string;
  uptime: number;
  totalJobs: number;
  failedJobs: number;
  port?: number;
  license?: LicenseStatus;
}

interface LicenseStatus {
  valid: boolean;
  reason?: string;
  expiresAt?: string | null;
  customer?: string;
  offline?: boolean;
}

const getApiBase = (port?: number) => {
  if (typeof window === "undefined") return `http://localhost:${port || 9000}`;
  const isFileOrApp =
    window.location.protocol === "file:" ||
    !window.location.host ||
    window.location.host.startsWith("file:");
  const isViteDev = window.location.port === "5173";

  if (isFileOrApp || isViteDev) {
    return `http://localhost:${port || 9000}`;
  }
  return window.location.origin;
};

export default function App() {
  const [mappings, setMappings] = useState<PrinterMapping[]>([]);
  const [printers, setPrinters] = useState<PhysicalPrinter[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<string>("dashboard");
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [trialMode, setTrialMode] = useState(false);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [SERVER] Mrjee Print Bridge initialized`,
  ]);
  const [toast, setToast] = useState<{
    title: string;
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const API_BASE = getApiBase(status?.port);

  const showToast = useCallback(
    (
      title: string,
      message: string,
      type: "success" | "error" | "info" = "info",
    ) => {
      setToast({ title, message, type });
      setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      const data = await res.json();
      setStatus(data);
      if (data.license) setLicense(data.license);
    } catch {
      setStatus(null);
    }
  }, [API_BASE]);

  useEffect(() => {
    const electronApi = (window as any).electronAPI;
    if (electronApi?.getLicenseStatus) {
      Promise.all([electronApi.getLicenseStatus(), electronApi.getApiToken()])
        .then(([licenseStatus, token]) => {
          setLicense(licenseStatus);
          setApiToken(token || "");
        })
        .catch(() => setLicense({ valid: false, reason: "Unable to read license status." }));
    }
  }, []);

  const setMappingsDeduplicated = useCallback(
    (newMappings: PrinterMapping[]) => {
      if (!Array.isArray(newMappings)) return;
      const map = new Map<string, PrinterMapping>();
      for (const m of newMappings) {
        if (m && m.id) map.set(m.id, m);
      }
      setMappings(Array.from(map.values()));
    },
    [],
  );

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mappings`);
      const data = await res.json();
      setMappingsDeduplicated(data);
    } catch {
      console.error("Failed to fetch mappings");
    }
  }, [API_BASE, setMappingsDeduplicated]);

  const fetchPrinters = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/printers`);
      const data = await res.json();
      setPrinters(data);
    } catch {
      console.error("Failed to fetch printers");
    }
  }, [API_BASE]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setJobs(data);
      }
    } catch {
      console.error("Failed to fetch jobs");
    }
  }, [API_BASE]);

  const handleClearJobs = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/jobs`, { method: "DELETE" });
      setJobs([]);
    } catch {
      setJobs([]);
    }
  }, [API_BASE]);

  const handleAddPrinter = useCallback(async () => {
    try {
      let nextNum = mappings.length + 1;
      let candidateName = `barcode-printer-${String(nextNum).padStart(2, "0")}`;
      while (mappings.some((m) => m.logicalName === candidateName)) {
        nextNum++;
        candidateName = `barcode-printer-${String(nextNum).padStart(2, "0")}`;
      }

      const res = await fetch(`${API_BASE}/api/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logicalName: candidateName,
          physicalName: printers[0]?.name || "",
          type: "pdf",
          enabled: true,
          config: {
            copies: 1,
            density: 300,
            rasterize: true,
            orientation: "portrait",
            colorType: "blackwhite",
            margins: 0,
            size: { width: 100, height: 150 },
            units: "mm",
          },
        }),
      });
      const newMapping = await res.json();
      if (newMapping && newMapping.id) {
        setActiveTabId(newMapping.id);
      }
      await fetchMappings();
      showToast(
        "Printer Added",
        `New printer instance "${newMapping.logicalName || candidateName}" created`,
        "success",
      );
    } catch {
      showToast("Error", "Failed to add printer mapping", "error");
    }
  }, [mappings, printers, fetchMappings, showToast]);

  const handleMappingChange = useCallback((updated: PrinterMapping) => {
    setMappings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }, []);

  const handleUpdateMapping = useCallback(
    async (id: string, updates: PrinterMapping) => {
      try {
        const res = await fetch(`${API_BASE}/api/mappings/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const updatedMappings = await res.json();
        setMappingsDeduplicated(updatedMappings);
        showToast(
          "Action Success",
          "Configuration saved successfully!",
          "success",
        );
      } catch {
        showToast("Error", "Failed to save configuration", "error");
      }
    },
    [setMappingsDeduplicated, showToast],
  );

  const handleDeleteMapping = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/mappings/${id}`, {
          method: "DELETE",
        });
        const updatedMappings = await res.json();
        setMappingsDeduplicated(updatedMappings);
        if (activeTabId === id) {
          setActiveTabId(updatedMappings[0]?.id || null);
        }
        showToast("Printer Deleted", "Printer configuration removed", "info");
      } catch {
        showToast("Error", "Failed to delete printer", "error");
      }
    },
    [activeTabId, setMappingsDeduplicated, showToast],
  );

  const getTestPayload = (type: string) => {
    switch (type?.toLowerCase()) {
      case "sbpl":
      case "sato":
        return "\x1bA\x1bV0050\x1bH0050\x1bP02\x1bL0202\x1bX21,MJ PRINT BRIDGE - SATO SBPL TEST\x1bV0120\x1bH0050\x1bBG02080123456789\x1bZ";
      case "zpl":
        return "^XA^FO50,50^ADN,36,20^FDTEST PRINT MJ BRIDGE^FS^FO50,100^B3N,N,100,Y,N^FD12345678^FS^XZ";
      case "epl":
        return 'N\nA50,50,0,4,1,1,N,"TEST PRINT MJ BRIDGE"\nP1\n';
      case "escpos":
      case "raw":
        return "\x1b\x40\x1b\x61\x01=== TEST PRINT MJ BRIDGE ===\nPrinter OK\n\n\n\x1d\x56\x00";
      case "image":
        return "data:image/png;base64,iVBORw0KGgoAAAANSU5QoAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      case "pdf":
      default:
        return "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMTAwXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAzNCA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDEwIDQwIFRkIChURVNUIFBSSU5UKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTEzIDAwMDAwIG4gCjAwMDAwMDAzMDEgMDAwMDAgbiAKMDAwMDAwMDM4NiAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ2NwolJUVPRgo=";
    }
  };

  const handleTestPrint = useCallback(
    async (mapping: PrinterMapping, customData?: string) => {
      try {
        showToast(
          "Sending Job",
          `Sending test print to ${mapping.logicalName}...`,
          "info",
        );
        const res = await fetch(`${API_BASE}/api/print`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            logicalName: mapping.logicalName,
            data: customData !== undefined ? customData : getTestPayload(mapping.type),
          }),
        });
        const result = await res.json();
        if (result.success) {
          showToast(
            "Action Success",
            "Test print sent successfully!",
            "success",
          );
        } else {
          showToast(
            "Print Error",
            `Test print failed: ${result.message}`,
            "error",
          );
        }
      } catch (err: any) {
        showToast("Print Error", `Test print error: ${err.message}`, "error");
      }
    },
    [showToast, API_BASE, apiToken],
  );

  useEffect(() => {
    fetchStatus();
    fetchMappings();
    fetchPrinters();
    fetchJobs();

    const interval = setInterval(() => {
      fetchStatus();
      fetchJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchMappings, fetchPrinters, fetchJobs]);

  useEffect(() => {
    const currentPort = status?.port || 9000;
    const isFileOrApp =
      typeof window !== "undefined" &&
      (window.location.protocol === "file:" ||
        !window.location.host ||
        window.location.host.startsWith("file:"));
    const isViteDev =
      typeof window !== "undefined" && window.location.port === "5173";

    const wsHost =
      isFileOrApp || isViteDev
        ? `localhost:${currentPort}`
        : window.location.host;

    const protocol =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "wss:"
        : "ws:";

    const wsUrl = `${protocol}//${wsHost}/ws`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] [WS] Connected to Print Bridge WebSocket server (${wsUrl})`,
          ...prev,
        ]);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === "connected" && Array.isArray(msg.payload?.jobs)) {
            setJobs(msg.payload.jobs);
          } else if (msg.event === "jobs-cleared") {
            setJobs([]);
          } else if (
            msg.event === "print-success" ||
            msg.event === "print-error"
          ) {
            const payload = msg.payload;
            const newJob: PrintJob = {
              id:
                payload.id ||
                payload.jobId ||
                `JOB-${Math.floor(Math.random() * 9000 + 1000)}`,
              printer:
                payload.printer || payload.logicalName || "Unknown Printer",
              type: payload.type || "PDF",
              status:
                payload.status ||
                (msg.event === "print-success" ? "COMPLETED" : "FAILED"),
              time: payload.time || new Date().toLocaleTimeString(),
              size: payload.size || "1.0 KB",
            };
            setJobs((prev) => {
              const exists = prev.some((j) => j.id === newJob.id);
              return exists ? prev : [newJob, ...prev];
            });
            void fetchStatus();
          } else if (msg.event === "mappings-updated") {
            if (Array.isArray(msg.payload)) {
              setMappingsDeduplicated(msg.payload);
            }
          } else if (msg.event === "log") {
            setLogs((prev) => [msg.payload, ...prev]);
          }
        } catch (e) {
          console.error("WS parse error", e);
        }
      };
    } catch (err) {
      console.error("WS connect error", err);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (!activeTabId && mappings.length > 0) {
      setActiveTabId(mappings[0].id);
    }
  }, [mappings, activeTabId]);

  const activeMapping = mappings.find((m) => m.id === activeTabId);

  if (!license) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg-main)",
          color: "var(--text-secondary)",
        }}
      >
        Checking license…
      </div>
    );
  }

  if (license && !license.valid) {
    if (trialMode) {
      return (
        <TrialWorkspace
          port={status?.port || 9000}
          onActivate={() => setTrialMode(false)}
        />
      );
    }
    return (
      <LicenseScreen
        status={license}
        onTrial={() => setTrialMode(true)}
        onActivated={(nextLicense, token) => {
          setLicense(nextLicense);
          setApiToken(token);
          void fetchStatus();
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {/* App Header Bar */}
      <header className="app-header">
        <div className="brand-section">
          <img
            src="/icon.png"
            alt="Mrjee Print Bridge"
            className="brand-logo-img"
            style={{
              width: 34,
              height: 34,
              objectFit: "contain",
              borderRadius: 4,
            }}
          />
          <div className="brand-titles">
            <span className="brand-title">MRJEE PRINT BRIDGE</span>
            <span className="brand-subtitle">DESKTOP LOCAL SERVICE</span>
          </div>
        </div>

        <div className="header-right">
          <div className="port-badge">
            <span className="status-dot" />
            <span>PORT :{status?.port || 9000}</span>
          </div>

          <div className="window-controls">
            <button
              type="button"
              className="win-btn win-minimize"
              onClick={() => (window as any).electronAPI?.minimize()}
              title="Minimize"
            >
              ─
            </button>
            <button
              type="button"
              className="win-btn win-maximize"
              onClick={() => (window as any).electronAPI?.maximize()}
              title="Maximize"
            >
              ☐
            </button>
            <button
              type="button"
              className="win-btn win-close"
              onClick={() => (window as any).electronAPI?.close()}
              title="Close to Tray"
            >
              ✕
            </button>
          </div>
        </div>
      </header>

      {/* App Body with Sidebar & Content */}
      <div className="app-body">
        {/* Left Sidebar */}
        <aside className="app-sidebar">
          <div className="sidebar-top">
            <div className="engine-info">
              <h3>MJ Print Bridge v{status?.version || "1.8.2"}</h3>
              <p>
                {status?.running !== false ? "Active" : "Inactive"} | Port{" "}
                {status?.port || 9000}
              </p>
            </div>

            <nav className="sidebar-menu">
              <button
                className={`menu-item ${activeNav === "dashboard" ? "active" : ""}`}
                onClick={() => setActiveNav("dashboard")}
              >
                <span className="menu-icon">🎛️</span>
                <span>DASHBOARD</span>
              </button>
              <button
                className={`menu-item ${activeNav === "printers" ? "active" : ""}`}
                onClick={() => setActiveNav("printers")}
              >
                <span className="menu-icon">🖨️</span>
                <span>PRINTERS</span>
              </button>
              <button
                className={`menu-item ${activeNav === "queues" ? "active" : ""}`}
                onClick={() => setActiveNav("queues")}
              >
                <span className="menu-icon">📊</span>
                <span>QUEUES</span>
              </button>
              <button
                className={`menu-item ${activeNav === "logs" ? "active" : ""}`}
                onClick={() => setActiveNav("logs")}
              >
                <span className="menu-icon">📄</span>
                <span>LOGS</span>
              </button>
              <button
                className={`menu-item ${activeNav === "settings" ? "active" : ""}`}
                onClick={() => setActiveNav("settings")}
              >
                <span className="menu-icon">⚙️</span>
                <span>SETTINGS</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-bottom">
            <button className="btn-new-instance" onClick={handleAddPrinter}>
              New Instance
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          {activeNav === "dashboard" && (
            <Dashboard
              status={status}
              mappings={mappings}
              jobs={jobs}
              onSelectPrinter={(id) => {
                setActiveTabId(id);
                setActiveNav("printers");
              }}
              onTestPrint={handleTestPrint}
            />
          )}

          {activeNav === "printers" && (
            <>
              <PrinterTabs
                mappings={mappings}
                activeTabId={activeTabId}
                onSelectTab={setActiveTabId}
                onAddPrinter={handleAddPrinter}
                onDeletePrinter={handleDeleteMapping}
              />

              {activeMapping ? (
                <PrinterConfig
                  mapping={activeMapping}
                  printers={printers}
                  onChange={handleMappingChange}
                  onUpdate={handleUpdateMapping}
                  onTestPrint={handleTestPrint}
                  onRefreshPrinters={fetchPrinters}
                />
              ) : (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  No printer configured yet. Click{" "}
                  <strong>"+ Add Printer"</strong> to start.
                </div>
              )}
            </>
          )}

          {activeNav === "queues" && (
            <QueuesView
              jobs={jobs}
              onClear={handleClearJobs}
              onRetryJob={(job) => {
                const target =
                  mappings.find((m) => m.logicalName === job.printer) ||
                  activeMapping;
                if (target) handleTestPrint(target);
              }}
            />
          )}
          {activeNav === "logs" && (
            <LogsView logs={logs} onClear={() => setLogs([])} />
          )}
          {activeNav === "settings" && (
            <SettingsView
              status={status}
              showToast={showToast}
              onPortUpdated={fetchStatus}
            />
          )}

          {/* Footer Bar */}
          <footer className="footer-bar">
            <div className="footer-left">
              <span>v1.0.0-STABLE</span>
              <span>•</span>
              <span className="footer-status-pill">
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--success)",
                  }}
                />
                API CONNECTION: OK
              </span>
            </div>

            <div className="footer-right">
              {activeMapping && activeNav === "printers" && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Editing: <strong>{activeMapping.logicalName}</strong>
                </span>
              )}
            </div>
          </footer>
        </main>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-box">
          <div className="toast-icon">✓</div>
          <div className="toast-content">
            <span className="toast-title">{toast.title}</span>
            <span className="toast-message">{toast.message}</span>
          </div>
          <button className="toast-close" onClick={() => setToast(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
