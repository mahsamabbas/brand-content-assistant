import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import BrandKitPanel from "./components/BrandKitPanel";
import BriefForm from "./components/BriefForm";
import DraftStage from "./components/DraftStage";
import EmptyDesk from "./components/EmptyDesk";
import ReviewBar, { type SaveState } from "./components/ReviewBar";
import RunHistory from "./components/RunHistory";
import { canApprove, draftsOf, sameDrafts } from "./lib/flags";
import { describeError, formatRunTime } from "./lib/format";
import type { BrandKit, DraftFields, Flag, GenerateRequest, Run, RunSummary } from "./types";

const EMPTY_FORM: GenerateRequest = { brief: "", audience: "", tone: "calm" };
const SAVE_DEBOUNCE_MS = 1200;

function flagsFromDetail(detail: unknown): Flag[] | null {
  if (detail && typeof detail === "object" && "flags" in detail && Array.isArray((detail as { flags: unknown }).flags)) {
    return (detail as { flags: Flag[] }).flags;
  }
  return null;
}

export default function App() {
  const [view, setView] = useState<"desk" | "studio">("desk");
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [kitError, setKitError] = useState<string | null>(null);
  const [form, setForm] = useState<GenerateRequest>(EMPTY_FORM);
  const [run, setRun] = useState<Run | null>(null);
  const [drafts, setDrafts] = useState<DraftFields | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsState, setRunsState] = useState<"loading" | "ready" | "error">("loading");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [approving, setApproving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const runRef = useRef<Run | null>(null);
  const draftsRef = useRef<DraftFields | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const saveSeq = useRef(0);

  const applyRun = useCallback((next: Run | null) => {
    runRef.current = next;
    setRun(next);
  }, []);

  const loadRun = useCallback(
    (next: Run) => {
      window.clearTimeout(saveTimer.current);
      saveSeq.current++;
      applyRun(next);
      const d = draftsOf(next);
      draftsRef.current = d;
      setDrafts(d);
      setSaveState("idle");
      setReviewError(null);
    },
    [applyRun],
  );

  const loadKit = useCallback(async () => {
    setKitError(null);
    try {
      setKit(await api.getBrandKit());
    } catch (e) {
      setKitError(describeError(e));
    }
  }, []);

  const refreshRuns = useCallback(async () => {
    try {
      setRuns(await api.listRuns());
      setRunsState("ready");
    } catch {
      setRunsState("error");
    }
  }, []);

  useEffect(() => {
    void loadKit();
    void refreshRuns();
  }, [loadKit, refreshRuns]);

  useEffect(() => {
    if (!historyOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHistoryOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen]);

  const persist = useCallback(async (): Promise<void> => {
    window.clearTimeout(saveTimer.current);
    const current = runRef.current;
    const d = draftsRef.current;
    if (!current || !d || sameDrafts(draftsOf(current), d)) return;
    const seq = ++saveSeq.current;
    setSaveState("saving");
    try {
      const updated = await api.patchRun(current.id, d);
      if (runRef.current?.id !== updated.id) return;
      applyRun(updated);
      if (seq === saveSeq.current) {
        const latest = draftsRef.current;
        setSaveState(latest && sameDrafts(draftsOf(updated), latest) ? "saved" : "dirty");
      }
    } catch (e) {
      if (seq === saveSeq.current) {
        setSaveState("error");
        setReviewError(describeError(e));
      }
    }
  }, [applyRun]);

  function onDraftChange(field: keyof DraftFields, value: string) {
    if (!draftsRef.current) return;
    const next = { ...draftsRef.current, [field]: value };
    draftsRef.current = next;
    setDrafts(next);
    setSaveState("dirty");
    setReviewError(null);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
  }

  async function loadSample() {
    setSampleLoading(true);
    setSampleError(null);
    try {
      const sample = await api.getSampleBrief();
      setForm({ brief: sample.brief, audience: sample.audience, tone: sample.tone });
      setView("studio");
    } catch (e) {
      setSampleError(describeError(e));
    } finally {
      setSampleLoading(false);
    }
  }

  async function onGenerate() {
    await persist();
    setGenerating(true);
    setGenerateError(null);
    setReviewError(null);
    try {
      const created = await api.generate({
        brief: form.brief.trim(),
        audience: form.audience.trim(),
        tone: form.tone,
      });
      loadRun(created);
      void refreshRuns();
    } catch (e) {
      setGenerateError(describeError(e));
    } finally {
      setGenerating(false);
    }
  }

  async function openRun(id: string) {
    if (generating) return;
    if (id === runRef.current?.id) {
      setHistoryOpen(false);
      return;
    }
    await persist();
    setOpeningId(id);
    try {
      const opened = await api.getRun(id);
      loadRun(opened);
      setForm({ brief: opened.brief, audience: opened.audience, tone: opened.tone });
      setGenerateError(null);
      setView("studio");
      setHistoryOpen(false);
    } catch (e) {
      setReviewError(describeError(e));
      if (e instanceof ApiError && e.status === 404) void refreshRuns();
    } finally {
      setOpeningId(null);
    }
  }

  async function onApprove() {
    const current = runRef.current;
    const d = draftsRef.current;
    if (!current || !d || !canApprove(d)) return;
    window.clearTimeout(saveTimer.current);
    const seq = ++saveSeq.current;
    setApproving(true);
    setReviewError(null);
    try {
      const updated = await api.patchRun(current.id, { ...d, status: "ready_not_published" });
      if (runRef.current?.id !== updated.id) return;
      applyRun(updated);
      if (seq === saveSeq.current) setSaveState("idle");
      setFlashKey((k) => k + 1);
      setRuns((rs) => rs.map((r) => (r.id === updated.id ? { ...r, status: updated.status } : r)));
    } catch (e) {
      const flags = e instanceof ApiError ? flagsFromDetail(e.detail) : null;
      if (flags && runRef.current?.id === current.id) applyRun({ ...current, flags });
      setReviewError(describeError(e));
    } finally {
      setApproving(false);
    }
  }

  if (view === "desk") {
    return (
      <EmptyDesk
        onUseSample={loadSample}
        onStartBlank={() => setView("studio")}
        sampleLoading={sampleLoading}
        error={sampleError ?? reviewError}
        latestRunCount={runs.length}
        onReopenLatest={() => runs[0] && void openRun(runs[0].id)}
      />
    );
  }

  return (
    <div className="grain studio">
      <aside className="rail studio-rail brief-rail" aria-label="Brief rail">
        <header className="rail-brand">
          <span className="wordmark text-2xl">Briefsmith</span>
          <span className="kit-fine">for {kit?.brand_name ?? "Northline Trail Co."}</span>
        </header>
        <BrandKitPanel kit={kit} error={kitError} onRetry={loadKit} />
        <hr className="rule" />
        <BriefForm
          value={form}
          onChange={setForm}
          onGenerate={onGenerate}
          onUseSample={loadSample}
          generating={generating}
          sampleLoading={sampleLoading}
          error={generateError ?? sampleError}
        />
      </aside>

      <main className="stage" aria-label="Draft stage">
        <div className="stage-top">
          <p className="label">
            Draft stage
            {run && (
              <span className="stage-meta">
                {" "}
                · {formatRunTime(run.created_at)} · {run.tone} · {run.brand_kit_version}
              </span>
            )}
          </p>
          <button
            type="button"
            className="btn-ghost history-toggle"
            onClick={() => setHistoryOpen(true)}
            aria-controls="run-history"
            aria-expanded={historyOpen}
          >
            History{runs.length > 0 && ` · ${runs.length}`}
          </button>
        </div>
        <div className="stage-scroll">
          <DraftStage
            run={run}
            drafts={drafts}
            kit={kit}
            generating={generating}
            onChange={onDraftChange}
            onBlur={() => void persist()}
          />
        </div>
        <ReviewBar
          run={run}
          drafts={drafts}
          canApprove={canApprove(drafts)}
          approving={approving}
          generating={generating}
          saveState={saveState}
          flashKey={flashKey}
          flagCount={run?.flags.length ?? 0}
          error={reviewError}
          onApprove={onApprove}
        />
      </main>

      <RunHistory
        runs={runs}
        state={runsState}
        activeId={run?.id ?? null}
        openingId={openingId}
        open={historyOpen}
        onOpen={openRun}
        onClose={() => setHistoryOpen(false)}
        onRetry={refreshRuns}
      />
    </div>
  );
}
