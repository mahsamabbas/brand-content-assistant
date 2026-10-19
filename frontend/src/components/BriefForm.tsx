import type { FormEvent, KeyboardEvent } from "react";
import type { GenerateRequest, Tone } from "../types";

const TONES: Tone[] = ["calm", "bold", "warm"];

interface Props {
  value: GenerateRequest;
  onChange: (next: GenerateRequest) => void;
  onGenerate: () => void;
  onUseSample: () => void;
  generating: boolean;
  sampleLoading: boolean;
  error: string | null;
}

export default function BriefForm({
  value,
  onChange,
  onGenerate,
  onUseSample,
  generating,
  sampleLoading,
  error,
}: Props) {
  const ready = value.brief.trim() !== "" && value.audience.trim() !== "";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (ready && !generating) onGenerate();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (ready && !generating) onGenerate();
    }
  }

  return (
    <form className="brief-form" onSubmit={submit} onKeyDown={onKeyDown} aria-label="Brief">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Brief</p>
        <button type="button" className="link-quiet" onClick={onUseSample} disabled={sampleLoading || generating}>
          {sampleLoading ? "Loading…" : "Use sample brief"}
        </button>
      </div>

      <label className="field-label" htmlFor="brief">
        What are we announcing?
      </label>
      <textarea
        id="brief"
        className="field brief-textarea"
        rows={5}
        maxLength={4000}
        placeholder="The product, the moment, and what to emphasize."
        value={value.brief}
        onChange={(e) => onChange({ ...value, brief: e.target.value })}
        disabled={generating}
      />

      <label className="field-label" htmlFor="audience">
        Audience
      </label>
      <input
        id="audience"
        className="field"
        maxLength={500}
        placeholder="Who should this speak to?"
        value={value.audience}
        onChange={(e) => onChange({ ...value, audience: e.target.value })}
        disabled={generating}
      />

      <fieldset className="mt-4" disabled={generating}>
        <legend className="field-label">Tone</legend>
        <div className="segmented">
          {TONES.map((t) => (
            <label key={t}>
              <input
                type="radio"
                name="tone"
                value={t}
                checked={value.tone === t}
                onChange={() => onChange({ ...value, tone: t })}
              />
              {t}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn-approve btn-block mt-5" disabled={!ready || generating}>
        {generating ? "Drafting…" : "Generate drafts"}
      </button>
      <p className="kit-fine mt-2 text-center">
        {ready ? "⌘/Ctrl + Enter to generate · each run is saved to history" : "Brief and audience are required."}
      </p>

      {error && (
        <p className="notice mt-3" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
