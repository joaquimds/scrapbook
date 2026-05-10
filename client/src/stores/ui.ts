import { createSignal } from "solid-js";

export type EditingScrap = string | null | undefined;
export type EditingPerson = string | undefined;

const [editingScrapId, setEditingScrapId] = createSignal<EditingScrap>(undefined);
const [editingPersonId, setEditingPersonId] = createSignal<EditingPerson>(undefined);

export { editingPersonId, editingScrapId, setEditingPersonId, setEditingScrapId };
