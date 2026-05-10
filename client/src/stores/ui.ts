import { createSignal } from "solid-js";

export type EditingScrap = string | null | undefined;

const [editingScrapId, setEditingScrapId] = createSignal<EditingScrap>(undefined);

export { editingScrapId, setEditingScrapId };
