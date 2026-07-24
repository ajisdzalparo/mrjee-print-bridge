import { app } from "electron";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  getLicenseCache,
  getLicenseKey,
  setLicenseCache,
  setLicenseKey,
  type SignedLicenseCertificate,
} from "./secure-store";

export interface LicenseStatus {
  valid: boolean;
  reason?: string;
  expiresAt?: string | null;
  customer?: string;
  plan?: string;
  kind?: "subscription" | "lifetime";
  offline?: boolean;
  offlineValidUntil?: string | null;
  lastVerifiedAt?: string;
  nextRefreshAt?: string;
}

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;
let currentStatus: LicenseStatus = { valid: false, reason: "License not checked" };
let refreshTimer: NodeJS.Timeout | null = null;

function machineId(): string {
  return crypto
    .createHash("sha256")
    .update(`${os.hostname()}|${os.platform()}|${os.arch()}`)
    .digest("hex");
}

function readPublicKey(): string {
  const encoded = process.env.MRJEE_LICENSE_PUBLIC_KEY_BASE64;
  if (encoded) return Buffer.from(encoded, "base64").toString("utf8");
  const candidates = [
    path.join(process.resourcesPath, "license-public.pem"),
    path.join(app.getAppPath(), "build", "license-public.pem"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf8");
  }
  throw new Error("License public key is not installed.");
}

function verifyCertificate(certificate: SignedLicenseCertificate): boolean {
  try {
    if (certificate.payload.version !== 1 || certificate.payload.machineId !== machineId()) {
      return false;
    }
    return crypto.verify(
      null,
      Buffer.from(JSON.stringify(certificate.payload)),
      crypto.createPublicKey(readPublicKey()),
      Buffer.from(certificate.signature, "base64url"),
    );
  } catch {
    return false;
  }
}

function localCertificateStatus(reason: string): LicenseStatus {
  const cache = getLicenseCache();
  if (!cache?.certificate || !verifyCertificate(cache.certificate)) {
    return { valid: false, reason };
  }

  const now = Date.now();
  const lastSeen = cache.lastSeenAt ? Date.parse(cache.lastSeenAt) : now;
  if (Number.isFinite(lastSeen) && now + CLOCK_ROLLBACK_TOLERANCE_MS < lastSeen) {
    return { valid: false, reason: "System clock moved backwards. Connect to verify the license." };
  }

  const payload = cache.certificate.payload;
  const offlineDeadline = payload.offlineValidUntil
    ? Date.parse(payload.offlineValidUntil)
    : Infinity;
  const paymentDeadline = payload.paymentGraceEndsAt
    ? Date.parse(payload.paymentGraceEndsAt)
    : Infinity;
  const effectiveDeadline = Math.min(offlineDeadline, paymentDeadline);
  if (now > effectiveDeadline) {
    return {
      valid: false,
      reason: now > paymentDeadline
        ? "Subscription and payment grace period have expired."
        : "Offline grace period has expired. Connect to the internet to refresh.",
      expiresAt: payload.subscriptionEndsAt,
      customer: payload.customer,
      plan: payload.plan,
      kind: payload.kind,
      offlineValidUntil: payload.offlineValidUntil,
    };
  }

  const checkedAt = cache.checkedAt;
  return {
    valid: true,
    reason: payload.kind === "lifetime"
      ? "Lifetime license verified locally"
      : "Subscription verified locally (offline mode)",
    expiresAt: payload.subscriptionEndsAt,
    customer: payload.customer,
    plan: payload.plan,
    kind: payload.kind,
    offline: true,
    offlineValidUntil: payload.offlineValidUntil,
    lastVerifiedAt: checkedAt,
    nextRefreshAt: checkedAt
      ? new Date(Date.parse(checkedAt) + REFRESH_INTERVAL_MS).toISOString()
      : undefined,
  };
}

function licenseEndpoint(pathname: "activate" | "refresh"): string {
  const base = process.env.MRJEE_LICENSE_SERVER_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("License server is not configured.");
  return `${base}/v1/licenses/${pathname}`;
}

async function requestCertificate(
  key: string,
  pathname: "activate" | "refresh",
): Promise<LicenseStatus> {
  const response = await fetch(licenseEndpoint(pathname), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      licenseKey: key.trim(),
      machineId: machineId(),
      appVersion: app.getVersion(),
      platform: process.platform,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json()) as {
    valid?: boolean;
    reason?: string;
    certificate?: SignedLicenseCertificate;
  };
  if (!response.ok || !data.valid || !data.certificate) {
    throw new Error(data.reason || `License server rejected the request (${response.status}).`);
  }
  if (!verifyCertificate(data.certificate)) {
    throw new Error("License certificate signature or device binding is invalid.");
  }

  const now = new Date().toISOString();
  setLicenseCache({
    certificate: data.certificate,
    checkedAt: now,
    lastSeenAt: now,
  });
  const payload = data.certificate.payload;
  currentStatus = {
    valid: true,
    reason: "License verified online",
    expiresAt: payload.subscriptionEndsAt,
    customer: payload.customer,
    plan: payload.plan,
    kind: payload.kind,
    offline: false,
    offlineValidUntil: payload.offlineValidUntil,
    lastVerifiedAt: now,
    nextRefreshAt: new Date(Date.now() + REFRESH_INTERVAL_MS).toISOString(),
  };
  return currentStatus;
}

export function getCurrentLicenseStatus(): LicenseStatus {
  return currentStatus;
}

export async function validateLicense(key = getLicenseKey()): Promise<LicenseStatus> {
  if (!key.trim()) {
    currentStatus = { valid: false, reason: "A license key is required." };
    return currentStatus;
  }
  try {
    currentStatus = await requestCertificate(key, "refresh");
  } catch (error) {
    currentStatus = localCertificateStatus(
      error instanceof Error ? error.message : "License server unavailable.",
    );
  }
  return currentStatus;
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  try {
    const status = await requestCertificate(key, "activate");
    if (status.valid) setLicenseKey(key);
    return status;
  } catch (error) {
    currentStatus = {
      valid: false,
      reason: error instanceof Error ? error.message : "License activation failed.",
    };
    return currentStatus;
  }
}

export function startLicenseRefreshScheduler(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  const schedule = () => {
    const jitter = Math.floor(Math.random() * 60 * 60 * 1000);
    refreshTimer = setTimeout(async () => {
      await validateLicense();
      schedule();
    }, REFRESH_INTERVAL_MS + jitter);
    refreshTimer.unref();
  };
  schedule();
}

export function stopLicenseRefreshScheduler(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}
