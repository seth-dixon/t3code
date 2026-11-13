import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";

import { render } from "../../test/render";

const trust = vi.hoisted(() => ({ trusted: true }));

vi.mock(import("../connection/environmentTrust"), async (original) => ({
  ...(await original()),
  useEnvironmentTrusted: () => trust.trusted,
  readEnvironmentTrusted: () => trust.trusted,
}));

import ChatMarkdown from "./ChatMarkdown";

const threadRef = {
  environmentId: EnvironmentId.make("linked"),
  threadId: ThreadId.make("thread"),
};

it.each([
  { trusted: true, name: "keeps an editor link from a trusted environment" },
  { trusted: false, name: "drops an editor link from an untrusted environment" },
])("$name", async ({ trusted }) => {
  trust.trusted = trusted;
  await using screen = await render(
    <ChatMarkdown
      cwd="/work"
      threadRef={threadRef}
      text="[Open file](vscode://file/home/me/notes.txt:3)"
    />,
  );
  const anchor = screen.container.querySelector('a[href^="vscode://"]');
  expect(anchor !== null).toBe(trusted);
  expect(screen.container.textContent).toContain("Open file");
});
