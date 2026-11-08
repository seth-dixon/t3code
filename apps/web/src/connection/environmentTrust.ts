import { useAtomValue } from "@effect/atom-react";
import type {
  EnvironmentCatalogState,
  EnvironmentTrustState,
} from "@t3tools/client-runtime/state/connections";
import type { EnvironmentId } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

import { appAtomRegistry } from "../rpc/atomRegistry";
import { primaryEnvironmentIdAtom } from "../state/primaryEnvironment";
import { environmentCatalog } from "./catalog";

/**
 * Whether an environment's server may make this client act on its own machine (host a preview
 * page, open its paths in an editor). The primary backend this client launched always may; an
 * environment id alone proves nothing, since a server chooses the id it advertises. Anything else
 * fails closed: an environment that is not saved here, or whose marks can't be read, is untrusted.
 */
export function isEnvironmentTrustedIn(
  trust: EnvironmentTrustState,
  catalog: EnvironmentCatalogState,
  primaryEnvironmentId: EnvironmentId | null,
  environmentId: EnvironmentId,
): boolean {
  if (environmentId === primaryEnvironmentId) return true;
  return (
    trust.isReady &&
    catalog.isReady &&
    catalog.entries.has(environmentId) &&
    !trust.untrusted.has(environmentId)
  );
}

export const environmentTrustedAtom = Atom.family((environmentId: EnvironmentId) =>
  Atom.make((get) =>
    isEnvironmentTrustedIn(
      get(environmentCatalog.untrustedEnvironmentIdsValueAtom),
      get(environmentCatalog.catalogValueAtom),
      get(primaryEnvironmentIdAtom),
      environmentId,
    ),
  ).pipe(Atom.withLabel(`environment-trusted:${environmentId}`)),
);

export function readEnvironmentTrusted(environmentId: EnvironmentId): boolean {
  return appAtomRegistry.get(environmentTrustedAtom(environmentId));
}

/** With no environment, the content may be from any of them, so it is trusted only when all are. */
export function useEnvironmentTrusted(environmentId: EnvironmentId | null): boolean {
  return useAtomValue(
    environmentId === null ? noEnvironmentUntrustedAtom : environmentTrustedAtom(environmentId),
  );
}

const noEnvironmentUntrustedAtom = Atom.make((get) => {
  const trust = get(environmentCatalog.untrustedEnvironmentIdsValueAtom);
  return trust.isReady && trust.untrusted.size === 0;
}).pipe(Atom.withLabel("environment-trusted:unknown"));
