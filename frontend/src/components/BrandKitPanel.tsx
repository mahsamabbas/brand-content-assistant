import type { BrandKit } from "../types";

interface Props {
  kit: BrandKit | null;
  error: string | null;
  onRetry: () => void;
}

export default function BrandKitPanel({ kit, error, onRetry }: Props) {
  if (error && !kit) {
    return (
      <section aria-label="Brand kit" className="kit">
        <p className="label">Brand kit</p>
        <p className="notice mt-3" role="alert">
          {error}
        </p>
        <button type="button" className="btn-ghost mt-3" onClick={onRetry}>
          Retry
        </button>
      </section>
    );
  }

  if (!kit) {
    return (
      <section aria-label="Brand kit" aria-busy="true" className="kit">
        <p className="label">Brand kit</p>
        <div className="skeleton mt-3 h-6 w-2/3" />
        <div className="skeleton mt-3 h-4 w-full" />
        <div className="skeleton mt-2 h-4 w-5/6" />
      </section>
    );
  }

  return (
    <section aria-label="Brand kit" className="kit">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Brand kit</p>
        <p className="kit-version">{kit.version}</p>
      </div>
      <h2 className="display mt-2 text-xl">{kit.brand_name}</h2>
      <p className="kit-voice mt-2">{kit.voice}</p>

      <div className="mt-4 grid gap-4">
        <div>
          <p className="kit-subhead">Do</p>
          <ul className="kit-list">
            {kit.do.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="kit-subhead">Don’t</p>
          <ul className="kit-list kit-list--dont">
            {kit.dont.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="kit-fine mt-4">
        <span className="kit-subhead">Never say</span>{" "}
        {kit.banned_phrases.map((p, i) => (
          <span key={p}>
            {i > 0 && ", "}“{p}”
          </span>
        ))}
      </p>
      <p className="kit-fine mt-1">
        LinkedIn ≤ {kit.linkedin_max_chars.toLocaleString()} chars · email subject ≤ {kit.email_subject_max_chars}
      </p>
    </section>
  );
}
