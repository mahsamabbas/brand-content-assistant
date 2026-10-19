import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { splitFlags } from "../lib/flags";
import type { BrandKit, DraftFields, Run } from "../types";
import FlagStrip from "./FlagStrip";

interface Props {
  run: Run | null;
  drafts: DraftFields | null;
  kit: BrandKit | null;
  generating: boolean;
  onChange: (field: keyof DraftFields, value: string) => void;
  onBlur: () => void;
}

function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={3} {...props} />;
}

function Counter({ count, max }: { count: number; max: number | undefined }) {
  const over = max !== undefined && count > max;
  return (
    <span className="counter" data-over={over}>
      {count.toLocaleString()}
      {max !== undefined && ` / ${max.toLocaleString()}`}
    </span>
  );
}

export default function DraftStage({ run, drafts, kit, generating, onChange, onBlur }: Props) {
  if (!run && !generating) {
    return (
      <div className="stage-empty">
        <p className="stage-empty-line">Your LinkedIn post card and email letter land here.</p>
        <p className="kit-fine mt-2">Write a brief on the left — the Northline kit shapes every draft.</p>
        <div className="stage-ghosts" aria-hidden="true">
          <div className="ghost ghost-card" />
          <div className="ghost ghost-letter" />
        </div>
      </div>
    );
  }

  const d: DraftFields = drafts ?? { linkedin_post: "", email_subject: "", email_body: "" };
  const pulse = generating ? " draft-pulse" : "";
  const flags = run && !generating ? splitFlags(run.flags, d) : { linkedin: [], email: [] };
  const runKey = run?.id ?? "pending";
  const readOnly = generating || !run;
  const placeholder = generating ? "Drafting in the Northline voice…" : undefined;

  return (
    <div className="stage-desk" aria-busy={generating}>
      <section aria-label="LinkedIn post card" className="stage-piece">
        <div className="piece-head">
          <p className="label">LinkedIn · post card</p>
          <Counter count={d.linkedin_post.trim().length} max={kit?.linkedin_max_chars} />
        </div>
        <article className={`postcard post-card${pulse}`}>
          <header className="postcard-head">
            <span className="postcard-avatar" aria-hidden="true">
              N
            </span>
            <span>
              <span className="postcard-name">{kit?.brand_name ?? "Northline Trail Co."}</span>
              <span className="postcard-meta">Company page · not posted</span>
            </span>
          </header>
          <AutoTextarea
            aria-label="LinkedIn post"
            className="draft-input draft-copy"
            value={d.linkedin_post}
            placeholder={placeholder}
            readOnly={readOnly}
            onChange={(e) => onChange("linkedin_post", e.target.value)}
            onBlur={onBlur}
          />
        </article>
        <FlagStrip flags={flags.linkedin} runKey={runKey} channel="LinkedIn" pending={generating} />
      </section>

      <section aria-label="Email letter" className="stage-piece">
        <div className="piece-head">
          <p className="label">Email · letter</p>
          <Counter count={d.email_body.trim().length} max={undefined} />
        </div>
        <article className={`letter letter--composed${pulse}`}>
          {run?.audience && <p className="letter-to">To: {run.audience}</p>}
          <div className="letter-subject">
            <label htmlFor="email-subject" className="letter-subject-label">
              Subject
            </label>
            <input
              id="email-subject"
              className="draft-input letter-subject-input"
              value={d.email_subject}
              placeholder={generating ? "…" : undefined}
              readOnly={readOnly}
              onChange={(e) => onChange("email_subject", e.target.value)}
              onBlur={onBlur}
            />
            <Counter count={d.email_subject.trim().length} max={kit?.email_subject_max_chars} />
          </div>
          <AutoTextarea
            aria-label="Email body"
            className="draft-input draft-copy letter-body"
            value={d.email_body}
            placeholder={placeholder}
            readOnly={readOnly}
            onChange={(e) => onChange("email_body", e.target.value)}
            onBlur={onBlur}
          />
        </article>
        <FlagStrip flags={flags.email} runKey={runKey} channel="Email" pending={generating} />
      </section>
    </div>
  );
}
