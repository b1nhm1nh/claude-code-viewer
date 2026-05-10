import { describe, expect, test } from "vitest";
import { LastPromptEntrySchema } from "./LastPromptEntrySchema.ts";

describe("LastPromptEntrySchema", () => {
  test("accepts valid last-prompt entry", () => {
    const result = LastPromptEntrySchema.safeParse({
      type: "last-prompt",
      leafUuid: "a81b9919-b143-4c96-bd1a-163b0b9c835f",
      sessionId: "28fc793f-fbe6-4062-8b4a-3d6e28f65b8b",
    });
    expect(result.success).toBe(true);
    const data = result.success ? result.data : undefined;
    expect(data?.type).toBe("last-prompt");
    expect(data?.leafUuid).toBe("a81b9919-b143-4c96-bd1a-163b0b9c835f");
    expect(data?.sessionId).toBe("28fc793f-fbe6-4062-8b4a-3d6e28f65b8b");
  });

  test("rejects missing leafUuid", () => {
    const result = LastPromptEntrySchema.safeParse({
      type: "last-prompt",
      sessionId: "28fc793f-fbe6-4062-8b4a-3d6e28f65b8b",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing sessionId", () => {
    const result = LastPromptEntrySchema.safeParse({
      type: "last-prompt",
      leafUuid: "a81b9919-b143-4c96-bd1a-163b0b9c835f",
    });
    expect(result.success).toBe(false);
  });

  test("rejects wrong type literal", () => {
    const result = LastPromptEntrySchema.safeParse({
      type: "not-last-prompt",
      leafUuid: "a81b9919-b143-4c96-bd1a-163b0b9c835f",
      sessionId: "abc-123",
    });
    expect(result.success).toBe(false);
  });
  test("accepts real JSONL format with leafUuid", () => {
    const result = LastPromptEntrySchema.safeParse({
      type: "last-prompt",
      leafUuid: "a81b9919-b143-4c96-bd1a-163b0b9c835f",
      sessionId: "79023830-1658-4394-a666-05cd62934ea9",
    });
    expect(result.success).toBe(true);
    const data = result.success ? result.data : undefined;
    expect(data?.type).toBe("last-prompt");
    expect(data?.leafUuid).toBe("a81b9919-b143-4c96-bd1a-163b0b9c835f");
    expect(data?.sessionId).toBe("79023830-1658-4394-a666-05cd62934ea9");
  });
});
