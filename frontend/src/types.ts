// Mirrors backend/app/schemas.py

export type Tone = "calm" | "bold" | "warm";
export type RunStatus = "draft" | "ready_not_published";

export type FlagCode =
  | "empty_linkedin"
  | "empty_email_body"
  | "empty_email_subject"
  | "linkedin_too_long"
  | "email_subject_too_long"
  | "banned_phrase";

export interface Flag {
  code: FlagCode | (string & {});
  message: string;
}

export interface BrandKit {
  brand_name: string;
  version: string;
  voice: string;
  do: string[];
  dont: string[];
  banned_phrases: string[];
  linkedin_max_chars: number;
  email_subject_max_chars: number;
}

export interface SampleBrief {
  brief: string;
  audience: string;
  tone: Tone;
}

export interface GenerateRequest {
  brief: string;
  audience: string;
  tone: Tone;
}

export interface Run {
  id: string;
  created_at: string;
  brief: string;
  audience: string;
  tone: Tone;
  status: RunStatus;
  linkedin_post: string;
  email_subject: string;
  email_body: string;
  flags: Flag[];
  brand_kit_version: string;
}

export type DraftFields = Pick<Run, "linkedin_post" | "email_subject" | "email_body">;

export interface RunSummary {
  id: string;
  brief_snippet: string;
  status: RunStatus;
  created_at: string;
}

export interface PatchRunRequest {
  linkedin_post?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  status?: RunStatus | null;
}

export interface HealthResponse {
  status: string;
  ollama: boolean;
  model: string;
}
