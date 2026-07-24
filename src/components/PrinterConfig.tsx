import { useEffect, useRef, useState } from "react";
import type { PrinterMapping } from "../App";

interface PhysicalPrinter {
  name: string;
  isDefault: boolean;
}

interface Props {
  mapping: PrinterMapping;
  printers: PhysicalPrinter[];
  onChange: (updated: PrinterMapping) => void;
  onUpdate: (id: string, updates: PrinterMapping) => void;
  onTestPrint: (mapping: PrinterMapping, customData?: string) => void;
  onRefreshPrinters: () => void;
}

// ── Preset test payloads for every supported format ──
const TEST_PRESETS: Record<
  string,
  { label: string; description: string; data: string }[]
> = {
  pdf: [
    {
      label: "Simple PDF Label",
      description: "PDF dokumen kecil bertuliskan 'TEST PRINT'",
      data: "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMTAwXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAzNCA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDEwIDQwIFRkIChURVNUIFBSSU5UKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTEzIDAwMDAwIG4gCjAwMDAwMDAzMDEgMDAwMDAgbiAKMDAwMDAwMDM4NiAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ2NwolJUVPRgo=",
    },
  ],
  base64: [
    {
      label: "Base64 PDF Payload",
      description: "Base64 encoded PDF — auto-detect sebagai PDF",
      data: "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMTAwXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAzNCA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDEwIDQwIFRkIChURVNUIFBSSU5UKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTEzIDAwMDAwIG4gCjAwMDAwMDAzMDEgMDAwMDAgbiAKMDAwMDAwMDM4NiAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ2NwolJUVPRgo=",
    },
    {
      label: "Base64 Raw Text",
      description: "Base64 encoded raw text string",
      data: btoa(
        "=== MJ PRINT BRIDGE TEST ===\nBase64 Raw Text Decode OK\nTimestamp: " +
          new Date().toISOString() +
          "\n\n",
      ),
    },
  ],
  sbpl: [
    {
      label: "SATO SBPL Label",
      description: "SATO SBPL command — cetak teks + barcode",
      data: "\\x1bA\\x1bV0050\\x1bH0050\\x1bP02\\x1bL0202\\x1bX21,MJ PRINT BRIDGE - SATO SBPL TEST\\x1bV0120\\x1bH0050\\x1bBG02080123456789\\x1bZ",
    },
    {
      label: "SATO SBPL (ASCII shorthand)",
      description: "SATO SBPL dengan format <ESC> shorthand",
      data: "<ESC>A<ESC>V0050<ESC>H0050<ESC>P02<ESC>L0202<ESC>X21,SATO TEST ASCII FORMAT<ESC>V0120<ESC>H0050<ESC>BG02080123456789<ESC>Z",
    },
  ],
  zpl: [
    {
      label: "Zebra ZPL Label",
      description: "ZPL command — cetak teks + barcode Code128",
      data: "^XA^FO50,50^ADN,36,20^FDTEST PRINT MJ BRIDGE^FS^FO50,100^B3N,N,100,Y,N^FD12345678^FS^XZ",
    },
    {
      label: "Zebra ZPL QR Code",
      description: "ZPL command — cetak QR Code",
      data: "^XA^FO50,50^ADN,36,20^FDQR CODE TEST^FS^FO50,100^BQN,2,6^FDMA,https://mjprintbridge.local^FS^XZ",
    },
  ],
  epl: [
    {
      label: "Eltron EPL Label",
      description: "EPL command — cetak teks sederhana",
      data: 'N\nA50,50,0,4,1,1,N,"TEST PRINT MJ BRIDGE"\nA50,100,0,3,1,1,N,"EPL Engine OK"\nP1\n',
    },
  ],
  escpos: [
    {
      label: "ESC/POS Receipt",
      description: "ESC/POS thermal receipt — teks + cut",
      data: "\\x1b\\x40\\x1b\\x61\\x01=== MJ PRINT BRIDGE ===\\n\\x1b\\x61\\x00Thermal Receipt Test\\nItem 1         Rp 10.000\\nItem 2         Rp 25.000\\n--------------------------\\nTotal          Rp 35.000\\n\\n\\n\\x1d\\x56\\x00",
    },
    {
      label: "ESC/POS Bold + Center",
      description: "ESC/POS receipt dengan bold dan center alignment",
      data:
        "\\x1b\\x40\\x1b\\x61\\x01\\x1b\\x45\\x01=== KASIR ===\\x1b\\x45\\x00\\n\\x1b\\x61\\x00Struk Penjualan\\nTanggal: " +
        new Date().toLocaleDateString() +
        "\\n\\n\\x1d\\x56\\x00",
    },
  ],
  raw: [
    {
      label: "Raw Text Command",
      description:
        "Plain text — dikirim langsung ke printer sebagai raw binary",
      data: "RAW PRINT TEST\nMJ Print Bridge v1.5\nDirect Binary Command\n\n",
    },
    {
      label: "Raw ESC/POS Init + Text",
      description: "Raw binary ESC/POS init lalu cetak teks",
      data: "\\x1b\\x40RAW MODE TEST\\nPrinter OK\\n\\n\\n",
    },
  ],
  image: [
    {
      label: "Small PNG Dot",
      description: "PNG 1x1 pixel — test image rendering pipeline",
      data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    },
  ],
};

