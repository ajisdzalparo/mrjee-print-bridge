const MEASUREMENT_ID = "G-R1L9DX5319";
const CLIENT_ID_KEY = "mrjee-telemetry-client-id";
let initialized = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

function getAnonymousClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}

export function enableTelemetry(appVersion = "unknown"): void {
  window[`ga-disable-${MEASUREMENT_ID}`] = false;
  if (initialized) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
    client_id: getAnonymousClientId(),
    app_name: "Mrjee Print Bridge",
    app_version: appVersion,
    page_location: "https://mrjeeprint.com/desktop-app",
    page_title: "Mrjee Print Bridge Desktop",
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
  initialized = true;
}

export function disableTelemetry(): void {
  window[`ga-disable-${MEASUREMENT_ID}`] = true;
}

export function trackDesktopEvent(
  name: string,
  parameters: Record<string, string | number | boolean> = {},
): void {
  if (!initialized || window[`ga-disable-${MEASUREMENT_ID}`]) return;
  window.gtag?.("event", name, {
    ...parameters,
    event_source: "desktop",
    engagement_time_msec: 1,
  });
}
