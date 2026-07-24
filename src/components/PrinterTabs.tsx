import type { PrinterMapping } from "../App";

interface Props {
  mappings: PrinterMapping[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onAddPrinter: () => void;
  onDeletePrinter: (id: string) => void;
}

export default function PrinterTabs({
  mappings,
  activeTabId,
  onSelectTab,
  onAddPrinter,
  onDeletePrinter,
}: Props) {
  const getIcon = (type: string) => {
    switch (type) {
      case "raw":
        return "📄";
      case "image":
        return "🖼️";
      default:
        return "║▌║";
    }
  };

  return (
    <div className="printer-tabs-row">
      {mappings.map((mapping) => {
        const isActive = mapping.id === activeTabId;
        const isOnline = mapping.enabled !== false;

        return (
          <div
            key={mapping.id}
            className={`printer-tab-card ${isActive ? "active" : ""}`}
            onClick={() => onSelectTab(mapping.id)}
          >
            <div className="tab-icon-box">{getIcon(mapping.type)}</div>
            <div className="tab-info">
              <div className="tab-title-row">
                <span className="tab-name">{mapping.logicalName || "printer"}</span>
                <span className="tab-type-tag">{mapping.type || "pdf"}</span>
              </div>
              <div className="tab-status-indicator">
                <span
                  className={`tab-status-dot ${isOnline ? "online" : "offline"}`}
                />
                <span>{isOnline ? "Online" : "Offline"}</span>
              </div>
            </div>
            <button
              className="tab-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Hapus printer "${mapping.logicalName}"?`)) {
                  onDeletePrinter(mapping.id);
                }
              }}
              title="Hapus"
            >
              ✕
            </button>
          </div>
        );
      })}

      <button className="btn-add-printer" onClick={onAddPrinter}>
        <span>+</span> Add Printer
      </button>
    </div>
  );
}
