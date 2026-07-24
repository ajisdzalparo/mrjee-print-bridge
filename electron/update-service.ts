import { app, shell } from "electron";
import Store from "electron-store";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MANIFEST_URL = "https://mrjee.id/api/update";

export type UpdateSeverity = "optional" | "recommended" | "required";

export interface UpdateStatus {
  checked: boolean;
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  minimumVersion?: string;
  severity?: UpdateSeverity;
  message?: string;
  downloadUrl?: string;
  releaseNotesUrl?: string;
  checkedAt?: string;
}

interface UpdateStoreSchema {
  lastCheckedAt?: number;
  lastStatus?: UpdateStatus;
}

interface UpdateManifest {
  latestVersion?: string;
  minimumVersion?: string;
  severity?: UpdateSeverity;
  message?: string;
  downloadUrl?: string;
  releaseNotesUrl?: string;
}

const store = new Store<UpdateStoreSchema>({ name: "update-state" });

function versionParts(value: string): number[] {
  return value
    .trim()
    .replace(/^v/i, "")
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNewer(candidate: string, current: string): boolean {
  const left = versionParts(candidate);
  const right = versionParts(current);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

function safeHttpsUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function checkForApplicationUpdate(force = false): Promise<UpdateStatus> {
  const currentVersion = app.getVersion();
  const lastCheckedAt = store.get("lastCheckedAt", 0);
  const cached = store.get("lastStatus");

  if (!force && cached && Date.now() - lastCheckedAt < CHECK_INTERVAL_MS) {
    return { ...cached, currentVersion };
  }

  const manifestUrl =
    process.env.MRJEE_UPDATE_MANIFEST_URL?.trim() || DEFAULT_MANIFEST_URL;

  try {
    const response = await fetch(manifestUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": `Mrjee-Print-Bridge/${currentVersion}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Update server returned ${response.status}`);

    const manifest = (await response.json()) as UpdateManifest;
    if (!manifest.latestVersion) throw new Error("Update manifest has no version");

    const status: UpdateStatus = {
      checked: true,
      available: isNewer(manifest.latestVersion, currentVersion),
      currentVersion,
      latestVersion: manifest.latestVersion.replace(/^v/i, ""),
      minimumVersion: manifest.minimumVersion?.replace(/^v/i, ""),
      severity:
        manifest.severity === "required" ||
        manifest.severity === "recommended"
          ? manifest.severity
          : "optional",
      message: manifest.message,
      downloadUrl: safeHttpsUrl(manifest.downloadUrl),
      releaseNotesUrl: safeHttpsUrl(manifest.releaseNotesUrl),
      checkedAt: new Date().toISOString(),
    };

    store.set("lastCheckedAt", Date.now());
    store.set("lastStatus", status);
    return status;
  } catch {
    // Update checks must never block printing. Keep a previously known update
    // visible when the update service is temporarily unavailable.
    return cached
      ? { ...cached, currentVersion }
      : { checked: false, available: false, currentVersion };
  }
}

export async function openApplicationUpdate(url: string): Promise<boolean> {
  const safeUrl = safeHttpsUrl(url);
  if (!safeUrl) return false;
  await shell.openExternal(safeUrl);
  return true;
}
