// ============================================================
// Printer — OS printer interaction (list, print PDF/Raw/Image)
// ============================================================

import { exec } from "child_process";
import * as fs from "fs";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import pdfToPrinter from "pdf-to-printer";
import type { PrintOptions } from "./config-store";

export interface PhysicalPrinter {
  name: string;
  isDefault: boolean;
  status?: string;
  isSato?: boolean;
  isThermal?: boolean;
  driverType?: "SBPL" | "ZPL" | "EPL" | "GENERIC";
}

/**
 * List all printers installed on the OS (Windows).
 * Uses PowerShell's Get-Printer cmdlet.
 */
export function listPrinters(): Promise<PhysicalPrinter[]> {
  return new Promise((resolve, reject) => {
    const cmd =
      'powershell -Command "Get-Printer | Select-Object Name, PrinterStatus, Default | ConvertTo-Json"';

    exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        console.error("[Printer] Error listing printers:", stderr);
        // Fallback: try wmic
        return listPrintersWmic().then(resolve).catch(reject);
      }

      try {
        let parsed = JSON.parse(stdout);
        if (!Array.isArray(parsed)) parsed = [parsed];

        const printers: PhysicalPrinter[] = parsed.map((p: any) => {
          const name = String(p.Name || "");
          const isSato = /sato|cl4nx|cg408|ws4|pw2|ct4i|mb400i/i.test(name);
          const isThermal =
            isSato || /zebra|tsc|godex|bixolon|epson|xprinter/i.test(name);
          const driverType = isSato
            ? "SBPL"
            : /zebra/i.test(name)
              ? "ZPL"
              : "GENERIC";

          return {
            name,
            isDefault: p.Default === true,
            status: String(p.PrinterStatus ?? "Unknown"),
            isSato,
            isThermal,
            driverType,
          };
        });

        resolve(printers);
      } catch (parseErr) {
        console.error("[Printer] Parse error:", parseErr);
        listPrintersWmic().then(resolve).catch(reject);
      }
    });
  });
}

/** Fallback printer listing using wmic */
function listPrintersWmic(): Promise<PhysicalPrinter[]> {
  return new Promise((resolve, reject) => {
    exec(
      "wmic printer get Name,Default /format:csv",
      { timeout: 10000 },
      (err, stdout) => {
        if (err) {
          reject(new Error("Could not list printers"));
          return;
        }

        const lines = stdout.trim().split("\n").filter(Boolean);
        const printers: PhysicalPrinter[] = [];

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(",");
          if (parts.length >= 3) {
            const name = parts[2]?.trim() || "";
            const isSato = /sato|cl4nx|cg408|ws4|pw2|ct4i|mb400i/i.test(name);
            const isThermal =
              isSato || /zebra|tsc|godex|bixolon|epson|xprinter/i.test(name);
            printers.push({
              name,
              isDefault: parts[1]?.trim() === "TRUE",
              isSato,
              isThermal,
              driverType: isSato ? "SBPL" : "GENERIC",
            });
          }
        }

        resolve(printers.filter((p) => p.name));
      },
    );
  });
}

/**
 * Auto-detect and decode Base64 strings.
 */
export function decodeIfBase64(data: string): {
  isBase64: boolean;
  buffer: Buffer;
  text: string;
} {
  if (!data) return { isBase64: false, buffer: Buffer.alloc(0), text: "" };

  let raw = data.trim();
  const prefixMatch = raw.match(/^data:[^;]+;base64,/i);
  if (prefixMatch) {
    raw = raw.substring(prefixMatch[0].length).trim();
  }

  const cleanBase64 = raw.replace(/\s/g, "");

  // Allow URL-safe Base64 chars (- and _) and remove the strict padding check
  // because many modern backends send unpadded Base64.
  // Note: Raw SBPL/ZPL strings contain characters like <, >, ^, or \x1b which
  // will fail this regex, making it safe to aggressively detect Base64.
  const isBase64Pattern =
    /^[A-Za-z0-9+/=_\-]+$/.test(cleanBase64) && cleanBase64.length > 8;

  if (isBase64Pattern) {
    try {
      const decodedBuf = Buffer.from(cleanBase64, "base64");
      if (decodedBuf.length > 0) {
        return {
          isBase64: true,
          buffer: decodedBuf,
          text: decodedBuf.toString("utf-8"),
        };
      }
    } catch {
      // Fallthrough
    }
  }

  return {
    isBase64: false,
    buffer: Buffer.from(data, "utf-8"),
    text: data,
  };
} /**
 * Format SATO SBPL raw command text or buffer.
 * Converts control tags (<ESC>, <STX>, <ETX>, ^A) into binary escape sequences.
 */
