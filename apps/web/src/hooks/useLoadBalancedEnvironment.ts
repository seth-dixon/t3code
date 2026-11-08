import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { chooseLoadBalancedEnvironment } from "@t3tools/client-runtime/load-balancing";
import { executeAtomQuery } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { useContext } from "react";

import { environmentCatalog } from "../connection/catalog";
import { isEnvironmentTrustedIn } from "../connection/environmentTrust";
import { primaryEnvironmentIdAtom } from "../state/primaryEnvironment";
import { serverEnvironment } from "../state/server";

// Mirrors the freshness window in chooseLoadBalancedEnvironment.
const HOST_RESOURCES_FRESH_MS = 15_000;

// Keyed by content: callers derive the list every render.
const hostResourcesAtom = Atom.family((environmentIdsKey: string) =>
  Atom.make((get) => {
    const evaluatedAt = Date.now();
    const resources = (
      environmentIdsKey === "" ? [] : (environmentIdsKey.split("\n") as EnvironmentId[])
    ).map((environmentId) => {
      const result = get(serverEnvironment.hostResources({ environmentId, input: {} }));
      return {
        environmentId,
        resources: result._tag === "Success" ? result.value : null,
        receivedAt: result._tag === "Success" ? result.timestamp : 0,
        pending: result._tag === "Initial" || result.waiting,
        failed: result._tag === "Failure",
      };
    });
    // Re-read when the next fresh snapshot ages out, so a frozen evaluatedAt never selects it.
    const nextExpiry = Math.min(
      ...resources
        .map((resource) => resource.receivedAt + HOST_RESOURCES_FRESH_MS)
        .filter((expiresAt) => expiresAt >= evaluatedAt),
    );
    if (Number.isFinite(nextExpiry)) {
      const timer = setTimeout(() => get.refreshSelf(), nextExpiry - evaluatedAt + 1);
      get.addFinalizer(() => clearTimeout(timer));
    }
    return { evaluatedAt, resources };
  }),
);

/** Only mounted for unresolved automatic drafts, so idle clients do not poll hosts. */
export function useLoadBalancedEnvironment(
  candidateEnvironmentIds: readonly EnvironmentId[],
  weights: Readonly<Record<string, number>>,
) {
  const registry = useContext(RegistryContext);
  const trust = useAtomValue(environmentCatalog.untrustedEnvironmentIdsValueAtom);
  const catalog = useAtomValue(environmentCatalog.catalogValueAtom);
  const primaryEnvironmentId = useAtomValue(primaryEnvironmentIdAtom);
  // An untrusted environment never receives work this client did not send it on purpose.
  const environmentIds = candidateEnvironmentIds.filter((environmentId) =>
    isEnvironmentTrustedIn(trust, catalog, primaryEnvironmentId, environmentId),
  );
  const refresh = (ids: readonly EnvironmentId[]) => {
    for (const environmentId of ids) {
      registry.refresh(serverEnvironment.hostResources({ environmentId, input: {} }));
    }
  };
  const refreshSelection = async (ids: readonly EnvironmentId[]) => {
    const candidates = await Promise.all(
      ids.map(async (environmentId) => {
        const result = await executeAtomQuery(
          registry,
          serverEnvironment.hostResources({ environmentId, input: {} }),
          { refresh: true, reportFailure: false, signal: AbortSignal.timeout(5_000) },
        );
        return {
          environmentId,
          resources: result._tag === "Success" ? result.value : null,
          receivedAt: Date.now(),
          weight: weights[environmentId] ?? 50,
        };
      }),
    );
    return chooseLoadBalancedEnvironment(candidates, Date.now()) as EnvironmentId | null;
  };
  const { evaluatedAt, resources } = useAtomValue(hostResourcesAtom(environmentIds.join("\n")));
  const pending = resources.some((resource) => resource.pending);
  const environmentId = chooseLoadBalancedEnvironment(
    resources.map((resource) => ({
      ...resource,
      weight: weights[resource.environmentId] ?? 50,
    })),
    evaluatedAt,
  ) as EnvironmentId | null;
  return {
    refresh,
    refreshSelection,
    pending,
    environmentId,
    failed: !pending && environmentId === null && resources.some((resource) => resource.failed),
  };
}
