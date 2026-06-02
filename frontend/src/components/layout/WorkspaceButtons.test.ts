import { describe, expect, it } from "vitest";
import { resolveWorkspaceButtonTargets } from "./WorkspaceButtons";
import type { WorkspaceKey } from "@/contexts/AuthContext";

function resolver(accessible: WorkspaceKey[]) {
  return (key: WorkspaceKey) => accessible.includes(key);
}

describe("resolveWorkspaceButtonTargets", () => {
  it("shows vet portal while a vet user is in marketplace", () => {
    const targets = resolveWorkspaceButtonTargets({
      currentWorkspace: "marketplace",
      canAccess: resolver(["marketplace", "vet", "learning"]),
    });

    expect(targets).toContain("vet");
    expect(targets).toContain("learning");
    expect(targets).not.toContain("marketplace");
  });

  it("hides vet portal while already in the vet panel", () => {
    const targets = resolveWorkspaceButtonTargets({
      currentWorkspace: "vet",
      canAccess: resolver(["marketplace", "vet", "vetbondhu"]),
    });

    expect(targets).toContain("marketplace");
    expect(targets).toContain("vetbondhu");
    expect(targets).not.toContain("vet");
  });

  it("does not include disabled or inaccessible workspaces", () => {
    const targets = resolveWorkspaceButtonTargets({
      currentWorkspace: "vet",
      canAccess: resolver(["vet", "community"]),
    });

    expect(targets).toEqual(["community"]);
  });

  it("deduplicates custom targets before filtering", () => {
    const targets = resolveWorkspaceButtonTargets({
      targets: ["marketplace", "marketplace", "vet"],
      currentWorkspace: "vet",
      canAccess: resolver(["marketplace", "vet"]),
    });

    expect(targets).toEqual(["marketplace"]);
  });
});
