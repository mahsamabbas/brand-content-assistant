import type { Flag } from "../types";

interface Props {
  flags: Flag[];
  runKey: string;
  channel: string;
  pending?: boolean;
}

export default function FlagStrip({ flags, runKey, channel, pending = false }: Props) {
  if (pending) return <div className="flag-strip" aria-hidden="true" />;

  return (
    <div className="flag-strip" role="status" aria-live="polite" aria-label={`${channel} lint flags`}>
      {flags.length === 0 ? (
        <p className="flag-clean">Clean — no lint flags.</p>
      ) : (
        <ul className="flag-list">
          {flags.map((f, i) => (
            <li
              key={`${runKey}:${f.code}:${f.message}`}
              className="flag flag-enter"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="flag-tag">Flag</span>
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
