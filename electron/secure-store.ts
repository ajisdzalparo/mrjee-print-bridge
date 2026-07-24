import { safeStorage } from "electron";
import Store from "electron-store";
import { randomBytes } from "crypto";

export interface LicenseCertificatePayload {
  version: 1;
  licenseId: string;
  deviceId: string;
  machineId: string;
  customer: string;
  plan: string;
  kind: "subscription" | "lifetime";
  issuedAt: string;
  subscriptionEndsAt: string | null;
  paymentGraceEndsAt: string | null;
  offlineValidUntil: string | null;
  features: string[];
}

export interface SignedLicenseCertificate {
  payload: LicenseCertificatePayload;
  signature: string;
  keyId: string;
}

interface SecretSchema {
  licenseKey?: string;
  apiToken?: string;
  licenseCache?: {
    certificate: SignedLicenseCertificate;
    checkedAt: string;
    lastSeenAt: string;
  };
}

const store = new Store<SecretSchema>({ name: "credentials" });

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Windows credential encryption is not available.");
  }
  return safeStorage.encryptString(value).toString("base64");
}

function decrypt(value?: string): string {
  if (!value) return "";
  try {
    return safeStorage.decryptString(Buffer.from(value, "base64"));
  } catch {
    return "";
  }
}

export function getLicenseKey(): string {
  return decrypt(store.get("licenseKey"));
}

export function setLicenseKey(value: string): void {
  store.set("licenseKey", encrypt(value.trim()));
}

export function getApiToken(): string {
  return decrypt(store.get("apiToken"));
}

export function setApiToken(value: string): void {
  store.set("apiToken", encrypt(value.trim()));
}

export function ensureApiToken(): string {
  const existing = getApiToken();
  if (existing) return existing;
  const generated = randomBytes(32).toString("hex");
  setApiToken(generated);
  return generated;
}

export function regenerateApiToken(): string {
  const generated = randomBytes(32).toString("hex");
  setApiToken(generated);
  return generated;
}

export function getLicenseCache(): SecretSchema["licenseCache"] {
  return store.get("licenseCache");
}

export function setLicenseCache(value: NonNullable<SecretSchema["licenseCache"]>): void {
  store.set("licenseCache", value);
}
