// ============================================================
// Electron Main Process — HTTP/WS Server + Electron App
// ============================================================

import cors from "cors";
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import express from "express";
import * as crypto from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { WebSocket, WebSocketServer } from "ws";

import {
  addMapping,
  deleteMapping,
  getMappings,
  getPort,
  getSettings,
  setPort,
  updateMapping,
  updateSettings,
  type PrinterMapping,
} from "./config-store";
import {
  decodeIfBase64,
  formatSbplCommand,
  listPrinters,
  printImage,
  printPdf,
  printRaw,
  printTcpRaw,
  writeTempFile,
} from "./printer";
import {
  activateLicense,
  getCurrentLicenseStatus,
  startLicenseRefreshScheduler,
  stopLicenseRefreshScheduler,
  validateLicense,
} from "./license-service";
import { getApiToken, setApiToken } from "./secure-store";
import {
  checkForApplicationUpdate,
  openApplicationUpdate,
} from "./update-service";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let httpServer: http.Server | null = null;
let wss: WebSocketServer | null = null;

// Stats
let totalJobs = 0;
let failedJobs = 0;
const startTime = Date.now();
const FREE_MODE = true;
const FREE_LICENSE_STATUS = {
  valid: true,
  customer: "Free Edition",
  kind: "free",
  plan: "free",
  expiresAt: null,
  offline: true,
  reason: "Free edition — no license required.",
};

function getEffectiveLicenseStatus() {
  return FREE_MODE ? FREE_LICENSE_STATUS : getCurrentLicenseStatus();
}

// Jobs Queue Store
export interface PrintJobItem {
  id: string;
  jobId?: string;
  printer: string;
  logicalName?: string;
  type: string;
  status: "COMPLETED" | "PRINTING" | "FAILED";
  time: string;
  size: string;
  error?: string;
}

const recentJobs: PrintJobItem[] = [];

function recordJob(job: PrintJobItem): void {
  recentJobs.unshift(job);
  if (recentJobs.length > 200) {
    recentJobs.pop();
  }
}

// ------------------------------------------------------------------
// HTTP + WebSocket Server
// ------------------------------------------------------------------

