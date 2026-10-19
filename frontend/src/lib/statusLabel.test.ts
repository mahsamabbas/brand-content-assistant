import { describe, expect, it } from "vitest";
import { statusLabel } from "./statusLabel";

describe("statusLabel", () => {
  it("maps statuses", () => {
    expect(statusLabel("draft")).toBe("Draft");
    expect(statusLabel("ready_not_published")).toBe("Ready · not published");
  });
});
