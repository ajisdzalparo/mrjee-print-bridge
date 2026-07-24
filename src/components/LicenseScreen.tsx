import { useState } from "react";

interface LicenseStatus {
  valid: boolean;
  reason?: string;
  expiresAt?: string | null;
  customer?: string;
}

interface Props {
  status: LicenseStatus;
  onActivated: (status: LicenseStatus, apiToken: string) => void;
}

export default function LicenseScreen({ status, onActivated }: Props) {
  const [licenseKey, setLicenseKey] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(status.reason || "");

  const activate = async () => {
    if (!licenseKey.trim() || !apiToken.trim()) {
      setMessage("Enter both your license key and secret token.");
      return;
    }
    const electronApi = (window as any).electronAPI;
    if (!electronApi?.activateLicense) {
      setMessage("Activation is available only inside the desktop application.");
      return;
    }
    setBusy(true);
    try {
      const result = await electronApi.activateLicense(licenseKey, apiToken);
      setMessage(result.reason || (result.valid ? "License activated." : "Activation failed."));
      if (result.valid) onActivated(result, apiToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg-main)",
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          padding: 32,
          borderRadius: 16,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <img src="/icon.png" alt="Mrjee Print Bridge" style={{ width: 56, height: 56 }} />
        <h1 style={{ margin: "16px 0 4px", fontSize: 24 }}>Activate Mrjee Print Bridge</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
          Enter the license issued to your company and create the secret token
          that your POS application will send with every print request.
        </p>
        <div className="form-group" style={{ marginTop: 22 }}>
          <label>License Key</label>
          <input
            value={licenseKey}
            onChange={(event) => setLicenseKey(event.target.value)}
            placeholder="MRJEE-XXXX-XXXX-XXXX"
            autoComplete="off"
          />
        </div>
        <div className="form-group" style={{ marginTop: 14 }}>
          <label>Secret Bearer Token</label>
          <input
            type="password"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            placeholder="Use a long, random value"
            autoComplete="new-password"
          />
        </div>
        {message && (
          <div style={{ marginTop: 16, color: "var(--danger)", fontSize: 12 }}>
            {message}
          </div>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={activate}
          style={{
            width: "100%",
            marginTop: 20,
            padding: "12px 18px",
            border: 0,
            borderRadius: 8,
            color: "#fff",
            background: "var(--primary)",
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Validating…" : "Activate Bridge"}
        </button>
      </div>
    </div>
  );
}
