import { formatRunTime } from "../lib/format";
import { statusLabel } from "../lib/statusLabel";
import type { RunSummary } from "../types";

interface Props {
  runs: RunSummary[];
  state: "loading" | "ready" | "error";
  activeId: string | null;
  openingId: string | null;
  open: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  onRetry: () => void;
}

export default function RunHistory({ runs, state, activeId, openingId, open, onOpen, onClose, onRetry }: Props) {
  return (
    <>
      <div className="sheet-backdrop" data-open={open} onClick={onClose} aria-hidden="true" />
      <aside className="rail studio-rail history-rail" data-open={open} aria-label="Run history" id="run-history">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="flex items-baseline justify-between gap-3">
          <p className="label">Run history</p>
          <span className="kit-fine">{runs.length > 0 && `${runs.length} run${runs.length === 1 ? "" : "s"}`}</span>
          <button type="button" className="link-quiet sheet-close" onClick={onClose}>
            Close
          </button>
        </div>

        {state === "loading" && runs.length === 0 && (
          <div className="mt-4 grid gap-3" aria-busy="true">
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
          </div>
        )}

        {state === "error" && (
          <div className="mt-4">
            <p className="notice">Couldn’t load past runs.</p>
            <button type="button" className="btn-ghost mt-2" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}

        {state === "ready" && runs.length === 0 && (
          <p className="kit-fine mt-4">No runs yet. Every generate is saved here so you can reopen and polish it.</p>
        )}

        {runs.length > 0 && (
          <ol className="timeline mt-4">
            {runs.map((r) => {
              const active = r.id === activeId;
              return (
                <li key={r.id} className="timeline-item" data-active={active} data-status={r.status}>
                  <button
                    type="button"
                    className="timeline-btn"
                    onClick={() => onOpen(r.id)}
                    aria-current={active ? "true" : undefined}
                    disabled={openingId === r.id}
                  >
                    <span className="timeline-time">
                      {openingId === r.id ? "Opening…" : formatRunTime(r.created_at)}
                    </span>
                    <span className="timeline-snippet">{r.brief_snippet || "Untitled brief"}</span>
                    <span className="status-badge timeline-badge" data-status={r.status}>
                      {statusLabel(r.status)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </>
  );
}
