import { app } from "electron";
import * as crypto from "crypto";
import * as os from "os";
import {
  getLicenseCache,
  getLicenseKey,
  setLicenseCache,
  setLicenseKey,
} from "./secure-store";

export interface LicenseStatus {
  valid: boolean;
  reason?: string;
  expiresAt?: string | null;
  customer?: string;
  offline?: boolean;
}

const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;
let currentStatus: LicenseStatus = { valid: false, reason: "License not checked" };

function machineId(): string {
  return crypto
    .createHash("sha256")
    .update(`${os.hostname()}|${os.platform()}|${os.arch()}`)
    .digest("hex");
}

function cachedStatus(reason: string): LicenseStatus {
  const cache = getLicenseCache();
  if (!cache?.valid) return { valid: false, reason };
  const checkedAt = Date.parse(cache.checkedAt);
  const expiresAt = cache.expiresAt ? Date.parse(cache.expiresAt) : Infinity;
  if (
    Number.isFinite(checkedAt) &&
    Date.now() - checkedAt <= OFFLINE_GRACE_MS &&
    Date.now() < expiresAt
  ) {
    return {
      valid: true,
      reason: "Using recently validated offline license",
      expiresAt: cache.expiresAt,
      customer: cache.customer,
      offline: true,
    };
  }
  return { valid: false, reason };
}

export function getCurrentLicenseStatus(): LicenseStatus {
  return currentStatus;
}

export async function validateLicense(key = getLicenseKey()): Promise<LicenseStatus> {
  if (!key.trim()) {
    currentStatus = { valid: false, reason: "A license key is required." };
    return currentStatus;
  }

  const endpoint = process.env.MRJEE_LICENSE_SERVER_URL;
  if (!endpoint) {
    currentStatus = cachedStatus(
      "License server is not configured (MRJEE_LICENSE_SERVER_URL).",
    );
    return currentStatus;
  }

  try {
    const response = await fetch(endpoint, {
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
      expiresAt?: string | null;
      customer?: string;
    };
    if (!response.ok || !data.valid) {
      currentStatus = {
        valid: false,
        reason: data.reason || `License server rejected the key (${response.status}).`,
      };
      return currentStatus;
    }
    if (data.expiresAt && Date.parse(data.expiresAt) <= Date.now()) {
      currentStatus = { valid: false, reason: "License has expired.", expiresAt: data.expiresAt };
      return currentStatus;
    }
    currentStatus = {
      valid: true,
      expiresAt: data.expiresAt ?? null,
      customer: data.customer,
    };
    setLicenseCache({ ...currentStatus, checkedAt: new Date().toISOString() });
    return currentStatus;
  } catch (error) {
    currentStatus = cachedStatus(
      error instanceof Error ? `License server unavailable: ${error.message}` : "License server unavailable.",
    );
    return currentStatus;
  }
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  const status = await validateLicense(key);
  if (status.valid) setLicenseKey(key);
  return status;
}
