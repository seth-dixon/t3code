import {
  AuthPreviewOperateScope,
  type DesktopPreviewBridge,
  type DesktopPreviewOpenLinkEvent,
  FILL_PREVIEW_VIEWPORT,
} from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import { type ComponentProps, useState } from "react";

import { environmentCatalog } from "~/connection/catalog";
import { isEnvironmentTrustedIn, readEnvironmentTrusted } from "~/connection/environmentTrust";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";

import { isElectron } from "~/env";
import { useClientSettingsHydrated } from "~/hooks/useSettings";
import { useDesktopHostedPreviewSessions } from "~/components/preview/usePreviewSession";
import { readActivePreviewSessions, useActivePreviewSessions } from "~/previewStateStore";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { previewEnvironment } from "~/state/preview";
import { useEnvironmentScope } from "~/state/session";

import { readPreviewAnnotationTheme } from "./annotationTheme";
import { useBrowserDefaults } from "./browserDefaults";
import { useBrowserPointerStore } from "./browserPointerStore";
import { HostedBrowserWebview } from "./HostedBrowserWebview";
import { openUrlInPreview } from "./openFileInPreview";
import { hostedBrowserSessions } from "./hostedBrowserSessions";

function startAnnotationThemeSync(preview: DesktopPreviewBridge): () => void {
  let lastSerializedTheme = "";
  const syncTheme = () => {
    const theme = readPreviewAnnotationTheme();
    const serializedTheme = JSON.stringify(theme);
    if (serializedTheme === lastSerializedTheme) return;
    lastSerializedTheme = serializedTheme;
    void preview.setAnnotationTheme(theme).catch(() => {
      lastSerializedTheme = "";
    });
  };
  // App services start before the first paint, when the theme styles may not be applied yet.
  const frameId = window.requestAnimationFrame(syncTheme);
  const observer = new MutationObserver(syncTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  const headObserver = new MutationObserver(syncTheme);
  headObserver.observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return () => {
    window.cancelAnimationFrame(frameId);
    observer.disconnect();
    headObserver.disconnect();
  };
}

function openLinkInPreview({ tabId, url, background }: DesktopPreviewOpenLinkEvent): void {
  const source = hostedBrowserSessions(
    readActivePreviewSessions(),
    appAtomRegistry.get(primaryEnvironmentIdAtom),
    readEnvironmentTrusted,
  ).find((session) => session.runtimeTabId === tabId);
  if (!source) return;
  void openUrlInPreview({
    threadRef: source.threadRef,
    url,
    openPreview: (input) => runAtomCommand(appAtomRegistry, previewEnvironment.open, input),
    profileId: source.snapshot.profileId,
    background,
  });
}

/** App-lifetime listeners for the desktop preview bridge: annotation theme, agent pointer, links. */
export function startElectronBrowserHost(): () => void {
  const preview = window.desktopBridge?.preview;
  if (!preview) return () => {};
  const disposers = [
    startAnnotationThemeSync(preview),
    preview.onPointerEvent((event) => {
      useBrowserPointerStore.getState().apply(event);
    }),
    preview.onOpenLink(openLinkInPreview),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}

export function ElectronBrowserHost() {
  const previewByThreadKey = useActivePreviewSessions();
  const primaryEnvironmentId = useAtomValue(primaryEnvironmentIdAtom);
  const trust = useAtomValue(environmentCatalog.untrustedEnvironmentIdsValueAtom);
  const catalog = useAtomValue(environmentCatalog.catalogValueAtom);
  useDesktopHostedPreviewSessions(primaryEnvironmentId);
  const sessions = hostedBrowserSessions(previewByThreadKey, primaryEnvironmentId, (id) =>
    isEnvironmentTrustedIn(trust, catalog, id),
  );

  if (!isElectron) return null;
  return (
    <div className="contents" data-electron-browser-host>
      {sessions.map(({ threadRef, snapshot, runtimeTabId, pictureInPicture, zoomFactor }) => {
        const url = snapshot.navStatus._tag === "Idle" ? null : snapshot.navStatus.url;
        return (
          <AuthorizedBrowserWebview
            key={runtimeTabId}
            threadRef={threadRef}
            tabId={snapshot.tabId}
            runtimeTabId={runtimeTabId}
            initialUrl={url}
            viewport={snapshot.viewport ?? FILL_PREVIEW_VIEWPORT}
            pictureInPicture={pictureInPicture}
            profileId={snapshot.profileId}
            zoomFactor={zoomFactor}
            serverDriven={snapshot.runtime === "server"}
            {...(snapshot.runtime === "server"
              ? {
                  serverRendering: {
                    colorScheme: snapshot.colorScheme ?? "system",
                    zoomFactor: snapshot.zoomFactor ?? 1,
                  },
                }
              : {})}
          />
        );
      })}
    </div>
  );
}

function AuthorizedBrowserWebview(props: ComponentProps<typeof HostedBrowserWebview>) {
  const canOperatePreview = useEnvironmentScope(
    props.threadRef.environmentId,
    AuthPreviewOperateScope,
  );
  const profileId = useTabProfileId(props.profileId);
  return canOperatePreview ? <HostedBrowserWebview {...props} profileId={profileId} /> : null;
}

// Latch after hydration: Electron fixes the partition when the guest attaches.
function useTabProfileId(profileId: string | undefined): string | undefined {
  const hydrated = useClientSettingsHydrated();
  const defaultProfileId = useBrowserDefaults().profileId;
  const [fallback, setFallback] = useState<string | undefined>(undefined);
  if (profileId === undefined && hydrated && fallback === undefined) {
    setFallback(defaultProfileId);
  }
  return profileId ?? fallback;
}
