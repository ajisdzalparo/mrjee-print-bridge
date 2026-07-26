import {
  Activity,
  CheckCircle2,
  Clock3,
  FileText,
  Printer,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import type { PrinterMapping } from "../App";
import type { PrintJob } from "./QueuesView";

interface BridgeStatus {
  running: boolean;
  version: string;
  uptime: number;
  totalJobs: number;
  failedJobs: number;
  port?: number;
  activePrintersCount?: number;
}

interface Props {
  status: BridgeStatus | null;
  mappings: PrinterMapping[];
  jobs: PrintJob[];
  onSelectPrinter: (id: string) => void;
  onTestPrint: (mapping: PrinterMapping) => void;
}

const formatUptime = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
};

export default function Dashboard({
  status,
  mappings,
  jobs,
  onSelectPrinter,
  onTestPrint,
}: Props) {
  const activeMapping = mappings.find((item) => item.enabled !== false) || mappings[0];
  const successfulJobs = Math.max(0, status?.totalJobs ?? 0);
  const failedJobs = Math.max(0, status?.failedJobs ?? 0);
  const successRate =
    successfulJobs + failedJobs > 0
      ? ((successfulJobs / (successfulJobs + failedJobs)) * 100).toFixed(1)
      : "100.0";

  return (
    <section className="bridge-dashboard">
      <header className="bridge-dashboard-head">
        <div>
          <div className="bridge-online">
            <span />
            {status?.running === false ? "BRIDGE OFFLINE" : "BRIDGE ONLINE"}
          </div>
          <small>ACTIVE PRINTER</small>
          <h1>{activeMapping?.physicalName || "No printer selected"}</h1>
          <p>
            {activeMapping
              ? `${activeMapping.logicalName} · ${activeMapping.type.toUpperCase()} · ${activeMapping.enabled === false ? "Disabled" : "Ready"}`
              : "Create a printer mapping to begin"}
          </p>
        </div>
        <div className="bridge-head-side">
          <code>LOCALHOST:{status?.port || 9000}</code>
          <div><Printer size={32} /></div>
        </div>
      </header>

      <div className="bridge-metrics">
        <article>
          <span><Clock3 size={14} /> SYSTEM UPTIME</span>
          <b>{formatUptime(status?.uptime)}</b>
          <small>Service runtime</small>
        </article>
        <article>
          <span><Activity size={14} /> SUCCESS RATE</span>
          <b>{successRate}%</b>
          <small className="positive">Stable</small>
        </article>
        <article>
          <span><Printer size={14} /> PRINTERS</span>
          <b>{String(mappings.length).padStart(2, "0")}</b>
          <small className="positive">{mappings.filter((m) => m.enabled !== false).length} active</small>
        </article>
        <article>
          <span><TriangleAlert size={14} /> FAILED JOBS</span>
          <b>{String(failedJobs).padStart(2, "0")}</b>
          <small className={failedJobs ? "negative" : "positive"}>{failedJobs ? "Needs attention" : "No errors"}</small>
        </article>
      </div>

      <div className="bridge-dashboard-grid">
        <article className="bridge-panel queue-panel">
          <header>
            <div><ListIcon /> <b>Live print queue</b></div>
            <span><RefreshCw size={13} /> Realtime</span>
          </header>
          <div className="bridge-queue-list">
            {jobs.length ? jobs.slice(0, 7).map((job) => (
              <div key={job.id}>
                <FileText size={15} />
                <b>{job.id}</b>
                <span>{job.printer}</span>
                <small>{job.time}</small>
                <em className={job.status.toLowerCase()}>{job.status}</em>
              </div>
            )) : (
              <div className="bridge-empty">
                <CheckCircle2 size={19} />
                <span><b>Queue is clear</b><small>New print jobs will appear here in realtime.</small></span>
              </div>
            )}
          </div>
        </article>

        <article className="bridge-panel printer-panel">
          <header>
            <div><Printer size={15} /> <b>Printer instances</b></div>
            <span>{mappings.length} configured</span>
          </header>
          <div className="bridge-printer-list">
            {mappings.length ? mappings.slice(0, 5).map((mapping) => (
              <div key={mapping.id}>
                <i><Printer size={16} /></i>
                <span>
                  <b>{mapping.logicalName}</b>
                  <small>{mapping.physicalName || "Not assigned"} · {mapping.type.toUpperCase()}</small>
                </span>
                <em className={mapping.enabled === false ? "disabled" : ""}>
                  {mapping.enabled === false ? "OFFLINE" : "ONLINE"}
                </em>
                <button onClick={() => onTestPrint(mapping)} title="Test print"><Printer size={14} /></button>
                <button onClick={() => onSelectPrinter(mapping.id)} title="Configure"><Settings2 size={14} /></button>
              </div>
            )) : (
              <div className="bridge-empty">
                <Printer size={19} />
                <span><b>No printer configured</b><small>Create your first instance from the sidebar.</small></span>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function ListIcon() {
  return <Activity size={15} />;
}
