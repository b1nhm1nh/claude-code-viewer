import { ConversationSchema } from "../../lib/conversation-schema";
import type { ErrorJsonl } from "./types";

export const parseJsonl = (content: string) => {
  const lines = content
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "");

  return lines.map((line) => {
    const parsed = ConversationSchema.safeParse(JSON.parse(line));
    if (!parsed.success) {
      console.warn("Failed to parse jsonl, skipping", parsed.error);
      const errorData: ErrorJsonl = {
        type: "x-error",
        line,
      };
      return errorData;
    }

    return parsed.data;
  });
};