export function formatSbplCommand(data: string): Buffer {
  if (!data) return Buffer.alloc(0);

  const decoded = decodeIfBase64(data);

  // Check if text is PDF
  if (
    decoded.buffer.length >= 5 &&
    decoded.buffer.slice(0, 5).toString("utf-8") === "%PDF-"
  ) {
    return decoded.buffer;
  }

  // To safely do string replacements on binary data without corrupting bytes,
  // we must use 'latin1' encoding (each character corresponds to exactly one byte).
  let text = decoded.buffer.toString("latin1");

  // First convert escaped string sequences like \x1b, \n to actual binary characters
  let formatted = text
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\e/gi, "\x1b");

  // Then replace the shorthand tags
  formatted = formatted
    .replace(/<ESC>/gi, "\x1b")
    .replace(/<STX>/gi, "\x02")
    .replace(/<ETX>/gi, "\x03")
    .replace(/<ENQ>/gi, "\x05");

  if (formatted.includes("^A") || formatted.includes("^Z")) {
    formatted = formatted.replace(/\^A/g, "\x1bA").replace(/\^Z/g, "\x1bZ");
  }

  // Convert back to buffer using latin1 to restore the exact bytes
  return Buffer.from(formatted, "latin1");
}

/**
 * Send raw data directly over TCP/IP socket (e.g. SATO/Zebra network printers on port 9100).
 */
export async function printTcpRaw(
  host: string,
  port: number = 9100,
  data: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(10000);

    const buf = formatSbplCommand(data);

    socket.connect(port, host, () => {
      socket.write(buf, () => {
        socket.end();
        console.log(`[Printer] Direct TCP raw print sent to ${host}:${port}`);
        resolve();
      });
    });

    socket.on("error", (err) => {
      socket.destroy();
      console.error(
        `[Printer] TCP raw print error (${host}:${port}):`,
        err.message,
      );
      reject(
        new Error(`TCP Raw Print Error (${host}:${port}): ${err.message}`),
      );
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`TCP Raw Print Timeout (${host}:${port})`));
    });
  });
}

/**
 * Helper to convert data string (Base64 or plain text) or Buffer into Buffer.
 */
function toDataBuffer(data: string | Buffer): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (!data) return Buffer.alloc(0);
  let cleanData = data.trim();
  const prefixMatch = cleanData.match(/^data:[^;]+;base64,/);
  if (prefixMatch) {
    cleanData = cleanData.substring(prefixMatch[0].length).trim();
  }

  const isBase64 =
    /^[A-Za-z0-9+/=\s]+$/.test(cleanData) &&
    cleanData.replace(/\s/g, "").length % 4 === 0;

  if (isBase64) {
    try {
      const decodedBuf = Buffer.from(cleanData.replace(/\s/g, ""), "base64");
      if (decodedBuf.length > 0) {
        return decodedBuf;
      }
    } catch {
      // Fallthrough to utf-8 buffer
    }
  }

  return Buffer.from(data, "utf-8");
}

/**
 * Write base64, raw string, or Buffer data to a temporary file and return the path.
 */
export function writeTempFile(
  data: string | Buffer,
  extension: string,
): string {
  const tmpDir = path.join(os.tmpdir(), "print-bridge");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const filename = `print-${Date.now()}.${extension}`;
  const filepath = path.join(tmpDir, filename);

  const buf = toDataBuffer(data);
  fs.writeFileSync(filepath, buf);
  return filepath;
}

/**
 * Clean up a temporary file after printing.
 */
function cleanupTempFile(filepath: string): void {
  setTimeout(() => {
    try {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    } catch {
      // Ignore cleanup errors
    }
  }, 5000);
}

/**
 * Print a PDF to a specific printer.
 * Uses SumatraPDF CLI or PowerShell printing on Windows.
 */
