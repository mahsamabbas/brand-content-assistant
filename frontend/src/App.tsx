import { statusLabel } from "./lib/statusLabel";

// Placeholder shell — full studio composition lands in Task 6.
export default function App() {
  return (
    <div className="grain min-h-screen flex items-center justify-center p-8">
      <main className="max-w-xl">
        <h1 className="wordmark text-6xl md:text-7xl">Briefsmith</h1>
        <p className="kit-voice mt-6">Calm, practical, outdoorsy. Concrete trail benefits over hype.</p>
        <p className="label mt-8">
          Northline Trail Co. · <span className="status-badge" data-status="draft">{statusLabel("draft")}</span>
        </p>
      </main>
    </div>
  );
}
