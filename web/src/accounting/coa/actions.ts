import type { AccountDraft, InsertPosition } from "./types";

/** Every tree-level command the page can react to. */
export type TreeAction =
  | { kind: "view"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "create"; position: InsertPosition; preset?: Partial<AccountDraft> }
  | { kind: "move"; id: string }
  | { kind: "deactivate"; id: string }
  | { kind: "reactivate"; id: string }
  | { kind: "toggle"; id: string }
  | { kind: "setExpanded"; id: string; open: boolean };
