import type {
  BrandKit,
  GenerateRequest,
  HealthResponse,
  PatchRunRequest,
  Run,
  RunSummary,
  SampleBrief,
} from "./types";

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8007";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function messageFromDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    const m = (detail as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = ((await res.json()) as { detail?: unknown }).detail ?? null;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, messageFromDetail(detail, res.statusText || "Request failed"), detail);
  }
  return (await res.json()) as T;
}

export const api = {
  getHealth: () => request<HealthResponse>("/health"),
  getBrandKit: () => request<BrandKit>("/brand-kit"),
  getSampleBrief: () => request<SampleBrief>("/sample-brief"),
  generate: (body: GenerateRequest) =>
    request<Run>("/generate", { method: "POST", body: JSON.stringify(body) }),
  listRuns: () => request<RunSummary[]>("/runs"),
  getRun: (id: string) => request<Run>(`/runs/${encodeURIComponent(id)}`),
  patchRun: (id: string, body: PatchRunRequest) =>
    request<Run>(`/runs/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
};

export const getHealth = api.getHealth;
export const getBrandKit = api.getBrandKit;
export const getSampleBrief = api.getSampleBrief;
export const generate = api.generate;
export const listRuns = api.listRuns;
export const getRun = api.getRun;
export const patchRun = api.patchRun;