// ── Preview helper functions and parsers ──

const detectFormat = (
  text: string,
): "pdf" | "image" | "zpl" | "epl" | "sbpl" | "escpos" | "raw" => {
  const cleaned = text.trim();
  if (!cleaned) return "raw";

  // Raw binary signatures
  if (cleaned.startsWith("%PDF")) return "pdf";
  if (
    cleaned.startsWith("\x89PNG") ||
    cleaned.includes("JFIF") ||
    cleaned.startsWith("GIF8")
  )
    return "image";

  // Base64 signatures
  if (cleaned.startsWith("data:application/pdf;base64,")) return "pdf";
  if (cleaned.startsWith("data:image/")) return "image";

  // Raw base64 checks (JVBERi0 is %PDF-)
  const isPureBase64 = /^[A-Za-z0-9+/=\s]+$/.test(
    cleaned.replace(/\r?\n|\r/g, ""),
  );
  if (isPureBase64) {
    const startsWithPdf =
      cleaned.startsWith("JVBER") || cleaned.includes("JVBERi0");
    if (startsWithPdf) return "pdf";
    const startsWithPng = cleaned.startsWith("iVBOR");
    const startsWithJpeg = cleaned.startsWith("/9j/");
    const startsWithGif = cleaned.startsWith("R0lG");
    if (startsWithPng || startsWithJpeg || startsWithGif) return "image";
  }

  // ZPL signatures
  if (
    cleaned.includes("^XA") ||
    (cleaned.includes("^FO") && cleaned.includes("^FS"))
  ) {
    return "zpl";
  }

  // SBPL signatures (\x1bA or <ESC>A to \x1bZ or <ESC>Z)
  if (
    /(\\x1b|<ESC>|\x1b)A/i.test(cleaned) &&
    /(\\x1b|<ESC>|\x1b)Z/i.test(cleaned)
  ) {
    return "sbpl";
  }

  // EPL signatures (N followed by newline, P1 or similar)
  if (
    cleaned.startsWith("N\n") ||
    cleaned.startsWith("N\r\n") ||
    /\n[ABP]\d+,/i.test(cleaned) ||
    /\n[ABP]\d+\s*,/i.test(cleaned)
  ) {
    return "epl";
  }

  // ESC/POS signatures (\x1b\x40 or \x1b@ or alignment commands or literal <ESC>/ESC)
  if (
    /\\x1b|\\x1d|\x1b|\x1d|<ESC>|<GS>|ESC|GS/i.test(cleaned) &&
    /(\\x1b|\x1b|@|<ESC>|ESC|\\x1b\\x40)@|(\\x1b|\x1b|@|<ESC>|ESC|\\x1b\\x40)\x40|(\\x1b|\x1b|a|<ESC>|ESC|\\x1b\\x61)a|(\\x1b|\x1b|a|<ESC>|ESC|\\x1b\\x61)\x61|(\\x1d|\x1d|V|<GS>|GS|\\x1d\\x56)V|(\\x1d|\x1d|V|<GS>|GS|\\x1d\\x56)\x56|(\\x1b|\x1b|!|<ESC>|ESC)!/i.test(
      cleaned,
    )
  ) {
    return "escpos";
  }

  return "raw";
};

const decodeEscapeSequences = (text: string): string => {
  return (
    text
      .replace(/<ESC>/gi, "\x1b")
      .replace(/\[ESC\]/gi, "\x1b")
      .replace(/<GS>/gi, "\x1d")
      .replace(/\[GS\]/gi, "\x1d")
      // Match ESC followed by non-alphanumeric chars: ESC@, ESC!, ESC*
      .replace(/ESC(?=[@!*])/gi, "\x1b")
      // Match ESC followed by command and digit: ESCa0, ESCa1, ESCa2, ESCd2, ESCd1
      .replace(/ESC(?=[ade][0-9])/gi, "\x1b")
      // Match ESC followed by standalone E or m: ESCm, ESCE
      .replace(/ESC(?=[mE](\s|$|;))/gi, "\x1b")
      // Standard escape characters
      .replace(/\\x1b/g, "\x1b")
      .replace(/\\x1d/g, "\x1d")
      .replace(/\\x09/g, "\t")
      .replace(/\\u001b/g, "\x1b")
      .replace(/\\u001d/g, "\x1d")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
  );
};

