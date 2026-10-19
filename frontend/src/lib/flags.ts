import type { DraftFields, Flag } from "../types";

const LINKEDIN_CODES = new Set(["empty_linkedin", "linkedin_too_long"]);
const EMAIL_CODES = new Set(["empty_email_subject", "empty_email_body", "email_subject_too_long"]);

export interface ChannelFlags {
  linkedin: Flag[];
  email: Flag[];
}

export function bannedPhraseOf(flag: Flag): string | null {
  const m = /"([^"]+)"/.exec(flag.message);
  return m ? m[1] : null;
}

/** Route server lint flags to the draft they belong to. Banned phrases go wherever the phrase appears. */
export function splitFlags(flags: Flag[], drafts: DraftFields): ChannelFlags {
  const linkedin: Flag[] = [];
  const email: Flag[] = [];
  const li = drafts.linkedin_post.toLowerCase();
  const em = `${drafts.email_subject}\n${drafts.email_body}`.toLowerCase();

  for (const flag of flags) {
    if (LINKEDIN_CODES.has(flag.code)) {
      linkedin.push(flag);
    } else if (EMAIL_CODES.has(flag.code)) {
      email.push(flag);
    } else if (flag.code === "banned_phrase") {
      const phrase = bannedPhraseOf(flag)?.toLowerCase();
      const inLi = phrase ? li.includes(phrase) : false;
      const inEm = phrase ? em.includes(phrase) : false;
      if (inLi) linkedin.push(flag);
      if (inEm) email.push(flag);
      if (!inLi && !inEm) linkedin.push(flag);
    } else {
      linkedin.push(flag);
    }
  }
  return { linkedin, email };
}

export function draftsOf(run: DraftFields): DraftFields {
  return {
    linkedin_post: run.linkedin_post,
    email_subject: run.email_subject,
    email_body: run.email_body,
  };
}

export function sameDrafts(a: DraftFields, b: DraftFields): boolean {
  return (
    a.linkedin_post === b.linkedin_post &&
    a.email_subject === b.email_subject &&
    a.email_body === b.email_body
  );
}

export function canApprove(drafts: DraftFields | null): boolean {
  return !!drafts && drafts.linkedin_post.trim() !== "" && drafts.email_body.trim() !== "";
}
