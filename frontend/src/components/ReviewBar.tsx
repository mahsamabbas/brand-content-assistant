import { useEffect, useState } from "react";
import { copyText, emailCopyText } from "../lib/format";
import { statusLabel } from "../lib/statusLabel";
import type { DraftFields, Run } from "../types";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface Props {
  run: Run | null;
  drafts: DraftFields | null;
  canApprove: boolean;
  approving: boolean;
  generating: boolean;
  saveState: SaveState;
  flashKey: number;
  flagCount: number;
  error: string | null;
  onApprove: () => void;
}

const SAVE_COPY: Record<SaveState, string> = {
  idle: "",
  dirty: "Unsaved edits",
  saving: "Saving…",
  saved: "Edits saved",
  error: "Save failed — edits kept here",
};

type Copied = "linkedin" | "email" | "failed" | null;

export default function ReviewBar({
  run,
  drafts,
  canApprove,
  approving,
  generating,
  saveState,
  flashKey,
  flagCount,
  error,
  onApprove,
}: Props) {
  const [copied, setCopied] = useState<Copied>(null);
  const ready = run?.status === "ready_not_published";

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function copy(which: "linkedin" | "email") {
    if (!drafts) return;
    const text = which === "linkedin" ? drafts.linkedin_post : emailCopyText(drafts.email_subject, drafts.email_body);
    try {
      await copyText(text);
      setCopied(which);
    } catch {
      setCopied("failed");
    }
  }

  let hint = "";
  if (!run) hint = "Generate a run to review it.";
  else if (!ready && !canApprove) hint = "Approve needs a LinkedIn post and an email body.";
  else if (!ready && flagCount > 0) hint = `${flagCount} lint flag${flagCount === 1 ? "" : "s"} open — you can still approve.`;
  else if (ready) hint = "Copy and paste into your own tools. Edits still save; status stays ready.";

  return (
    <div className="review-bar" role="region" aria-label="Review">
      <div className="review-status">
        {run && (
          <span
            key={`${run.id}:${flashKey}`}
            className={`status-badge${ready && flashKey > 0 ? " approve-flash" : ""}`}
            data-status={run.status}
          >
            {statusLabel(run.status)}
          </span>
        )}
        <span className="review-meta" aria-live="polite">
          {copied === "linkedin" && "LinkedIn post copied"}
          {copied === "email" && "Email copied"}
          {copied === "failed" && "Copy failed — select and copy manually"}
          {!copied && SAVE_COPY[saveState]}
        </span>
      </div>

      <div className="review-actions">
        {ready ? (
          <>
            <button type="button" className="btn-ghost" onClick={() => copy("linkedin")} disabled={generating}>
              Copy LinkedIn
            </button>
            <button type="button" className="btn-ghost" onClick={() => copy("email")} disabled={generating}>
              Copy email
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-approve"
            onClick={onApprove}
            disabled={!run || !canApprove || approving || generating}
          >
            {approving ? "Approving…" : "Approve · mark ready"}
          </button>
        )}
      </div>

      <div className="review-foot">
        {error ? (
          <span className="review-error" role="alert">
            {error}
          </span>
        ) : (
          <span>{hint}</span>
        )}
        <span className="review-promise">Nothing is published from this app.</span>
      </div>
    </div>
  );
}
