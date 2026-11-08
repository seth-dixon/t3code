import type { EnvironmentId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import { ConnectionBlockedError, type ConnectionAttemptError } from "./model.ts";

/**
 * Environments this client must not let act on its own machine. Kept apart from the connection
 * catalog, like pull request grants, so a stale window's catalog save cannot clear a mark.
 * Only an explicit unmark clears one; a mark left behind fails closed.
 */
export class EnvironmentTrustMarks extends Context.Reference<{
  /** The marks as stored now. Fails when they can't be read, which callers treat as untrusted. */
  readonly read: Effect.Effect<ReadonlySet<EnvironmentId>, ConnectionAttemptError>;
  /** Emits on subscribe and whenever any window may have changed the marks; read again then. */
  readonly changed: Stream.Stream<void>;
  readonly set: (
    environmentId: EnvironmentId,
    trusted: boolean,
  ) => Effect.Effect<void, ConnectionAttemptError>;
}>("@t3tools/client-runtime/connection/EnvironmentTrustMarks", {
  defaultValue: () => ({
    read: Effect.succeed(new Set<EnvironmentId>()),
    changed: Stream.never,
    set: (_environmentId, trusted) =>
      trusted
        ? Effect.void
        : Effect.fail(
            new ConnectionBlockedError({
              reason: "unsupported",
              detail: "Marking an environment untrusted is unavailable on this client.",
            }),
          ),
  }),
}) {}
