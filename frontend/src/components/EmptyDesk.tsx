interface Props {
  onUseSample: () => void;
  onStartBlank: () => void;
  sampleLoading: boolean;
  error: string | null;
  latestRunCount: number;
  onReopenLatest: () => void;
}

export default function EmptyDesk({
  onUseSample,
  onStartBlank,
  sampleLoading,
  error,
  latestRunCount,
  onReopenLatest,
}: Props) {
  return (
    <main className="grain desk">
      <div className="desk-inner">
        <p className="label desk-rise">Northline Trail Co. · content desk</p>
        <h1 className="wordmark desk-wordmark desk-rise" style={{ animationDelay: "60ms" }}>
          Briefsmith
        </h1>
        <p className="desk-tagline desk-rise" style={{ animationDelay: "140ms" }}>
          Brand-safe drafts. Human-approved. Never published.
        </p>
        <div className="desk-actions desk-rise" style={{ animationDelay: "220ms" }}>
          <button type="button" className="btn-moss btn-lg" onClick={onUseSample} disabled={sampleLoading}>
            {sampleLoading ? "Loading sample…" : "Use sample brief"}
          </button>
          <button type="button" className="btn-ghost btn-lg" onClick={onStartBlank}>
            Start blank
          </button>
        </div>
        {latestRunCount > 0 && (
          <p className="kit-fine desk-rise mt-6" style={{ animationDelay: "300ms" }}>
            <button type="button" className="link-quiet" onClick={onReopenLatest}>
              Reopen latest run
            </button>{" "}
            · {latestRunCount} saved in history
          </p>
        )}
        {error && (
          <p className="notice mt-6 max-w-lg" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
