import type { Conversation } from "../conversation-schema/index.ts";

export type ErrorJsonl = {
  type: "x-error";
  line: string;
  lineNumber: number;
};

export type ExtendedConversation = Conversation | ErrorJsonl;
