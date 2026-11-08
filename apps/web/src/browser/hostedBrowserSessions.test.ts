import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { BearerConnectionTarget } from "@t3tools/client-runtime/connection";
import { EnvironmentId, type PreviewSessionSnapshot, ThreadId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { describe, expect, it } from "vite-plus/test";

import { isEnvironmentTrustedIn } from "~/connection/environmentTrust";
import { __testing as previewStateTesting } from "~/previewStateStore";

import { hostedBrowserSessions } from "./hostedBrowserSessions";

const LOCAL = EnvironmentId.make("local-t3");
const VM = EnvironmentId.make("sandbox-vm");
const localRef = scopeThreadRef(LOCAL, ThreadId.make("local-thread"));
const vmRef = scopeThreadRef(VM, ThreadId.make("vm-thread"));

const desktopTab = (threadId: string, url: string): PreviewSessionSnapshot => ({
  threadId,
  tabId: `${threadId}-tab`,
  navStatus: { _tag: "Loading", url, title: "" },
  canGoBack: false,
  canGoForward: false,
  updatedAt: "2026-11-08T00:00:00.000Z",
});

const previews = {
  [scopedThreadKey(localRef)]: {
    ...previewStateTesting.EMPTY_THREAD_PREVIEW_STATE,
    sessions: { "local-thread-tab": desktopTab("local-thread", "http://127.0.0.1:47690/host") },
  },
  [scopedThreadKey(vmRef)]: {
    ...previewStateTesting.EMPTY_THREAD_PREVIEW_STATE,
    sessions: { "vm-thread-tab": desktopTab("vm-thread", "http://127.0.0.1:47690/vm") },
  },
};

const entry = (environmentId: EnvironmentId, connectionId: string) => ({
  target: new BearerConnectionTarget({ environmentId, label: environmentId, connectionId }),
  profile: Option.none(),
  enabled: true,
});

const hostedUrls = (input: {
  readonly vmRoute: string;
  readonly untrusted: ReadonlyArray<EnvironmentId>;
  readonly trustReady?: boolean;
  readonly saved?: ReadonlyArray<EnvironmentId>;
  readonly primary?: EnvironmentId;
}) => {
  const catalog = {
    isReady: true,
    entries: new Map(
      [entry(LOCAL, "bearer:http://127.0.0.1:3780"), entry(VM, input.vmRoute)]
        .filter((saved) => (input.saved ?? [LOCAL, VM]).includes(saved.target.environmentId))
        .map((saved) => [saved.target.environmentId, saved] as const),
    ),
  };
  const trust = { isReady: input.trustReady ?? true, untrusted: new Set(input.untrusted) };
  return hostedBrowserSessions(previews, null, (id) =>
    isEnvironmentTrustedIn(trust, catalog, input.primary ?? null, id),
  ).map(({ snapshot }) => (snapshot.navStatus._tag === "Idle" ? null : snapshot.navStatus.url));
};

describe("hostedBrowserSessions", () => {
  it("hosts no page for an untrusted environment on any of its routes", () => {
    for (const vmRoute of ["bearer:http://127.0.0.1:47731", "learned:https://198.51.100.7/"]) {
      expect(hostedUrls({ vmRoute, untrusted: [VM] })).toEqual(["http://127.0.0.1:47690/host"]);
    }
  });

  it("hosts trusted environments' pages", () => {
    expect(hostedUrls({ vmRoute: "bearer:http://127.0.0.1:47731", untrusted: [] })).toEqual([
      "http://127.0.0.1:47690/host",
      "http://127.0.0.1:47690/vm",
    ]);
  });

  it("hosts nothing before the marks load, nor for an environment that is not saved", () => {
    const vmRoute = "bearer:http://127.0.0.1:47731";
    expect(hostedUrls({ vmRoute, untrusted: [], trustReady: false })).toEqual([]);
    // The primary backend keeps its previews, even when the marks can't be read or name it.
    for (const trustReady of [true, false]) {
      expect(hostedUrls({ vmRoute, untrusted: [LOCAL, VM], trustReady, primary: LOCAL })).toEqual([
        "http://127.0.0.1:47690/host",
      ]);
    }
    expect(hostedUrls({ vmRoute, untrusted: [], saved: [LOCAL] })).toEqual([
      "http://127.0.0.1:47690/host",
    ]);
  });
});
