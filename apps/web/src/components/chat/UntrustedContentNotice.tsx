import type { EnvironmentId } from "@t3tools/contracts";

import { useEnvironment } from "../../state/environments";

/** Stands in for a page an untrusted environment sent, whose scripts would run on this machine. */
export function UntrustedContentNotice(props: {
  readonly environmentId: EnvironmentId;
  readonly title: string;
}) {
  const label = useEnvironment(props.environmentId)?.label ?? "This environment";
  return (
    <p className="flex min-h-16 items-center justify-center rounded-md border border-dashed px-4 py-3 text-center text-muted-foreground text-xs">
      {props.title} isn&rsquo;t shown because {label} is marked untrusted.
    </p>
  );
}
