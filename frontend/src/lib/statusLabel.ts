export function statusLabel(status: "draft" | "ready_not_published"): string {
  return status === "ready_not_published" ? "Ready · not published" : "Draft";
}
