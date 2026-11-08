import { useAtomValue } from "@effect/atom-react";
import type {
  EnvironmentCatalogState,
  EnvironmentTrustState,
} from "@t3tools/client-runtime/state/connections";
import type { EnvironmentId } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

import { appAtomRegistry } from "../rpc/atomRegistry";
import { environmentCatalog } from "./catalog";

/**
 * Whether an environment's server may make this client act on its own machine (host a preview
 * page, open its paths in an editor). Fails closed: an environment that is not saved here, or
 * whose marks have not loaded yet, counts as untrusted.
 */
export function isEnvironmentTrustedIn(
  trust: EnvironmentTrustState,
  catalog: EnvironmentCatalogState,
  environmentId: EnvironmentId,
): boolean {
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
      environmentId,
    ),
  ).pipe(Atom.withLabel(`environment-trusted:${environmentId}`)),
);

export function readEnvironmentTrusted(environmentId: EnvironmentId): boolean {
  return appAtomRegistry.get(environmentTrustedAtom(environmentId));
}

export function useEnvironmentTrusted(environmentId: EnvironmentId | null): boolean {
  return useAtomValue(
    environmentId === null ? untrustedAtom : environmentTrustedAtom(environmentId),
  );
}

const untrustedAtom = Atom.make(false).pipe(Atom.withLabel("environment-trusted:none"));
