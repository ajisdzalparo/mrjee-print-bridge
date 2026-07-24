// ============================================================
// Config Store — Persistent local storage for printer mappings
// ============================================================

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface PrintOptions {
  copies?: number;
  size?: { width: number; height: number };
  units?: "in" | "mm" | "cm";
  density?: number;
  rasterize?: boolean;
  orientation?: "portrait" | "landscape";
  colorType?: "blackwhite" | "color" | "grayscale";
  margins?:
    | number
    | { top?: number; left?: number; bottom?: number; right?: number };
}

export interface PrinterMapping {
  id: string;
  logicalName: string;
  physicalName: string;
  type: "pdf" | "raw" | "zpl" | "epl" | "sbpl" | "escpos" | "image" | string;
  enabled?: boolean;
  config: PrintOptions;
}

export interface ConfigData {
  port: number;
  corsOrigin?: string;
  minimizeToTray?: boolean;
  mappings: PrinterMapping[];
}

const CONFIG_DIR = path.join(os.homedir(), ".print-bridge");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: ConfigData = {
  port: 9000,
  corsOrigin:
    "https://print.mrjee.id,http://localhost:3000,http://localhost:3100,http://localhost:5173",
  minimizeToTray: true,
  mappings: [],
};

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): ConfigData {
  ensureConfigDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      // Ensure enabled default is true for existing mappings if undefined
      if (Array.isArray(parsed.mappings)) {
        parsed.mappings = parsed.mappings.map((m: any) => ({
          ...m,
          enabled: m.enabled !== undefined ? m.enabled : true,
        }));
      }
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.error("[ConfigStore] Failed to load config:", err);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: ConfigData): void {
  ensureConfigDir();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[ConfigStore] Failed to save config:", err);
  }
}

export function getMappings(): PrinterMapping[] {
  return loadConfig().mappings;
}

export function addMapping(mapping: PrinterMapping): PrinterMapping[] {
  const config = loadConfig();
  config.mappings.push({ enabled: true, ...mapping });
  saveConfig(config);
  return config.mappings;
}

export function updateMapping(
  id: string,
  updates: Partial<PrinterMapping>,
): PrinterMapping[] {
  const config = loadConfig();
  const index = config.mappings.findIndex((m) => m.id === id);
  if (index !== -1) {
    config.mappings[index] = { ...config.mappings[index], ...updates };
    saveConfig(config);
  }
  return config.mappings;
}

export function deleteMapping(id: string): PrinterMapping[] {
  const config = loadConfig();
  config.mappings = config.mappings.filter((m) => m.id !== id);
  saveConfig(config);
  return config.mappings;
}

export function getPort(): number {
  return loadConfig().port;
}

export function setPort(port: number): void {
  const config = loadConfig();
  config.port = port;
  saveConfig(config);
}

export function getSettings(): {
  port: number;
  corsOrigin: string;
  minimizeToTray: boolean;
} {
  const config = loadConfig();
  return {
    port: config.port || 9000,
    corsOrigin: config.corsOrigin || "*",
    minimizeToTray: config.minimizeToTray !== false,
  };
}

export function updateSettings(
  settings: Partial<{
    port: number;
    corsOrigin: string;
    minimizeToTray: boolean;
  }>,
): void {
  const config = loadConfig();
  if (typeof settings.port === "number") config.port = settings.port;
  if (typeof settings.corsOrigin === "string")
    config.corsOrigin = settings.corsOrigin;
  if (typeof settings.minimizeToTray === "boolean")
    config.minimizeToTray = settings.minimizeToTray;
  saveConfig(config);
}
