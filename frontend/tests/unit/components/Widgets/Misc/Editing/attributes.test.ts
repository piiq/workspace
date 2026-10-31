import { mergeAttributes } from "@tiptap/core";
import { describe, expect, it } from "vitest";

describe("editor HTML attributes", () => {
  it("does not inherit executable attributes from an own __proto__ property", () => {
    const input = JSON.parse('{"__proto__":{"onerror":"alert(1)"},"alt":"Chart"}');
    const attributes = mergeAttributes(input, { class: "image" });

    expect(Object.getPrototypeOf(attributes)).toBe(Object.prototype);
    expect(attributes.onerror).toBeUndefined();
    expect(attributes.alt).toBe("Chart");
    expect(attributes.class).toBe("image");
  });
});