function startServer(port: number): void {
  const expressApp = express();
  expressApp.use((req, res, next) => {
    if (req.header("access-control-request-private-network") === "true") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    next();
  });
  expressApp.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const configured = getSettings().corsOrigin;
        const allowed = configured
          .split(/[\r\n,]+/)
          .map((value) => value.trim())
          .filter(Boolean);
        callback(
          allowed.includes("*") || allowed.includes(origin)
            ? null
            : new Error(`Origin ${origin} is not allowed by CORS`),
          allowed.includes("*") || allowed.includes(origin),
        );
      },
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );
  expressApp.use(express.json({ limit: "50mb" }));

  // --- HTTP Request Logging Middleware ---
  expressApp.use((req, _res, next) => {
    // Skip static assets logging to avoid spamming logs
    if (
      req.url.startsWith("/assets/") ||
      req.url.endsWith(".ico") ||
      req.url.endsWith(".png")
    ) {
      return next();
    }
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const logMsg = `[${new Date().toLocaleTimeString()}] [HTTP] ${req.method} ${req.originalUrl || req.url} from ${clientIp}`;
    console.log(logMsg);
    broadcastWs({ event: "log", payload: logMsg });
    next();
  });

  // Serve static UI files
  const distPath = path.join(__dirname, "../dist");
  expressApp.use(express.static(distPath));

  expressApp.get("/api/status", (_req, res) => {
    res.json({
      running: true,
      version: app.getVersion(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      totalJobs,
      failedJobs,
      port: getPort(),
      license: getEffectiveLicenseStatus(),
    });
  });

  expressApp.get("/api/license/status", (_req, res) => {
    res.json(getEffectiveLicenseStatus());
  });

  const protectPrintRoute: express.RequestHandler = (req, res, next) => {
    const license = getEffectiveLicenseStatus();
    if (!license.valid) {
      return res.status(423).json({
        success: false,
        code: "LICENSE_REQUIRED",
        message: license.reason || "A valid license is required.",
      });
    }
    const expected = getApiToken();
    const supplied = req.header("authorization");
    if (!expected) {
      return res.status(503).json({
        success: false,
        code: "TOKEN_NOT_CONFIGURED",
        message: "The Print Bridge secret token has not been configured.",
      });
    }
    const expectedHeader = Buffer.from(`Bearer ${expected}`);
    const suppliedHeader = Buffer.from(supplied || "");
    if (
      suppliedHeader.length !== expectedHeader.length ||
      !crypto.timingSafeEqual(suppliedHeader, expectedHeader)
    ) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Missing or invalid bearer token.",
      });
    }
    next();
  };

  const demoPrintTimestamps = new Map<string, number>();

  expressApp.get("/api/integration/mappings", protectPrintRoute, (_req, res) => {
    const mappings = getMappings()
      .filter((mapping) => mapping.enabled !== false)
      .map((mapping) => ({
        logicalName: mapping.logicalName,
        physicalName: mapping.physicalName,
        type: mapping.type,
        enabled: mapping.enabled !== false,
      }));
    res.json({ success: true, mappings });
  });

  const demoPayloads: Record<string, string> = {
    pdf: "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMTAwXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAzNCA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDEwIDQwIFRkIChURVNUIFBSSU5UKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTEzIDAwMDAwIG4gCjAwMDAwMDAzMDEgMDAwMDAgbiAKMDAwMDAwMDM4NiAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ2NwolJUVPRgo=",
    raw: "\x1b@=== MRJEE TEST PRINT ===\nBridge connected successfully\n\n\n",
    zpl: "^XA^FO40,40^ADN,32,18^FDMRJEE PRINT BRIDGE^FS^FO40,90^B3N,N,90,Y,N^FD123456789^FS^XZ",
    sbpl:
      "\x1bA\x1bV0050\x1bH0050\x1bP02\x1bL0202\x1bX21,MRJEE PRINT BRIDGE TEST\x1bQ1\x1bZ",
  };

  const isLoopbackRequest = (req: express.Request) => {
    const address = req.socket.remoteAddress || "";
    return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
  };

  const requireDemoAccess = (req: express.Request, res: express.Response) => {
    if (!isLoopbackRequest(req)) {
      res.status(403).json({ success: false, message: "Demo printing is available only from this computer." });
      return false;
    }
    const origin = req.header("origin");
    const allowedDemoOrigins = new Set([
      "https://print.mrjee.id",
      "http://localhost:3000",
      "http://localhost:3100",
      "http://localhost:5173",
    ]);
    if (origin && !allowedDemoOrigins.has(origin)) {
      res.status(403).json({ success: false, message: "This website is not allowed to use trial printing." });
      return false;
    }
    return true;
  };

  expressApp.get("/api/demo/printers", async (req, res) => {
    if (!requireDemoAccess(req, res)) return;
    try {
      res.json({ success: true, printers: await listPrinters() });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || "Could not scan printers." });
    }
  });

  expressApp.post("/api/demo-print", async (req, res) => {
    if (!requireDemoAccess(req, res)) return;

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const lastPrint = demoPrintTimestamps.get(clientIp) || 0;
    if (Date.now() - lastPrint < 5_000) {
      return res.status(429).json({
        success: false,
        code: "DEMO_RATE_LIMITED",
        message: "Please wait 5 seconds before sending another demo print.",
      });
    }

    const printerName =
      typeof req.body?.printerName === "string" ? req.body.printerName.trim() : "";
    const requestedFormat =
      typeof req.body?.format === "string" ? req.body.format.toLowerCase() : "auto";
    if (!printerName || !["auto", "pdf", "raw", "zpl", "sbpl"].includes(requestedFormat)) {
      return res.status(400).json({
        success: false,
        message: "An installed printer and supported demo format are required.",
      });
    }

    const printer = (await listPrinters()).find((item) => item.name === printerName);
    if (!printer) {
      return res.status(404).json({
        success: false,
        message: `Installed printer "${printerName}" was not found.`,
      });
    }

    const format =
      requestedFormat !== "auto"
        ? requestedFormat
        : printer.driverType === "SBPL"
          ? "sbpl"
          : printer.driverType === "ZPL"
            ? "zpl"
            : /epson|xprinter|bixolon|pos|receipt|thermal|tm-/i.test(printer.name)
              ? "raw"
              : "pdf";

    const jobId = uuidv4();
    try {
      await executePrint(printer.name, format, demoPayloads[format], { copies: 1 });
      demoPrintTimestamps.set(clientIp, Date.now());
      totalJobs++;
      return res.json({
        success: true,
        jobId,
        printerName: printer.name,
        resolvedFormat: format,
        message: "Demo print sent successfully.",
      });
    } catch (err: any) {
      failedJobs++;
      return res.status(500).json({
        success: false,
        jobId,
        message: err.message || "Demo print failed.",
      });
    }
  });

  const requireDesktopAccess: express.RequestHandler = (req, res, next) => {
    if (!isLoopbackRequest(req)) {
      return res.status(403).json({ success: false, message: "Desktop configuration is local-only." });
    }
    const origin = req.header("origin");
    const allowedOrigins = new Set([
      `http://localhost:${getPort()}`,
      `http://127.0.0.1:${getPort()}`,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({
        success: false,
        message: "This origin cannot modify desktop configuration.",
      });
    }
    next();
  };

  expressApp.use("/api/config", requireDesktopAccess);
  expressApp.use("/api/mappings", requireDesktopAccess);
  expressApp.get("/api/printers", requireDesktopAccess);

  expressApp.get("/api/config/settings", (_req, res) => {
    res.json(getSettings());
  });

  expressApp.post("/api/config/settings", (req, res) => {
    const { port, corsOrigin, minimizeToTray } = req.body;
    if (typeof port === "number" && (port <= 1024 || port >= 65535)) {
      return res.status(400).json({
        success: false,
        message: "Invalid port number (must be 1025-65534)",
      });
    }
    updateSettings({ port, corsOrigin, minimizeToTray });
    res.json({
      success: true,
      settings: getSettings(),
      message: "Settings saved successfully.",
    });
  });

  expressApp.post("/api/config/port", (req, res) => {
    const { port } = req.body;
    if (typeof port === "number" && port > 1024 && port < 65535) {
      setPort(port);
      res.json({
        success: true,
        port,
        message: "Port updated. Restart app to apply.",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid port number (must be 1025-65534)",
      });
    }
  });

  // --- List OS Printers ---
  expressApp.get("/api/printers", async (_req, res) => {
    try {
      const printers = await listPrinters();
      res.json(printers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Mappings CRUD ---
  expressApp.get("/api/mappings", (_req, res) => {
    res.json(getMappings());
  });

  expressApp.post("/api/mappings", (req, res) => {
    const { logicalName, physicalName, type, enabled, config } = req.body;
    const mapping: PrinterMapping = {
      id: uuidv4(),
      logicalName,
      physicalName,
      type: type || "pdf",
      enabled: enabled !== undefined ? enabled : true,
      config: config || {},
    };
    const mappings = addMapping(mapping);
    broadcastWs({ event: "mappings-updated", payload: mappings });
    res.json(mapping);
  });

  expressApp.put("/api/mappings/:id", (req, res) => {
    const mappings = updateMapping(req.params.id, req.body);
    broadcastWs({ event: "mappings-updated", payload: mappings });
    res.json(mappings);
  });

  expressApp.delete("/api/mappings/:id", (req, res) => {
    const mappings = deleteMapping(req.params.id);
    broadcastWs({ event: "mappings-updated", payload: mappings });
    res.json(mappings);
  });

  // --- Print by Logical Name ---
  expressApp.post("/api/print", protectPrintRoute, async (req, res) => {
    const { logicalName, data, overrides } = req.body;
    const jobId = uuidv4();

    try {
      const mappings = getMappings();
      const mapping = mappings.find((m) => m.logicalName === logicalName);

      if (!mapping) {
        throw new Error(
          `No printer mapping found for logical name: "${logicalName}"`,
        );
      }

      if (mapping.enabled === false) {
        throw new Error(
          `Printer mapping "${logicalName}" is currently disabled in Print Bridge.`,
        );
      }

      const mergedConfig = { ...mapping.config, ...overrides };

      await executePrint(
        mapping.physicalName,
        mapping.type,
        data,
        mergedConfig,
      );

      totalJobs++;
      const payload: PrintJobItem = {
        id: `JOB-${jobId.slice(0, 6).toUpperCase()}`,
        jobId,
        printer: mapping.physicalName,
        logicalName,
        type: mapping.type.toUpperCase(),
        status: "COMPLETED",
        time: new Date().toLocaleTimeString(),
        size: data ? `${(data.length / 1024).toFixed(1)} KB` : "1.0 KB",
      };
      recordJob(payload);
      broadcastWs({ event: "print-success", payload });
      broadcastWs({
        event: "log",
        payload: `[${new Date().toLocaleTimeString()}] [PRINT] Job ${payload.id} sent to "${mapping.physicalName}" (${mapping.logicalName}) - SUCCESS`,
      });
      res.json({
        success: true,
        jobId,
        message: "Print job sent successfully",
      });
    } catch (err: any) {
      failedJobs++;
      const payload: PrintJobItem = {
        id: `JOB-${jobId.slice(0, 6).toUpperCase()}`,
        jobId,
        printer: logicalName,
        logicalName,
        type: "RAW",
        status: "FAILED",
        time: new Date().toLocaleTimeString(),
        size: "0 KB",
        error: err.message,
      };
      recordJob(payload);
      broadcastWs({ event: "print-error", payload });
      broadcastWs({
        event: "log",
        payload: `[${new Date().toLocaleTimeString()}] [ERROR] Job ${payload.id} failed: ${err.message}`,
      });
      res.status(500).json({ success: false, jobId, message: err.message });
    }
  });

  // --- Print Direct ---
  expressApp.post("/api/print-direct", protectPrintRoute, async (req, res) => {
    const { printerName, data, type, ...options } = req.body;
    const jobId = uuidv4();

    try {
      await executePrint(printerName, type || "pdf", data, options);
      totalJobs++;
      const payload: PrintJobItem = {
        id: `JOB-${jobId.slice(0, 6).toUpperCase()}`,
        jobId,
        printer: printerName,
        type: (type || "pdf").toUpperCase(),
        status: "COMPLETED",
        time: new Date().toLocaleTimeString(),
        size: data ? `${(data.length / 1024).toFixed(1)} KB` : "1.0 KB",
      };
      recordJob(payload);
      broadcastWs({ event: "print-success", payload });
      broadcastWs({
        event: "log",
        payload: `[${new Date().toLocaleTimeString()}] [PRINT-DIRECT] Job ${payload.id} sent to "${printerName}" - SUCCESS`,
      });
      res.json({
        success: true,
        jobId,
        message: "Print job sent successfully",
      });
    } catch (err: any) {
      failedJobs++;
      const payload: PrintJobItem = {
        id: `JOB-${jobId.slice(0, 6).toUpperCase()}`,
        printer: printerName,
        type: (type || "pdf").toUpperCase(),
        status: "FAILED",
        time: new Date().toLocaleTimeString(),
        size: "0 KB",
        error: err.message,
      };
      recordJob(payload);
      broadcastWs({ event: "print-error", payload });
      broadcastWs({
        event: "log",
        payload: `[${new Date().toLocaleTimeString()}] [ERROR] Direct print to "${printerName}" failed: ${err.message}`,
      });
      res.status(500).json({ success: false, jobId, message: err.message });
    }
  });

  // --- Jobs Queue API ---
  expressApp.get("/api/jobs", (_req, res) => {
    res.json(recentJobs);
  });

  expressApp.delete("/api/jobs", (_req, res) => {
    recentJobs.length = 0;
    broadcastWs({ event: "jobs-cleared", payload: [] });
    res.json({ success: true, message: "Print jobs cleared" });
  });

  // Create HTTP server
  httpServer = http.createServer(expressApp);

  // WebSocket server
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress || "unknown";
    const logMsg = `[${new Date().toLocaleTimeString()}] [WS] Client connected from ${clientIp}`;
    console.log(logMsg);
    broadcastWs({ event: "log", payload: logMsg });

    ws.send(
      JSON.stringify({
        event: "connected",
        payload: { version: "1.0.0", jobs: recentJobs },
      }),
    );

    ws.on("close", () => {
      const closeMsg = `[${new Date().toLocaleTimeString()}] [WS] Client disconnected (${clientIp})`;
      console.log(closeMsg);
      broadcastWs({ event: "log", payload: closeMsg });
    });
  });

  httpServer.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[Server] Port ${port} is already in use by another Print Bridge instance.`,
      );
    } else {
      console.error("[Server] Server error:", err);
    }
  });

  httpServer.listen(port, () => {
    console.log(`[Server] Print Bridge running on http://localhost:${port}`);
  });
}
/** Print PDF document using Electron's high-fidelity native print engine */
async function printPdfElectron(
  pdfPath: string,
  printerName: string,
  options?: any,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let win = new BrowserWindow({
      show: false,
      webPreferences: {
        webSecurity: false,
        plugins: true,
      },
    });

    const fileUrl = `file://${pdfPath.replace(/\\/g, "/")}#toolbar=0&navpanes=0&scrollbar=0`;
    win.loadURL(fileUrl);

    win.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        const widthVal = options?.size?.width ?? 100;
        const heightVal = options?.size?.height ?? 150;
        const unit = options?.units || "mm";

        let wMm = widthVal;
        let hMm = heightVal;
        if (unit === "in") {
          wMm = widthVal * 25.4;
          hMm = heightVal * 25.4;
        } else if (unit === "cm") {
          wMm = widthVal * 10;
          hMm = heightVal * 10;
        }

        // Handle auto-height or fallback to non-zero values
        wMm = wMm > 0 ? wMm : 100;
        hMm = hMm > 0 ? hMm : 150;

        // Try to parse dimensions directly from PDF MediaBox for perfect accuracy
        try {
          if (fs.existsSync(pdfPath)) {
            const pdfText = fs.readFileSync(pdfPath, "latin1");
            const mediaBoxMatch = pdfText.match(
              /\/MediaBox\s*\[\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*\]/,
            );
            if (mediaBoxMatch) {
              const wPt =
                parseFloat(mediaBoxMatch[3]) - parseFloat(mediaBoxMatch[1]);
              const hPt =
                parseFloat(mediaBoxMatch[4]) - parseFloat(mediaBoxMatch[2]);
              if (wPt > 0 && hPt > 0) {
                wMm = wPt * 0.352778;
                hMm = hPt * 0.352778;
              }
            }
          }
        } catch {
          // ignore
        }

        const isVirtualPdf = printerName.toLowerCase().includes("print to pdf");
        const printOptions: any = {
          silent: !isVirtualPdf,
          margins: {
            marginType: "none",
          },
          copies: options?.copies ?? 1,
        };

        if (!isVirtualPdf) {
          printOptions.deviceName = printerName;
        }

        win.webContents.print(printOptions, (success, failureReason) => {
          win.destroy();
          if (success) {
            resolve();
          } else {
            reject(new Error(`Electron native print failed: ${failureReason}`));
          }
        });
      }, 1000);
    });

    win.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        win.destroy();
        reject(
          new Error(`Failed to load PDF for printing: ${errorDescription}`),
        );
      },
    );
  });
}

