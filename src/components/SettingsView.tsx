import { useEffect, useState } from "react";

interface SettingsViewProps {
  status?: { port?: number } | null;
  showToast?: (
    title: string,
    message: string,
    type?: "success" | "error" | "info",
  ) => void;
  onPortUpdated?: () => void;
}

export default function SettingsView({
  status,
  showToast,
  onPortUpdated,
}: SettingsViewProps) {
  const [port, setPort] = useState<number>(status?.port || 9000);
  const [autoStart, setAutoStart] = useState<boolean>(false);
  const [minimizeToTray, setMinimizeToTray] = useState<boolean>(true);
  const [corsOrigin, setCorsOrigin] = useState<string>("*");
  const [apiToken, setApiToken] = useState<string>("");
  const [showApiToken, setShowApiToken] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const API_BASE =
    typeof window !== "undefined" &&
    (window.location.protocol === "file:" ||
      window.location.port === "5173" ||
      !window.location.host)
      ? `http://localhost:${status?.port || 9000}`
      : typeof window !== "undefined"
        ? window.location.origin
        : `http://localhost:${status?.port || 9000}`;

  useEffect(() => {
    fetch(`${API_BASE}/api/config/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.port) setPort(data.port);
        if (data.corsOrigin) setCorsOrigin(data.corsOrigin);
        if (data.minimizeToTray !== undefined)
          setMinimizeToTray(data.minimizeToTray);
      })
      .catch(() => {
        if (status?.port) setPort(status.port);
      });
  }, [API_BASE, status?.port]);

  useEffect(() => {
    if ((window as any).electronAPI?.getAutoStart) {
      (window as any).electronAPI.getAutoStart().then((enabled: boolean) => {
        setAutoStart(enabled);
      });
    }
    if ((window as any).electronAPI?.getApiToken) {
      (window as any).electronAPI.getApiToken().then((token: string) => {
        setApiToken(token || "");
      });
    }
  }, []);

  const handleCopyApiToken = async () => {
    if (!apiToken) return;
    await navigator.clipboard.writeText(apiToken);
    showToast?.(
      "API Token Copied",
      "Token lokal berhasil disalin. Jangan membagikannya ke publik.",
      "success",
    );
  };

  const handleRegenerateApiToken = async () => {
    if (
      !window.confirm(
        "Buat token baru? Integrasi yang memakai token lama harus diperbarui.",
      )
    ) {
      return;
    }
    const token = await (window as any).electronAPI?.regenerateApiToken?.();
    if (token) {
      setApiToken(token);
      setShowApiToken(true);
      showToast?.(
        "API Token Regenerated",
        "Token baru aktif. Perbarui token pada aplikasi yang terintegrasi.",
        "info",
      );
    }
  };

  const handleToggleAutoStart = async (checked: boolean) => {
    setAutoStart(checked);
    if ((window as any).electronAPI?.setAutoStart) {
      const actualState = await (window as any).electronAPI.setAutoStart(
        checked,
      );
      setAutoStart(actualState);
    }
  };

  const handleToggleMinimizeToTray = async (checked: boolean) => {
    setMinimizeToTray(checked);
    try {
      await fetch(`${API_BASE}/api/config/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          port: Number(port),
          corsOrigin,
          minimizeToTray: checked,
        }),
      });
      if (showToast) {
        showToast(
          "Setting Updated",
          checked
            ? "Run in Background (System Tray) Enabled"
            : "Run in Background Disabled. App will exit completely when closed.",
          "info",
        );
      }
    } catch {
      // Fallback
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          port: Number(port),
          corsOrigin,
          minimizeToTray,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setIsSaved(true);
        if (showToast)
          showToast(
            "Settings Saved",
            "Application settings updated successfully",
            "success",
          );
        if (onPortUpdated) onPortUpdated();
        setTimeout(() => setIsSaved(false), 3000);
      } else {
        if (showToast)
          showToast(
            "Error",
            data.message || "Failed to update settings",
            "error",
          );
      }
    } catch {
      if (showToast) showToast("Error", "Failed to connect to server", "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          ⚙️ Application & Server Settings
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Configure Local Print Bridge port, Windows startup options, and
          background service rules
        </p>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          boxShadow: "var(--shadow-card)",
          maxWidth: 650,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div className="form-group">
          <label style={{ fontWeight: 700 }}>
            HTTP / WebSocket Server Port
          </label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 9000)}
            placeholder="9000"
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Default server port is 9000. Service runs continuously in
            background.
          </span>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700 }}>CORS Allowed Origins</label>
          <input
            type="text"
            value={corsOrigin}
            onChange={(e) => setCorsOrigin(e.target.value)}
            placeholder="*"
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Enter a comma-separated allowlist, for example
            https://pos.example.com, https://wms.example.com. Use * only during
            local development.
          </span>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Local API Security Token</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type={showApiToken ? "text" : "password"}
              value={apiToken}
              readOnly
              aria-label="Local API security token"
              style={{ flex: "1 1 360px", fontFamily: "monospace" }}
            />
            <button type="button" onClick={() => setShowApiToken((value) => !value)}>
              {showApiToken ? "Hide" : "Show"}
            </button>
            <button type="button" onClick={handleCopyApiToken}>
              Copy Token
            </button>
            <button type="button" onClick={handleRegenerateApiToken}>
              Regenerate
            </button>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Dibuat otomatis dan disimpan terenkripsi di komputer ini. Token ini
            gratis, bukan license key, dan tidak menghubungi server Mrjee.
          </span>
        </div>

        <div className="switch-row">
          <div className="switch-label-group">
            <span className="switch-title">Auto-start on Windows Boot</span>
            <span className="switch-sub">
              Launch Mrjee Print Bridge automatically when PC starts
            </span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => handleToggleAutoStart(e.target.checked)}
            />
            <span className="slider-round" />
          </label>
        </div>

        <div className="switch-row">
          <div className="switch-label-group">
            <span className="switch-title">
              Run in Background (System Tray)
            </span>
            <span className="switch-sub">
              Keep print service active in Windows System Tray when window is
              closed
            </span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={minimizeToTray}
              onChange={(e) => handleToggleMinimizeToTray(e.target.checked)}
            />
            <span className="slider-round" />
          </label>
        </div>

        <div
          style={{
            paddingTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            onClick={handleSave}
            style={{
              padding: "10px 24px",
              background: "var(--primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            💾 Save Settings
          </button>
          {isSaved && (
            <span
              style={{ fontSize: 12, color: "var(--success)", fontWeight: 700 }}
            >
              ✓ Settings saved successfully!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
