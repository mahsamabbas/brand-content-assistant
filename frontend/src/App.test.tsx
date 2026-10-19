import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Run } from "./types";

const kit = {
  brand_name: "Northline Trail Co.",
  version: "northline-v1",
  voice: "Calm, practical, outdoorsy.",
  do: ["Name specific product benefits"],
  dont: ["Fake urgency"],
  banned_phrases: ["clinically proven"],
  linkedin_max_chars: 1300,
  email_subject_max_chars: 90,
};

const run: Run = {
  id: "run-1",
  created_at: "2026-10-19T20:00:00+00:00",
  brief: "Announce the Ridge Shell jacket.",
  audience: "Weekend hikers",
  tone: "calm",
  status: "draft",
  linkedin_post: "Shoulder season, sorted.",
  email_subject: "Meet the Ridge Shell",
  email_body: "A quiet shell for cool loops.",
  flags: [],
  brand_kit_version: "northline-v1",
};

const api = vi.hoisted(() => ({
  getBrandKit: vi.fn(),
  getSampleBrief: vi.fn(),
  generate: vi.fn(),
  listRuns: vi.fn(),
  getRun: vi.fn(),
  patchRun: vi.fn(),
}));

vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), api }));

import App from "./App";

beforeEach(() => {
  api.getBrandKit.mockResolvedValue(kit);
  api.listRuns.mockResolvedValue([]);
  api.getSampleBrief.mockResolvedValue({ brief: run.brief, audience: run.audience, tone: "calm" });
  api.generate.mockResolvedValue(run);
  api.patchRun.mockImplementation(async (_id: string, body: Partial<Run>) => ({ ...run, ...body }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App studio flow", () => {
  it("goes from empty desk to sample brief, generate, and approve", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Briefsmith" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use sample brief" }));
    const brief = await screen.findByLabelText("What are we announcing?");
    expect(brief).toHaveValue(run.brief);
    expect(await screen.findByText("Calm, practical, outdoorsy.")).toBeInTheDocument();
    expect(screen.getByText("Nothing is published from this app.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate drafts" }));
    expect(await screen.findByLabelText("LinkedIn post")).toHaveValue(run.linkedin_post);
    expect(api.generate).toHaveBeenCalledWith({ brief: run.brief, audience: run.audience, tone: "calm" });

    fireEvent.click(screen.getByRole("button", { name: "Approve · mark ready" }));
    expect(await screen.findByText("Ready · not published")).toBeInTheDocument();
    expect(api.patchRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "ready_not_published" }));
    expect(screen.getByRole("button", { name: "Copy LinkedIn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy email" })).toBeInTheDocument();
  });

  it("saves draft edits on blur", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Use sample brief" }));
    fireEvent.click(await screen.findByRole("button", { name: "Generate drafts" }));
    const post = await screen.findByLabelText("LinkedIn post");

    fireEvent.change(post, { target: { value: "Edited post" } });
    fireEvent.blur(post);
    await waitFor(() =>
      expect(api.patchRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ linkedin_post: "Edited post" })),
    );
  });

  it("disables approve when a draft is empty", async () => {
    api.generate.mockResolvedValue({ ...run, email_body: "" });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Use sample brief" }));
    fireEvent.click(await screen.findByRole("button", { name: "Generate drafts" }));
    await screen.findByLabelText("LinkedIn post");
    expect(screen.getByRole("button", { name: "Approve · mark ready" })).toBeDisabled();
  });
});
