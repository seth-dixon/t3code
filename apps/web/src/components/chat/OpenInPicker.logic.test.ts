import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { shouldShowOpenInPicker } from "./OpenInPicker.logic";

describe("shouldShowOpenInPicker", () => {
  it("shows both local environments when the primary has a separate WSL home", () => {
    const primaryEnvironmentId = EnvironmentId.make("wsl");
    const hostEnvironmentId = EnvironmentId.make("host");
    for (const [activeThreadEnvironmentId, visible] of [
      [primaryEnvironmentId, true],
      [hostEnvironmentId, true],
      [EnvironmentId.make("other"), false],
    ] as const) {
      expect(
        shouldShowOpenInPicker({
          activeProjectName: "Project",
          activeThreadEnvironmentId,
          primaryEnvironmentId,
          hostEnvironmentId,
          remoteOpenMode: "local-exec",
        }),
      ).toBe(visible);
    }
  });

  const show = (environmentId: string, hostEnvironmentId: string | null) =>
    shouldShowOpenInPicker({
      activeProjectName: "web",
      activeThreadEnvironmentId: EnvironmentId.make(environmentId),
      primaryEnvironmentId: null,
      hostEnvironmentId,
      remoteOpenMode: "local-exec",
    });

  it("shows local editors for the desktop's own service but not another local backend", () => {
    expect(show("desktop-home", "desktop-home")).toBe(true);
    expect(show("wsl", "desktop-home")).toBe(false);
  });
});