/** Rasterize PDF page to printer binary graphics (SBPL / ZPL) */
async function rasterizePdfToGraphics(
  pdfPath: string,
  widthMm: number,
  heightMm: number,
  densityDpi: number,
  driverType: "SBPL" | "ZPL",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let finalWidthMm = widthMm > 0 ? widthMm : 100;
    let finalHeightMm = heightMm > 0 ? heightMm : 150;

    try {
      if (fs.existsSync(pdfPath)) {
        const pdfText = fs.readFileSync(pdfPath, "latin1");
        const mediaBoxMatch = pdfText.match(
          /\/MediaBox\s*\[\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*\]/,
        );
        if (mediaBoxMatch) {
          const wPt =
            parseFloat(mediaBoxMatch[3]) - parseFloat(mediaBoxMatch[1]);
          const hPt =
            parseFloat(mediaBoxMatch[4]) - parseFloat(mediaBoxMatch[2]);
          if (wPt > 0 && hPt > 0) {
            finalWidthMm = wPt * 0.352778;
            finalHeightMm = hPt * 0.352778;
            console.log(
              `[Rasterizer] Parsed MediaBox from PDF: ${finalWidthMm.toFixed(1)}mm x ${finalHeightMm.toFixed(1)}mm`,
            );
          }
        }
      }
    } catch (e) {
      console.warn(
        "[Rasterizer] Failed to read PDF file for MediaBox parsing, using fallback sizing:",
        e,
      );
    }

    // Ensure dimensions are positive to prevent BrowserWindow crash
    finalWidthMm = Math.max(10, finalWidthMm);
    finalHeightMm = Math.max(10, finalHeightMm);

    const dpmm = densityDpi === 300 ? 12 : densityDpi === 600 ? 24 : 8;
    const widthPixels = Math.round(finalWidthMm * dpmm);
    const heightPixels = Math.round(finalHeightMm * dpmm);

    console.log(
      `[Rasterizer] Creating hidden window sizing: ${widthPixels}x${heightPixels} px (${finalWidthMm.toFixed(1)}x${finalHeightMm.toFixed(1)} mm)`,
    );

    let win = new BrowserWindow({
      width: widthPixels,
      height: heightPixels,
      show: false, // Don't show immediately, use showInactive() later
      skipTaskbar: true,
      frame: false,
      focusable: false,
      webPreferences: {
        webSecurity: false,
        plugins: true,
      },
    });

    // Make the window invisible but still painted by DWM
    win.setOpacity(0);
    win.setIgnoreMouseEvents(true);
    win.showInactive();

    const { pathToFileURL } = require("url");
    const fileUrl = `${pathToFileURL(pdfPath).href}#toolbar=0&navpanes=0&scrollbar=0`;
    win.loadURL(fileUrl);

    win.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage();
          const rgbaBuf = image.toBitmap();
          const { width, height } = image.getSize();
          win.destroy();

          const bytesPerRow = Math.ceil(width / 8);
          const totalBytes = bytesPerRow * height;
          const packedBytes = Buffer.alloc(totalBytes);

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const offset = (y * width + x) * 4;
              const r = rgbaBuf[offset];
              const g = rgbaBuf[offset + 1];
              const b = rgbaBuf[offset + 2];
              const a = rgbaBuf[offset + 3];

              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              const isBlack = a >= 128 && gray < 128;

              if (isBlack) {
                const byteIdx = y * bytesPerRow + Math.floor(x / 8);
                const bitIdx = 7 - (x % 8);
                packedBytes[byteIdx] |= 1 << bitIdx;
              }
            }
          }

          if (driverType === "SBPL") {
            const widthStr = String(bytesPerRow).padStart(3, "0");
            const heightStr = String(height).padStart(4, "0");
            const header = Buffer.from(
              `\x1bGH${widthStr}${heightStr}`,
              "ascii",
            );
            const jobHeader = Buffer.from("\x1bA\x1bV0000\x1bH0000", "ascii");
            // \x1bQ1 tells SATO to print 1 copy. Without this, some SATO models will just buffer and do nothing.
            const jobFooter = Buffer.from("\x1bQ1\x1bZ", "ascii");
            const finalBuf = Buffer.concat([
              jobHeader,
              header,
              packedBytes,
              jobFooter,
            ]);
            resolve(finalBuf);
          } else {
            const hexData = packedBytes.toString("hex").toUpperCase();
            const zplText = `^XA^FO0,0^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hexData}^FS^XZ`;
            resolve(Buffer.from(zplText, "ascii"));
          }
        } catch (e) {
          win.destroy();
          reject(e);
        }
      }, 1000);
    });

    win.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        win.destroy();
        reject(new Error(`Failed to render PDF: ${errorDescription}`));
      },
    );
  });
}

