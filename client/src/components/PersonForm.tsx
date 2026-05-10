import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import { deletePerson, updatePerson } from "~/client/src/api/services.ts";
import { ScrapForm } from "~/client/src/components/ScrapForm.tsx";
import { peopleStore, removePerson, upsertPerson } from "~/client/src/stores/people.ts";
import {
	detachPersonFromScraps,
	removeScrap,
	scrapsStore,
} from "~/client/src/stores/scraps.ts";

interface PersonFormProps {
	personId: string;
	onClose: () => void;
}

export const PersonForm: Component<PersonFormProps> = (props) => {
	const initial = () => peopleStore.byId[props.personId];

	const [name, setName] = createSignal(initial()?.name ?? "");
	const [featuredScrapId, setFeaturedScrapId] = createSignal<string | null>(
		initial()?.featuredScrapId ?? null,
	);
	const [creatingNewScrap, setCreatingNewScrap] = createSignal(false);
	const [editingScrapId, setEditingScrapId] = createSignal<string | null>(null);
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const personScraps = createMemo(() =>
		scrapsStore.ids
			.map((id) => scrapsStore.byId[id])
			.filter((s) => s?.peopleIds.includes(props.personId))
			.filter((s): s is NonNullable<typeof s> => s !== undefined),
	);

	function scrapLabel(s: { body: string | null }) {
		const trimmed = s.body?.trim();
		if (trimmed && trimmed.length > 0) {
			return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
		}
		return "(Untitled)";
	}

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (busy()) return;
		const existing = initial();
		if (!existing) return;
		setBusy(true);
		setError(null);
		try {
			const patch: { name?: string; featuredScrapId?: string | null } = {};
			const trimmedName = name().trim();
			if (trimmedName.length > 0 && trimmedName !== existing.name) {
				patch.name = trimmedName;
			}
			if ((existing.featuredScrapId ?? null) !== featuredScrapId()) {
				patch.featuredScrapId = featuredScrapId();
			}
			if (Object.keys(patch).length > 0) {
				const updated = await updatePerson(props.personId, patch);
				upsertPerson(updated);
			}
			props.onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Save failed");
		} finally {
			setBusy(false);
		}
	}

	async function onDelete() {
		if (busy()) return;
		const existing = initial();
		if (!existing) return;
		const confirmMsg = existing.featuredScrapId
			? `Delete ${existing.name}? Their featured scrap will also be deleted.`
			: `Delete ${existing.name}? Scraps will be kept.`;
		if (!confirm(confirmMsg)) return;
		setBusy(true);
		setError(null);
		try {
			const { deletedScrapIds } = await deletePerson(props.personId);
			for (const id of deletedScrapIds) removeScrap(id);
			detachPersonFromScraps(props.personId);
			removePerson(props.personId);
			props.onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Delete failed");
			setBusy(false);
		}
	}

	function onOverlayClick(e: MouseEvent) {
		if (busy()) return;
		if (e.target === e.currentTarget) props.onClose();
	}

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: There is no appropriate element role here */}
			<div class="scrap-form-overlay" onClick={onOverlayClick}>
				<form class="scrap-form" onSubmit={onSubmit}>
					<div class="scrap-form-header">
						<span>Edit person</span>
						<button
							type="button"
							class="scrap-form-close"
							onClick={() => props.onClose()}
							disabled={busy()}
						>
							×
						</button>
					</div>

					<label class="scrap-form-label" for="person-form-name">
						Name
					</label>
					<input
						id="person-form-name"
						class="scrap-form-input"
						type="text"
						value={name()}
						onInput={(e) => setName(e.currentTarget.value)}
						disabled={busy()}
					/>

					<label class="scrap-form-label" for="person-form-featured">
						Featured scrap
					</label>
					<select
						id="person-form-featured"
						class="scrap-form-input"
						value={featuredScrapId() ?? ""}
						onChange={(e) =>
							setFeaturedScrapId(e.currentTarget.value === "" ? null : e.currentTarget.value)
						}
						disabled={busy()}
					>
						<option value="">(None)</option>
						<For each={personScraps()}>{(s) => <option value={s.id}>{scrapLabel(s)}</option>}</For>
					</select>

					<div class="scrap-form-add-person">
						<button
							type="button"
							class="scrap-form-button"
							onClick={() => setCreatingNewScrap(true)}
							disabled={busy()}
						>
							Create new scrap
						</button>
						<Show when={featuredScrapId()}>
							<button
								type="button"
								class="scrap-form-button scrap-form-button--outline"
								onClick={() => setEditingScrapId(featuredScrapId())}
								disabled={busy()}
							>
								Edit featured scrap
							</button>
						</Show>
					</div>

					<div class="scrap-form-actions">
						<button
							type="button"
							class="scrap-form-button scrap-form-button--delete"
							onClick={() => void onDelete()}
							disabled={busy()}
						>
							Delete
						</button>
						<button type="submit" class="scrap-form-button" disabled={busy()}>
							{busy() ? "…" : "Save"}
						</button>
					</div>

					<Show when={error()}>
						<div class="scrap-form-error">{error()}</div>
					</Show>
				</form>
			</div>
			<Show when={creatingNewScrap()}>
				<ScrapForm
					scrapId={null}
					defaultPeopleIds={[props.personId]}
					onCreated={(s) => setFeaturedScrapId(s.id)}
					onClose={() => setCreatingNewScrap(false)}
				/>
			</Show>
			<Show when={editingScrapId()}>
				{(id) => <ScrapForm scrapId={id()} onClose={() => setEditingScrapId(null)} />}
			</Show>
		</>
	);
};
