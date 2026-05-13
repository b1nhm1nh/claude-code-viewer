import type { PublicSessionProcess } from "@ccv/shared/types/session-process";
import { atom } from "jotai";

export const sessionProcessesAtom = atom<PublicSessionProcess[]>([]);

/**
 * Tracks session IDs that were aborted by the user.
 * Used to suppress "Task completed" toast/sound on user-initiated abort.
 */
export const abortedByUserSessionIdsAtom = atom<Set<string>>(new Set<string>());
