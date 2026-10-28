import { sql } from "@codemirror/lang-sql";
import { linter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { expect, it, vi } from "vitest";
import "~/components/General/Table/SubMenus/utils";

const parserImported = vi.hoisted(() => vi.fn());
const validate = vi.hoisted(() => vi.fn(() => []));

vi.mock("dt-sql-parser", () => {
  parserImported();
  return {
    MySQL: class {
      validate = validate;
    },
  };
});

vi.mock("@codemirror/lint", () => ({ linter: vi.fn(() => []) }));

it("loads the parser when linting and preserves SQL diagnostics", async () => {
  expect(parserImported).not.toHaveBeenCalled();
  const source = vi.mocked(linter).mock.calls[0][0]!;
  const lint = (doc: string) =>
    source({ state: EditorState.create({ doc, extensions: [sql()] }) } as EditorView);

  expect(await lint("SELECT price FROM quotes")).toEqual([]);
  validate.mockReturnValueOnce([
    {
      startLine: 1,
      endLine: 1,
      startColumn: 1,
      endColumn: 7,
      message: "extraneous input SELECT",
    },
  ]);
  expect(await lint("SELECT FROM")).toEqual([
    expect.objectContaining({ message: "Invalid SQL syntax.", severity: "error" }),
  ]);
  expect(await lint("DELETE FROM quotes")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ message: "DELETE queries are not allowed." }),
    ]),
  );
  expect(parserImported).toHaveBeenCalledOnce();
});