const base64ToBlobUrl = (base64: string, mimeType: string): string | null => {
  try {
    const pureBase64 = base64.replace(/^data:[^;]+;base64,/, "").trim();
    const binStr = atob(pureBase64);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = binStr.charCodeAt(i);
    }
    const blob = new Blob([arr], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("Failed to convert base64 to Blob URL", e);
    return null;
  }
};

interface LabelElement {
  type: "text" | "barcode";
  x: number;
  y: number;
  content: string;
}

const parseSbpl = (text: string): LabelElement[] => {
  let normalized = text
    .replace(/<ESC>/gi, "\x1b")
    .replace(/\\x1b/gi, "\x1b")
    .replace(/\\u001b/gi, "\x1b");

  const parts = normalized.split("\x1b");
  const elements: LabelElement[] = [];

  let currentX = 0;
  let currentY = 0;

  for (const part of parts) {
    if (!part) continue;

    const vMatch = part.match(/^V(\d{4})/i);
    if (vMatch) {
      currentY = parseInt(vMatch[1], 10);
    }
    const hMatch = part.match(/^H(\d{4})/i);
    if (hMatch) {
      currentX = parseInt(hMatch[1], 10);
    }

    const xMatch =
      part.match(/X[0-9A-Z]{2,4},(.*)$/i) || part.match(/X[0-9A-Z],(.*)$/i);
    if (xMatch) {
      elements.push({
        type: "text",
        x: currentX,
        y: currentY,
        content: xMatch[1],
      });
    }

    const bgMatch = part.match(/BG\d{4}(.*)$/i) || part.match(/BG(.*)$/i);
    if (bgMatch) {
      elements.push({
        type: "barcode",
        x: currentX,
        y: currentY,
        content: bgMatch[1],
      });
    }
  }
  return elements;
};

const parseEpl = (text: string): LabelElement[] => {
  const lines = text.split(/\r?\n/);
  const elements: LabelElement[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("A")) {
      const parts = trimmed.substring(1).split(",");
      if (parts.length >= 8) {
        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        const textPart = parts.slice(7).join(",");
        const content = textPart.replace(/^"|"$/g, "");
        elements.push({ type: "text", x, y, content });
      }
    }

    if (trimmed.startsWith("B")) {
      const parts = trimmed.substring(1).split(",");
      if (parts.length >= 8) {
        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        const dataPart = parts.slice(7).join(",");
        const content = dataPart.replace(/^"|"$/g, "");
        elements.push({ type: "barcode", x, y, content });
      }
    }
  }
  return elements;
};

const parseZplFallback = (text: string): LabelElement[] => {
  const elements: LabelElement[] = [];
  const matches = text.match(/\^FO\d+,\d+.*?\^FD.*?\^FS/gi);
  if (matches) {
    for (const m of matches) {
      const foMatch = m.match(/\^FO(\d+),(\d+)/i);
      const fdMatch = m.match(/\^FD([^^]*)/i);
      if (foMatch && fdMatch) {
        const x = parseInt(foMatch[1], 10);
        const y = parseInt(foMatch[2], 10);
        const content = fdMatch[1];
        const isBarcode =
          m.includes("^B3") || m.includes("^BC") || m.includes("^BQ");
        elements.push({
          type: isBarcode ? "barcode" : "text",
          x,
          y,
          content,
        });
      }
    }
  }
  return elements;
};

const drawCanvasLabel = (
  canvas: HTMLCanvasElement,
  elements: LabelElement[],
  widthDots: number,
  heightDots: number,
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = widthDots || 400;
  canvas.height = heightDots || 600;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  for (const el of elements) {
    if (el.type === "text") {
      const fontSize = Math.max(12, Math.round(canvas.height / 35));
      ctx.font = `${fontSize}px monospace`;
      ctx.fillText(el.content, el.x, el.y);
    } else if (el.type === "barcode") {
      const barW = Math.max(120, Math.round(canvas.width * 0.4));
      const barH = Math.max(40, Math.round(canvas.height * 0.08));

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(el.x, el.y, barW, barH);

      ctx.fillStyle = "#000000";
      for (let i = el.x + 5; i < el.x + barW - 5; i += 6) {
        ctx.fillRect(i, el.y + 4, 3, barH - 8);
      }

      const codeFontSize = Math.max(10, Math.round(canvas.height / 45));
      ctx.font = `${codeFontSize}px monospace`;
      ctx.fillText(el.content, el.x + 4, el.y + barH + 4);
    }
  }
};

