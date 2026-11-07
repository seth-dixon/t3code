import { expect, it } from "vite-plus/test";

import { chatMarkdownClipboardPayload } from "./markdown-clipboard";

it("copies a selection that starts partway into an ordered list with the numbers shown", () => {
  using root = Object.assign(document.body.appendChild(document.createElement("div")), {
    [Symbol.dispose]: () => root.remove(),
  });
  root.innerHTML =
    '<ol start="4"><li>a</li><li value="8">b</li><li>c</li><li value="7">d</li></ol>' +
    "<ol><li>e\n<ol><li>f</li><li>g</li></ol></li></ol><p>after</p>";
  const [, , c, , , , g] = root.querySelectorAll("li");
  const selection = window.getSelection()!;

  const range = document.createRange();
  range.setStart(c!.firstChild!, 0);
  range.setEnd(root.querySelector("p")!.firstChild!, 5);
  selection.removeAllRanges();
  selection.addRange(range);
  expect(chatMarkdownClipboardPayload(selection)?.text).toBe(
    "9. c\n7. d\n\n1. e\n   1. f\n   2. g\n\nafter",
  );

  // Some selections start on the list itself, between its items.
  range.setStart(c!.parentElement!, 2);
  expect(chatMarkdownClipboardPayload(selection)?.text).toMatch(/^9\. c\n7\. d/);

  // The emptied outer item still copies its marker; the nested item keeps its own number.
  range.setStart(g!.firstChild!, 0);
  expect(chatMarkdownClipboardPayload(selection)?.text).toContain("2. g");
});
