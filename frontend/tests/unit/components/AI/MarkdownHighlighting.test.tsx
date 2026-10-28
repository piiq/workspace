import { render, waitFor } from "@testing-library/react";
import Markdown from "markdown-to-jsx";
import { expect, it, vi } from "vitest";
import {
  CodeComponent,
  MarkdownAIMessageOptions,
} from "~/components/AI/MarkdownOverrides";

const highlighter = vi.hoisted(() => ({
  imported: vi.fn(),
  create: vi.fn(),
  highlight: vi.fn((value: string) => ({
    type: "root",
    children: [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["syntax-token"] },
        children: [{ type: "text", value }],
      },
    ],
  })),
}));

vi.mock("@wooorm/starry-night", () => {
  highlighter.imported();
  return {
    common: [],
    createStarryNight: highlighter.create.mockResolvedValue({
      flagToScope: () => "source.js",
      highlight: highlighter.highlight,
    }),
  };
});

vi.mock("~/components/AI/Artifact", () => ({
  default: () => null,
  isSnowflakeArtifact: () => false,
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useShallowStreamingStore: (selector: (state: unknown) => unknown) =>
    selector({ streamingStatus: "idle" }),
}));

it("loads highlighting for code and shares initialization between code blocks", async () => {
  const { container, rerender } = render(
    <Markdown options={MarkdownAIMessageOptions}>Plain text</Markdown>,
  );
  expect(highlighter.imported).not.toHaveBeenCalled();

  rerender(
    <>
      <CodeComponent className="lang-js">const one = 1;</CodeComponent>
      <CodeComponent className="lang-js">const two = 2;</CodeComponent>
    </>,
  );
  await waitFor(() =>
    expect(container.querySelectorAll(".syntax-token")).toHaveLength(2),
  );
  expect(highlighter.imported).toHaveBeenCalledOnce();
  expect(highlighter.create).toHaveBeenCalledOnce();
  expect(container.textContent).toBe("const one = 1;const two = 2;");
});