/** Execute a print job based on type */
async function executePrint(
  printerName: string,
  type: string,
  data: string,
  options: any,
): Promise<void> {
  console.log(`[Print] Sending ${type || "auto"} job to "${printerName}"`);

  // 1. Check if printerName is an IP address or host (e.g. 192.168.1.50 or 192.168.1.50:9100)
  const ipMatch = printerName.match(
    /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d+))?$/,
  );
  if (ipMatch) {
    const ip = ipMatch[1];
    const port = ipMatch[2] ? parseInt(ipMatch[2], 10) : 9100;
    await printTcpRaw(ip, port, data);
    return;
  }

  // 2. Auto-detect payload type if base64 or raw string
  const decoded = decodeIfBase64(data);
  const format = (type || "").toLowerCase();

  // Check if payload is PDF
  const isPdfPayload =
    format === "pdf" ||
    (decoded.buffer.length >= 5 &&
      decoded.buffer.slice(0, 5).toString("utf-8") === "%PDF-");

  // Check if payload is Image
  const isImagePayload =
    format === "image" ||
    format === "png" ||
    format === "jpg" ||
    format === "jpeg" ||
    (decoded.buffer.length >= 8 &&
      (decoded.buffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a" ||
        decoded.buffer.slice(0, 2).toString("hex") === "ffd8"));

  if (isPdfPayload) {
    const base64Pdf = decoded.isBase64
      ? data
      : decoded.buffer.toString("base64");
    const isSato = /sato|cl4nx|cg408|ws4|pw2|ct4i|mb400i/i.test(printerName);
    const isZebra = /zebra/i.test(printerName);
    const resolvedFormat =
      format === "sbpl" || format === "zpl"
        ? format.toUpperCase()
        : isSato
          ? "SBPL"
          : isZebra
            ? "ZPL"
            : null;

    if (resolvedFormat) {
      console.log(
        `[Print] Auto-detect: Printing PDF to printer "${printerName}" using raw ${resolvedFormat} graphics...`,
      );
      const tempPdfPath = writeTempFile(base64Pdf, "pdf");
      try {
        const widthVal = options?.size?.width ?? 100;
        const heightVal = options?.size?.height ?? 150;
        const unit = options?.units || "mm";
        const density = options?.density ?? 203; // Default to 203 DPI (8 dpmm) for standard SATO/Zebra printers

        let wMm = widthVal;
        let hMm = heightVal;
        if (unit === "in") {
          wMm = widthVal * 25.4;
          hMm = heightVal * 25.4;
        } else if (unit === "cm") {
          wMm = widthVal * 10;
          hMm = heightVal * 10;
        }

        const graphicsBuffer = await rasterizePdfToGraphics(
          tempPdfPath,
          wMm,
          hMm,
          density,
          resolvedFormat as "SBPL" | "ZPL",
        );

        await printRaw(printerName, graphicsBuffer);
      } finally {
        try {
          if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
        } catch {
          // ignore
        }
      }
    } else {
      // Use Electron's built-in Chromium PDF renderer (PDFium) as primary method
      // for ALL physical printers — this is analogous to how QZ Tray uses its own
      // built-in PDFBox renderer internally, making it far more reliable than
      // spawning external processes like SumatraPDF.
      console.log(
        `[Print] Printing PDF to physical printer "${printerName}" using Electron native print engine...`,
      );
      const tempPdfPath = writeTempFile(base64Pdf, "pdf");
      try {
        await printPdfElectron(tempPdfPath, printerName, options);
        console.log(
          `[Print] Electron native print succeeded for "${printerName}".`,
        );
      } catch (err: any) {
        const { dialog } = require("electron");
        dialog.showErrorBox("Rasterization Error Debug", `Failed to rasterize PDF:\n\n${err.message}\n\nFalling back to native print...`);
        console.error(
          `[Print] Rasterization failed: ${err.message}. Falling back to native print...`,
        );
      }
      try {
        await printPdfElectron(tempPdfPath, printerName, options);
        console.log(
          `[Print] Electron native print succeeded for "${printerName}".`,
        );
      } catch (electronErr: any) {
        console.warn(
          `[Print] Electron native print failed: ${electronErr.message}. Falling back to pdf-to-printer (SumatraPDF)...`,
        );
        // Fallback: try pdf-to-printer with SumatraPDF
        let sumatraPdfPath: string | undefined = undefined;
        if (app.isPackaged) {
          const pdfToPrinterDist = path.join(
            process.resourcesPath,
            "app.asar.unpacked",
            "node_modules",
            "pdf-to-printer",
            "dist",
          );
          if (fs.existsSync(pdfToPrinterDist)) {
            const exeName = fs
              .readdirSync(pdfToPrinterDist)
              .find(
                (f) =>
                  f.toLowerCase().includes("sumatrapdf") && f.endsWith(".exe"),
              );
            if (exeName) {
              sumatraPdfPath = path.join(pdfToPrinterDist, exeName);
            }
          }
        }
        await printPdf(printerName, base64Pdf, {
          ...options,
          sumatraPdfPath,
        });
      } finally {
        try {
          if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
        } catch {
          // ignore
        }
      }
    }
  } else if (isImagePayload) {
    const base64Img = decoded.isBase64
      ? data
      : decoded.buffer.toString("base64");
    await printImage(printerName, base64Img, options);
  } else {
    // SBPL / ZPL / Raw Command Payload
    const sbplBuffer = formatSbplCommand(data);
    await printRaw(printerName, sbplBuffer);
  }
}