const renderEscposPreview = (text: string) => {
  const decoded = decodeEscapeSequences(text);
  const lines = decoded.split("\n");
  let currentAlign = "left";
  let isBold = false;

  return lines.map((line, idx) => {
    if (line.includes("\x1b\x61\x01") || line.includes("\x1b\x61\u0001")) {
      currentAlign = "center";
    } else if (
      line.includes("\x1b\x61\x02") ||
      line.includes("\x1b\x61\u0002")
    ) {
      currentAlign = "right";
    } else if (
      line.includes("\x1b\x61\x00") ||
      line.includes("\x1b\x61\u0000")
    ) {
      currentAlign = "left";
    }

    if (line.includes("\x1b\x45\x01") || line.includes("\x1b\x45\u0001")) {
      isBold = true;
    }
    if (line.includes("\x1b\x45\x00") || line.includes("\x1b\x45\u0000")) {
      isBold = false;
    }

    const hasCut = line.includes("\x1d\x56") || line.includes("\x1dV");
    const cleanText = line.replace(/[\x00-\x1f\x7f-\x9f]/g, "");

    return (
      <div
        key={idx}
        style={{
          textAlign: currentAlign as any,
          fontWeight: isBold ? "bold" : "normal",
          minHeight: "1.2em",
          fontFamily: "monospace",
          fontSize: "11px",
          whiteSpace: "pre-wrap",
          borderBottom: hasCut ? "1px dashed #cbd5e1" : "none",
          paddingBottom: hasCut ? "8px" : "0px",
          marginBottom: hasCut ? "8px" : "0px",
        }}
      >
        {cleanText}
      </div>
    );
  });
};

