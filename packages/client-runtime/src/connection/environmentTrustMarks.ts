import type { EnvironmentId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import { ConnectionBlockedError, type ConnectionAttemptError } from "./model.ts";

/**
 * Environments this client must not let act on its own machine. Kept apart from the connection
 * catalog, like pull request grants, so a stale window's catalog save cannot clear a mark and
 * every window sees a change as it happens.
 */
export class EnvironmentTrustMarks extends Context.Reference<{
  /** The marked environments now, then after every change from any window. */
  readonly changes: Stream.Stream<ReadonlySet<EnvironmentId>>;
  readonly set: (
    environmentId: EnvironmentId,
    trusted: boolean,
  ) => Effect.Effect<void, ConnectionAttemptError>;
}>("@t3tools/client-runtime/connection/EnvironmentTrustMarks", {
  defaultValue: () => ({
    changes: Stream.succeed(new Set<EnvironmentId>()),
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
