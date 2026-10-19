import { describe, expect, it } from "vitest";
import { canApprove, sameDrafts, splitFlags } from "./flags";

const drafts = {
  linkedin_post: "Our jacket is clinically proven to keep you dry.",
  email_subject: "Meet the Ridge Shell",
  email_body: "Guaranteed results on every loop.",
};

describe("splitFlags", () => {
  it("routes channel flags and banned phrases to the draft containing them", () => {
    const { linkedin, email } = splitFlags(
      [
        { code: "linkedin_too_long", message: "LinkedIn post exceeds 1300 characters (1400)." },
        { code: "empty_email_subject", message: "Email subject is empty." },
        { code: "banned_phrase", message: 'Banned phrase found: "clinically proven".' },
        { code: "banned_phrase", message: 'Banned phrase found: "guaranteed results".' },
      ],
      drafts,
    );
    expect(linkedin.map((f) => f.message)).toEqual([
      "LinkedIn post exceeds 1300 characters (1400).",
      'Banned phrase found: "clinically proven".',
    ]);
    expect(email.map((f) => f.message)).toEqual([
      "Email subject is empty.",
      'Banned phrase found: "guaranteed results".',
    ]);
  });

  it("keeps a stale banned-phrase flag visible", () => {
    const { linkedin } = splitFlags([{ code: "banned_phrase", message: 'Banned phrase found: "gone".' }], drafts);
    expect(linkedin).toHaveLength(1);
  });
});

describe("draft helpers", () => {
  it("requires LinkedIn and email body to approve", () => {
    expect(canApprove(drafts)).toBe(true);
    expect(canApprove({ ...drafts, email_body: "  " })).toBe(false);
    expect(canApprove(null)).toBe(false);
  });

  it("compares drafts field by field", () => {
    expect(sameDrafts(drafts, { ...drafts })).toBe(true);
    expect(sameDrafts(drafts, { ...drafts, email_subject: "x" })).toBe(false);
  });
});