export default function PrinterConfig({
  mapping,
  printers,
  onChange,
  onUpdate,
  onTestPrint,
  onRefreshPrinters,
}: Props) {
  const [localState, setLocalState] = useState<PrinterMapping>(mapping);
  const currentPresets = TEST_PRESETS[localState.type] || TEST_PRESETS["raw"];
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testMode, setTestMode] = useState<"preset" | "manual">("preset");
  const [manualData, setManualData] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(0);

  const [labelaryUrl, setLabelaryUrl] = useState<string | null>(null);
  const [loadingLabelary, setLoadingLabelary] = useState(false);
  const [labelaryError, setLabelaryError] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const previewContent =
    testMode === "preset"
      ? currentPresets[selectedPreset]?.data || ""
      : manualData;

  // Let's decode base64 contents to preview the underlying data format
  const cleanedInput = previewContent.trim();
  const isPdfDataUri = cleanedInput.startsWith("data:application/pdf;base64,");
  const isImageDataUri = cleanedInput.startsWith("data:image/");

  let isBase64 = false;
  let decodedText = "";
  let targetFormat:
    | "pdf"
    | "image"
    | "zpl"
    | "epl"
    | "sbpl"
    | "escpos"
    | "raw" = "raw";

  if (isPdfDataUri) {
    isBase64 = true;
    targetFormat = "pdf";
  } else if (isImageDataUri) {
    isBase64 = true;
    targetFormat = "image";
  } else {
    // Check if it is a pure base64 string (spaces/newlines removed)
    const pureBase64 = cleanedInput.replace(/\s/g, "");
    const isValidBase64 =
      pureBase64.length > 0 &&
      pureBase64.length % 4 === 0 &&
      /^[A-Za-z0-9+/=]+$/.test(pureBase64);

    if (isValidBase64) {
      try {
        const decoded = atob(pureBase64);
        isBase64 = true;
        decodedText = decoded;

        // Analyze decoded binary or text header
        if (decoded.startsWith("%PDF")) {
          targetFormat = "pdf";
        } else if (
          decoded.startsWith("\x89PNG") ||
          decoded.includes("JFIF") ||
          decoded.startsWith("GIF8")
        ) {
          targetFormat = "image";
        } else if (
          decoded.includes("^XA") ||
          (decoded.includes("^FO") && decoded.includes("^FS"))
        ) {
          targetFormat = "zpl";
        } else if (
          /(\x1b|<ESC>)A/i.test(decoded) &&
          /(\x1b|<ESC>)Z/i.test(decoded)
        ) {
          targetFormat = "sbpl";
        } else if (
          decoded.startsWith("N\n") ||
          decoded.startsWith("N\r\n") ||
          /\n[ABP]\d+,/i.test(decoded)
        ) {
          targetFormat = "epl";
        } else if (
          /[\x1b\x1d]/i.test(decoded) &&
          /\x1b@|\x1b\x40|\x1ba|\x1b\x61|\x1dV|\x1d\x56/i.test(decoded)
        ) {
          targetFormat = "escpos";
        } else {
          targetFormat = "raw";
        }
      } catch (e) {
        isBase64 = false;
      }
    }
  }

  if (!isBase64) {
    targetFormat = detectFormat(previewContent);
  }

  const activeFormat =
    targetFormat === "raw"
      ? localState.type === "base64"
        ? "raw"
        : localState.type
      : targetFormat;
  const detectedFormat = targetFormat;
  const previewText = isBase64 && decodedText ? decodedText : previewContent;

  // ZPL Labelary loading hook with debounce
  useEffect(() => {
    if (activeFormat !== "zpl") {
      setLabelaryUrl(null);
      setLabelaryError(false);
      return;
    }

    setLoadingLabelary(true);
    setLabelaryError(false);

    const timer = setTimeout(async () => {
      try {
        const dpmm =
          localState.config.density === 300
            ? 12
            : localState.config.density === 600
              ? 24
              : 8;
        const widthVal = localState.config.size?.width ?? 100;
        const heightVal = localState.config.size?.height || 150;
        const unit = localState.config.units || "mm";

        let w = widthVal;
        let h = heightVal;
        if (unit === "mm") {
          w = widthVal / 25.4;
          h = heightVal / 25.4;
        } else if (unit === "cm") {
          w = widthVal / 2.54;
          h = heightVal / 2.54;
        }

        const wIn = Math.round(w * 100) / 100;
        const hIn = Math.round(h * 100) / 100;

        const response = await fetch(
          `https://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${wIn}x${hIn}/0/`,
          {
            method: "POST",
            headers: {
              Accept: "image/png",
            },
            body: previewText,
          },
        );

        if (!response.ok) {
          throw new Error("Labelary API error");
        }

        const blob = await response.blob();
        const objUrl = URL.createObjectURL(blob);
        setLabelaryUrl(objUrl);
        setLoadingLabelary(false);
      } catch (err) {
        console.error(
          "Labelary fetch failed, using fallback canvas parser",
          err,
        );
        setLabelaryError(true);
        setLabelaryUrl(null);
        setLoadingLabelary(false);
      }
    }, 600);

    return () => {
      clearTimeout(timer);
    };
  }, [
    previewText,
    activeFormat,
    localState.config.density,
    localState.config.size?.width,
    localState.config.size?.height,
    localState.config.units,
  ]);

  // Clean up Labelary URL
  useEffect(() => {
    return () => {
      if (labelaryUrl) {
        URL.revokeObjectURL(labelaryUrl);
      }
    };
  }, [labelaryUrl]);

  // Manage PDF blob URL
  useEffect(() => {
    if (activeFormat !== "pdf") {
      setPdfUrl(null);
      return;
    }

    let objUrl: string | null = null;
    try {
      const decoded = decodeEscapeSequences(previewContent).trim();
      objUrl = base64ToBlobUrl(decoded, "application/pdf");
      setPdfUrl(objUrl);
    } catch (e) {
      console.error(e);
      setPdfUrl(null);
    }

    return () => {
      if (objUrl) {
        URL.revokeObjectURL(objUrl);
      }
    };
  }, [previewContent, activeFormat]);

  // Manage Image URL
  useEffect(() => {
    if (activeFormat !== "image") {
      setImageUrl(null);
      return;
    }

    let objUrl: string | null = null;
    try {
      const decoded = decodeEscapeSequences(previewContent).trim();
      if (decoded.startsWith("data:image/")) {
        setImageUrl(decoded);
      } else {
        objUrl = base64ToBlobUrl(decoded, "image/png");
        setImageUrl(objUrl);
      }
    } catch (e) {
      console.error(e);
      setImageUrl(null);
    }

    return () => {
      if (objUrl) {
        URL.revokeObjectURL(objUrl);
      }
    };
  }, [previewContent, activeFormat]);

  // Canvas drawing effect for SBPL / EPL / offline ZPL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let elements: LabelElement[] = [];
    const decoded = decodeEscapeSequences(previewText);

    if (activeFormat === "sbpl") {
      elements = parseSbpl(decoded);
    } else if (activeFormat === "epl") {
      elements = parseEpl(decoded);
    } else if (activeFormat === "zpl" && labelaryError) {
      elements = parseZplFallback(decoded);
    }

    const widthVal = localState.config.size?.width ?? 100;
    const heightVal = localState.config.size?.height || 150;
    const unit = localState.config.units || "mm";
    const dotsPerMm =
      localState.config.density === 300
        ? 12
        : localState.config.density === 600
          ? 24
          : 8;

    let widthMm = widthVal;
    let heightMm = heightVal;
    if (unit === "in") {
      widthMm = widthVal * 25.4;
      heightMm = heightVal * 25.4;
    } else if (unit === "cm") {
      widthMm = widthVal * 10;
      heightMm = heightVal * 10;
    }

    const widthDots = Math.round(widthMm * dotsPerMm);
    const heightDots = Math.round(heightMm * dotsPerMm);

    drawCanvasLabel(canvas, elements, widthDots, heightDots);
  }, [
    previewText,
    activeFormat,
    labelaryError,
    localState.config.size?.width,
    localState.config.size?.height,
    localState.config.units,
    localState.config.density,
  ]);

  useEffect(() => {
    setLocalState(mapping);
  }, [mapping.id]);

  // Reset preset selection when format type changes
  useEffect(() => {
    setSelectedPreset(0);
  }, [localState.type]);

  const updateField = (field: keyof PrinterMapping, value: any) => {
    const updated = { ...localState, [field]: value };
    setLocalState(updated);
    onChange(updated);
  };

  const updateConfig = (field: string, value: any) => {
    const updated = {
      ...localState,
      config: { ...localState.config, [field]: value },
    };
    setLocalState(updated);
    onChange(updated);
  };

  const updateSize = (field: "width" | "height", value: number) => {
    const updated = {
      ...localState,
      config: {
        ...localState.config,
        size: {
          ...(localState.config.size || { width: 100, height: 150 }),
          [field]: value,
        },
      },
    };
    setLocalState(updated);
    onChange(updated);
  };

  const handleSendTest = () => {
    if (testMode === "manual") {
      onTestPrint(localState, manualData || undefined);
    } else {
      const preset = currentPresets[selectedPreset];
      onTestPrint(localState, preset?.data);
    }
  };

  const isEnabled = localState.enabled !== false;
  const widthVal = localState.config.size?.width ?? 100;
  const heightVal = localState.config.size?.height ?? 150;
  const isAutoHeight = heightVal === 0;
  const ratioWidth =
    widthVal > 0 && !isAutoHeight && heightVal > 0
      ? (widthVal / (widthVal + heightVal)) * 100
      : 50;

  return (
    <div className="config-grid">
      {/* Card 1: DEVICE */}
      <div className="config-section-card">
        <div className="section-header">
          <span className="section-header-icon">💻</span>
          <span>DEVICE</span>
        </div>

        <div className="form-group">
          <label>Status Toggle</label>
          <div className="toggle-segmented">
            <button
              type="button"
              className={`segment-btn ${isEnabled ? "active-on" : ""}`}
              onClick={() => updateField("enabled", true)}
            >
              Aktif
            </button>
            <button
              type="button"
              className={`segment-btn ${!isEnabled ? "active-off" : ""}`}
              onClick={() => updateField("enabled", false)}
            >
              Nonaktif
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Logical Name</label>
          <input
            type="text"
            value={localState.logicalName}
            onChange={(e) => updateField("logicalName", e.target.value)}
            placeholder="e.g. barcode-printer-01"
          />
        </div>

        <div className="form-group">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <label>Physical Printer</label>
            <button
              type="button"
              style={{
                border: "none",
                background: "none",
                color: "var(--primary)",
                cursor: "pointer",
                fontSize: "11px",
              }}
              onClick={onRefreshPrinters}
            >
              ↻
            </button>
          </div>
          <select
            value={localState.physicalName}
            onChange={(e) => updateField("physicalName", e.target.value)}
          >
            <option value="">-- Select Printer --</option>
            {printers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} {p.isDefault ? "(Default)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Print Format</label>
          <select
            value={localState.type}
            onChange={(e) => updateField("type", e.target.value)}
          >
            <option value="pdf">PDF Document (*.pdf)</option>
            <option value="base64">Base64 Encoded Payload (*.base64)</option>
            <option value="zpl">Zebra ZPL (Zebra Barcode Printer)</option>
            <option value="epl">Eltron EPL (EPL Barcode Printer)</option>
            <option value="sbpl">SATO SBPL (SATO Barcode Printer)</option>
            <option value="escpos">ESC/POS (Thermal Receipt Printer)</option>
            <option value="raw">Raw Command / Direct Binary</option>
            <option value="image">Raster Image (PNG / JPG)</option>
          </select>
        </div>
      </div>

      {/* Card 2: PAGE */}
      <div className="config-section-card">
        <div className="section-header">
          <span className="section-header-icon">📐</span>
          <span>PAGE</span>
        </div>

        <div className="form-group">
          <label>Orientation</label>
          <div className="orientation-control">
            <button
              type="button"
              className={`orientation-btn ${
                (localState.config.orientation || "portrait") === "portrait"
                  ? "active"
                  : ""
              }`}
              onClick={() => updateConfig("orientation", "portrait")}
            >
              <span>📄</span> Portrait
            </button>
            <button
              type="button"
              className={`orientation-btn ${
                localState.config.orientation === "landscape" ? "active" : ""
              }`}
              onClick={() => updateConfig("orientation", "landscape")}
            >
              <span>🔺</span> Landscape
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Units</label>
          <select
            value={localState.config.units || "mm"}
            onChange={(e) => updateConfig("units", e.target.value)}
          >
            <option value="mm">Millimeters (mm)</option>
            <option value="in">Inches (in)</option>
            <option value="cm">Centimeters (cm)</option>
          </select>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div className="form-group">
            <label>Width ({localState.config.units || "mm"})</label>
            <input
              type="number"
              value={widthVal}
              onChange={(e) =>
                updateSize("width", parseFloat(e.target.value) || 0)
              }
            />
          </div>
          <div className="form-group">
            <label>Height ({localState.config.units || "mm"})</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type={isAutoHeight ? "text" : "number"}
                disabled={isAutoHeight}
                value={isAutoHeight ? "Auto" : heightVal}
                onChange={(e) =>
                  updateSize("height", parseFloat(e.target.value) || 0)
                }
                style={{ flex: 1 }}
              />
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  margin: 0,
                  color: "var(--text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={isAutoHeight}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateSize("height", 0);
                    } else {
                      updateSize("height", 150);
                    }
                  }}
                />
                Auto Height
              </label>
            </div>
          </div>
        </div>

        <div className="preview-ratio-box">
          <div className="preview-ratio-header">
            <span>Preview Ratio</span>
            <span>
              {widthVal}:{heightVal}
            </span>
          </div>
          <div className="ratio-bar-bg">
            <div
              className="ratio-bar-fill"
              style={{ width: `${Math.min(100, Math.max(10, ratioWidth))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 3: ENGINE */}
      <div className="config-section-card">
        <div className="section-header">
          <span className="section-header-icon">⚙️</span>
          <span>ENGINE</span>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div className="form-group">
            <label>Density (DPI)</label>
            <input
              type="number"
              value={localState.config.density ?? 300}
              onChange={(e) =>
                updateConfig("density", parseInt(e.target.value) || 0)
              }
            />
          </div>
          <div className="form-group">
            <label>Copies</label>
            <input
              type="number"
              min="1"
              value={localState.config.copies ?? 1}
              onChange={(e) =>
                updateConfig("copies", parseInt(e.target.value) || 1)
              }
            />
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div className="form-group">
            <label>Margins ({localState.config.units || "mm"})</label>
            <input
              type="number"
              value={
                typeof localState.config.margins === "number"
                  ? localState.config.margins
                  : 0
              }
              onChange={(e) =>
                updateConfig("margins", parseFloat(e.target.value) || 0)
              }
            />
          </div>
          <div className="form-group">
            <label>Color Mode</label>
            <select
              value={localState.config.colorType || "blackwhite"}
              onChange={(e) => updateConfig("colorType", e.target.value)}
            >
              <option value="blackwhite">Monochrome</option>
              <option value="grayscale">Grayscale</option>
              <option value="color">Full Color</option>
            </select>
          </div>
        </div>

        <div className="switch-row">
          <div className="switch-label-group">
            <span className="switch-title">Rasterization Engine</span>
            <span className="switch-sub">Use hardware acceleration</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={localState.config.rasterize ?? true}
              onChange={(e) => updateConfig("rasterize", e.target.checked)}
            />
            <span className="slider-round" />
          </label>
        </div>

        <p className="engine-note">
          *Note: Changes to engine parameters may require a service restart for
          persistent hooks.
        </p>
      </div>

      {/* Card 4: TEST PANEL — collapsible */}
      <div className="config-section-card" style={{ gridColumn: "1 / -1" }}>
        <div
          className="section-header"
          style={{ cursor: "pointer", userSelect: "none" }}
          onClick={() => setShowTestPanel(!showTestPanel)}
        >
          <span className="section-header-icon">🧪</span>
          <span>TEST PRINT PANEL</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "var(--text-muted)",
              transition: "transform 0.2s",
              transform: showTestPanel ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ▼
          </span>
        </div>

        {showTestPanel && (
          <div style={{ marginTop: 12 }}>
            {/* Mode Toggle: Preset vs Manual */}
            <div className="toggle-segmented" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className={`segment-btn ${testMode === "preset" ? "active-on" : ""}`}
                onClick={() => setTestMode("preset")}
              >
                📋 Contoh Preset
              </button>
              <button
                type="button"
                className={`segment-btn ${testMode === "manual" ? "active-on" : ""}`}
                onClick={() => setTestMode("manual")}
              >
                ✏️ Input Manual
              </button>
            </div>

            {testMode === "preset" ? (
              <div>
                <div className="form-group">
                  <label>
                    Pilih Sample Data ({localState.type.toUpperCase()})
                  </label>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {currentPresets.map((preset, idx) => (
                      <label
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          padding: "8px 10px",
                          borderRadius: 6,
                          border:
                            selectedPreset === idx
                              ? "1.5px solid var(--primary)"
                              : "1px solid var(--border)",
                          background:
                            selectedPreset === idx
                              ? "rgba(147, 51, 234, 0.06)"
                              : "var(--bg-secondary)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <input
                          type="radio"
                          name="test-preset"
                          checked={selectedPreset === idx}
                          onChange={() => setSelectedPreset(idx)}
                          style={{
                            width: "auto",
                            height: "auto",
                            marginTop: 3,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 12,
                              color: "var(--text-primary)",
                            }}
                          >
                            {preset.label}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 2,
                            }}
                          >
                            {preset.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label>
                    Paste Data Manual (Base64 / SBPL / ZPL / ESC/POS / Raw Text)
                  </label>
                  <textarea
                    value={manualData}
                    onChange={(e) => setManualData(e.target.value)}
                    placeholder={
                      localState.type === "sbpl"
                        ? "Contoh: <ESC>A<ESC>V0050<ESC>H0050..."
                        : localState.type === "zpl"
                          ? "Contoh: ^XA^FO50,50^ADN,36,20^FDTEST^FS^XZ"
                          : localState.type === "escpos"
                            ? "Contoh: \\x1b\\x40\\x1b\\x61\\x01Hello..."
                            : localState.type === "pdf" ||
                                localState.type === "base64"
                              ? "Paste Base64 string dari backend disini..."
                              : "Ketik atau paste data cetak disini..."
                    }
                    style={{
                      width: "100%",
                      minHeight: 120,
                      resize: "vertical",
                      fontSize: 11,
                      fontFamily: "monospace",
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "10px 12px",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {manualData.length} characters
                    </span>
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: "none",
                        color: "var(--primary)",
                        cursor: "pointer",
                        fontSize: 11,
                        textDecoration: "underline",
                      }}
                      onClick={() => setManualData("")}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Visual Preview Panel */}
            {previewContent.trim() && (
              <div className="preview-panel-container">
                <div className="preview-header-row">
                  <div className="preview-title">
                    <span>👁️</span> Preview Cetakan
                  </div>
                  <div
                    className={`preview-detect-badge ${detectedFormat === "raw" ? "raw" : ""}`}
                  >
                    {detectedFormat === "raw"
                      ? `format: raw text (${activeFormat} preview)`
                      : `format: ${detectedFormat}`}
                  </div>
                </div>

                <div className="preview-canvas-wrapper">
                  {loadingLabelary && (
                    <div className="preview-loading-overlay">
                      <div className="preview-spinner" />
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-secondary)",
                          marginTop: 4,
                        }}
                      >
                        Generating Labelary Preview...
                      </span>
                    </div>
                  )}

                  {/* Render based on detected type */}
                  {activeFormat === "pdf" && pdfUrl ? (
                    <iframe
                      className="preview-iframe"
                      src={pdfUrl}
                      title="PDF Preview"
                    />
                  ) : activeFormat === "image" && imageUrl ? (
                    <img src={imageUrl} alt="Image Preview" />
                  ) : activeFormat === "zpl" &&
                    labelaryUrl &&
                    !labelaryError ? (
                    <img src={labelaryUrl} alt="ZPL Labelary Preview" />
                  ) : activeFormat === "sbpl" ||
                    activeFormat === "epl" ||
                    (activeFormat === "zpl" && labelaryError) ? (
                    <>
                      <canvas ref={canvasRef} />
                      {activeFormat === "zpl" && labelaryError && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--warning)",
                            marginTop: 6,
                            textAlign: "center",
                          }}
                        >
                          ⚠️ Offline fallback rendering (Labelary unreachable)
                        </div>
                      )}
                    </>
                  ) : activeFormat === "escpos" ? (
                    <div className="preview-receipt-paper">
                      {renderEscposPreview(previewText)}
                    </div>
                  ) : (
                    // Raw Text
                    <div
                      style={{
                        width: "100%",
                        fontFamily: "monospace",
                        fontSize: 11,
                        whiteSpace: "pre-wrap",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        padding: 12,
                        borderRadius: 4,
                        color: "#1e293b",
                        maxHeight: 250,
                        overflowY: "auto",
                      }}
                    >
                      {decodeEscapeSequences(previewText).replace(
                        /[\x00-\x1f\x7f-\x9f]/g,
                        "",
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Send Test Button */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 10,
              }}
            >
              <button
                type="button"
                className="btn-test-print"
                onClick={handleSendTest}
                disabled={testMode === "manual" && !manualData.trim()}
              >
                <span>🚀</span> Kirim Test Print
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          paddingTop: 10,
        }}
      >
        <button
          type="button"
          className="btn-test-print"
          onClick={() => onTestPrint(localState)}
        >
          <span>🖨️</span> Test Print
        </button>
        <button
          type="button"
          className="btn-save-config"
          onClick={() => onUpdate(localState.id, localState)}
        >
          <span>💾</span> Save Configuration
        </button>
      </div>
    </div>
  );
}