/** Broadcast a message to all connected WebSocket clients */
function broadcastWs(message: object): void {
  if (!wss) return;
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Electron App
// ------------------------------------------------------------------

// Set Windows AppUserModelID for taskbar icon grouping
if (process.platform === "win32") {
  app.setAppUserModelId("com.mrjee.printbridge");
}

function getAppIconPath(): string {
  // 1. Production packaged extraResources
  if (process.resourcesPath) {
    const resIco = path.join(process.resourcesPath, "icon.ico");
    if (fs.existsSync(resIco)) return resIco;
    const resPng = path.join(process.resourcesPath, "icon.png");
    if (fs.existsSync(resPng)) return resPng;
  }

  // 2. Vite dist folder output
  const distIco = path.join(__dirname, "../dist/icon.ico");
  if (fs.existsSync(distIco)) return distIco;
  const distPng = path.join(__dirname, "../dist/icon.png");
  if (fs.existsSync(distPng)) return distPng;

  // 3. Public dev folder
  const devIco = path.join(__dirname, "../public/icon.ico");
  if (fs.existsSync(devIco)) return devIco;
  const devPng = path.join(__dirname, "../public/icon.png");
  if (fs.existsSync(devPng)) return devPng;

  return path.join(__dirname, "../public/icon.ico");
}

let isQuitting = false;

app.on("before-quit", () => {
  isQuitting = true;
  stopLicenseRefreshScheduler();
});

function createWindow(): void {
  Menu.setApplicationMenu(null);
  const iconPath = getAppIconPath();
  const appIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 780,
    minHeight: 520,
    title: "Mrjee Print Bridge",
    icon: iconPath,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const rendererPromise =
    !app.isPackaged
      ? mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173")
      : mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  rendererPromise.catch((error) => {
    console.error("[Window] Failed to load renderer:", error);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[Window] Renderer load failed (${errorCode}) ${errorDescription}: ${validatedURL}`,
      );
    },
  );

  mainWindow.on("ready-to-show", () => {
    if (mainWindow && !appIcon.isEmpty()) {
      try {
        mainWindow.setIcon(appIcon);
      } catch {
        // Fallback
      }
    }
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    const settings = getSettings();
    if (settings.minimizeToTray && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

// Window control IPC handlers
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on("window-close", () => {
  const settings = getSettings();
  if (settings.minimizeToTray) {
    mainWindow?.hide();
  } else {
    mainWindow?.close();
  }
});

// Windows Startup auto-run IPC handlers
ipcMain.handle("get-auto-start", () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("set-auto-start", (_event, enabled: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath("exe"),
  });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("license-status", () => getEffectiveLicenseStatus());
ipcMain.handle(
  "license-activate",
  async (_event, input: { licenseKey?: string; apiToken?: string }) => {
    if (!input?.licenseKey?.trim() || !input?.apiToken?.trim()) {
      return { valid: false, reason: "License key and secret token are required." };
    }
    const status = await activateLicense(input.licenseKey);
    if (status.valid) setApiToken(input.apiToken);
    return status;
  },
);
ipcMain.handle("api-token-get", () => getApiToken());
ipcMain.handle("update-check", (_event, force = false) =>
  checkForApplicationUpdate(Boolean(force)),
);
ipcMain.handle("update-open", (_event, url: string) =>
  openApplicationUpdate(url),
);

function createTray(): void {
  const iconPath = getAppIconPath();
  let trayIcon = nativeImage.createFromPath(iconPath);
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createFromPath(
      path.join(__dirname, "../public/icon.png"),
    );
  }
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Mrjee Print Bridge",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Open Dashboard",
      click: () => mainWindow?.show(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        mainWindow?.destroy();
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Mrjee Print Bridge — Active");
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    mainWindow?.show();
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (!FREE_MODE) {
      await validateLicense();
      startLicenseRefreshScheduler();
    }
    const port = getPort();
    startServer(port);
    createWindow();
    createTray();
  });
}

app.on("window-all-closed", () => {
  const settings = getSettings();
  if (!settings.minimizeToTray || isQuitting) {
    app.quit();
  }
});