export async function printPdf(
  printerName: string,
  base64Data: string,
  options?: PrintOptions,
): Promise<void> {
  const filepath = writeTempFile(base64Data, "pdf");
  const copies = options?.copies ?? 1;

  try {
    console.log(
      `[Printer] Printing PDF using pdf-to-printer (SumatraPDF) to "${printerName}"...`,
    );
    await pdfToPrinter.print(filepath, {
      printer: printerName,
      copies,
      sumatraPdfPath: (options as any)?.sumatraPdfPath,
    });
    console.log(`[Printer] PDF printed successfully to "${printerName}"`);
  } catch (err: any) {
    console.warn(
      `[Printer] pdf-to-printer failed: ${err.message}. Trying PowerShell fallback...`,
    );
    await new Promise<void>((resolve, reject) => {
      const psCmd = `
        $copies = ${copies}
        for ($i = 0; $i -lt $copies; $i++) {
          Start-Process -FilePath "${filepath.replace(/\\/g, "\\\\")}" -Verb PrintTo -ArgumentList '"${printerName}"' -Wait
        }
      `.trim();

      exec(
        `powershell -Command "${psCmd}"`,
        { timeout: 30000 },
        (psErr, _stdout, stderr) => {
          if (psErr) {
            console.error("[Printer] PDF print error:", stderr);
            reject(
              new Error(`Failed to print PDF: ${stderr || psErr.message}`),
            );
          } else {
            resolve();
          }
        },
      );
    });
  } finally {
    cleanupTempFile(filepath);
  }
}

/**
 * Print raw text/commands (ESC/POS, ZPL, SBPL) to a printer.
 * Sends data directly to the printer using Windows raw printing.
 */
export async function printRaw(
  printerName: string,
  rawData: string | Buffer,
): Promise<void> {
  const filepath = writeTempFile(rawData, "bin");
  const psScriptPath = filepath.replace(/\.bin$/, ".ps1");

  return new Promise<void>((resolve, reject) => {
    const escapedFile = filepath.replace(/\\/g, "\\\\");
    const escapedPrinter = printerName.replace(/"/g, '`"');

    const psCmd = `
      $file = "${escapedFile}"
      $printer = "${escapedPrinter}"
      $code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Print Bridge RAW Job";
        di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int dwWritten = 0;
                    bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
            return true;
        }
        return false;
    }
}
"@
      Add-Type -TypeDefinition $code
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $result = [RawPrinter]::SendBytesToPrinter($printer, $bytes)
      if (-not $result) {
          throw "Failed to open printer '$printer' or write raw bytes. Ensure the printer exists and is online."
      }
    `.trim();

    try {
      fs.writeFileSync(psScriptPath, psCmd, "utf-8");
    } catch (writeErr: any) {
      cleanupTempFile(filepath);
      return reject(
        new Error(
          `Failed to write powershell print script: ${writeErr.message}`,
        ),
      );
    }

    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`,
      { timeout: 20000 },
      (err, stdout, stderr) => {
        // Clean up ps script immediately
        try {
          if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);
        } catch {
          // ignore
        }

        if (err) {
          console.warn(
            `[Printer] Primary PowerShell raw print failed: ${stderr || err.message}. Attempting copy fallback.`,
          );
          const fallbackCmd = `copy /b "${filepath}" "\\\\%COMPUTERNAME%\\${printerName}"`;
          exec(
            fallbackCmd,
            { timeout: 15000, shell: "cmd.exe" },
            (fbErr, _fbStdout, fbStderr) => {
              cleanupTempFile(filepath);
              if (fbErr) {
                console.error(
                  "[Printer] Fallback copy raw print error:",
                  fbStderr,
                );
                reject(
                  new Error(
                    `Failed to print raw data: ${fbStderr || fbErr.message} (PS Error: ${stderr || err.message})`,
                  ),
                );
              } else {
                resolve();
              }
            },
          );
        } else {
          cleanupTempFile(filepath);
          resolve();
        }
      },
    );
  });
}
/**
 * Print an image (PNG/JPG) to a printer.
 */
export async function printImage(
  printerName: string,
  base64Data: string,
  options?: PrintOptions,
): Promise<void> {
  // For images, we convert to a temporary file and use the same PDF print path
  const filepath = writeTempFile(base64Data, "png");
  const copies = options?.copies ?? 1;

  return new Promise<void>((resolve, reject) => {
    const psCmd = `
      $copies = ${copies}
      for ($i = 0; $i -lt $copies; $i++) {
        Start-Process -FilePath "${filepath.replace(/\\/g, "\\\\")}" -Verb PrintTo -ArgumentList '"${printerName}"' -Wait
      }
    `.trim();

    exec(
      `powershell -Command "${psCmd}"`,
      { timeout: 30000 },
      (err, _stdout, stderr) => {
        cleanupTempFile(filepath);
        if (err) {
          reject(new Error(`Failed to print image: ${stderr || err.message}`));
        } else {
          resolve();
        }
      },
    );
  });
}
