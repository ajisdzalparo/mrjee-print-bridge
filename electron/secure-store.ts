import { safeStorage } from "electron";
import Store from "electron-store";

interface SecretSchema {
  licenseKey?: string;
  apiToken?: string;
  licenseCache?: {
    valid: boolean;
    checkedAt: string;
    expiresAt?: string | null;
    customer?: string;
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

export function getLicenseCache(): SecretSchema["licenseCache"] {
  return store.get("licenseCache");
}

export function setLicenseCache(value: NonNullable<SecretSchema["licenseCache"]>): void {
  store.set("licenseCache", value);
}
