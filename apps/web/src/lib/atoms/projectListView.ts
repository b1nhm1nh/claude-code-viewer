import { atomWithStorage } from "jotai/utils";

export type ProjectListView = "grid" | "list";

export const projectListViewAtom = atomWithStorage<ProjectListView>("projectListView", "grid");
