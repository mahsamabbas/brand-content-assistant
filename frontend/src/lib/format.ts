import { API_BASE, ApiError } from "../api";

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function formatRunTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return `${sameDay ? "Today" : dayFmt.format(d)} · ${timeFmt.format(d)}`;
}

export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 503) return "Ollama isn’t reachable from the API. Start Ollama, then try again.";
    if (e.status === 502) return "The local model returned unreadable output, even after a repair pass. Generate again.";
    if (e.status === 404) return "That run no longer exists.";
    if (e.status === 422) return "Check the brief and audience — one is empty or too long.";
    return e.message;
  }
  if (e instanceof TypeError) return `Can’t reach the Briefsmith API at ${API_BASE}. Is the backend running?`;
  return e instanceof Error ? e.message : "Something went wrong.";
}

export function emailCopyText(subject: string, body: string): string {
  return subject.trim() ? `Subject: ${subject.trim()}\n\n${body}` : body;
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* Clipboard API missing or denied (insecure origin, embedded webview) — use the legacy path. */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Clipboard unavailable.");
}
