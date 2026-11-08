import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { shouldShowOpenInPicker } from "./OpenInPicker.logic";

describe("shouldShowOpenInPicker", () => {
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
