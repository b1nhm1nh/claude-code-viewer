import type { Conversation } from "../../lib/conversation-schema";
import type { ParsedCommand } from "./parseCommandXml";

export type Project = {
  id: string;
  claudeProjectPath: string;
  meta: ProjectMeta;
};

export type ProjectMeta = {
  projectName: string | null;
  projectPath: string | null;
  lastModifiedAt: Date | null;
  sessionCount: number;
};

export type Session = {
  id: string;
  jsonlFilePath: string;
  meta: SessionMeta;
};

export type SessionMeta = {
  messageCount: number;
  firstCommand: ParsedCommand | null;
  lastModifiedAt: string | null;
};

export type ErrorJsonl = {
  type: "x-error";
  line: string;
};

export type SessionDetail = Session & {
  conversations: (Conversation | ErrorJsonl)[];
};
