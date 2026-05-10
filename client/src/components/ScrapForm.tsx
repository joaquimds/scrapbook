import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import {
	createPerson,
	createScrap,
	deleteScrap,
	updatePerson,
	updateScrap,
	uploadScrapMedia,
} from "~/client/src/api/services.ts";
import {
	detachFeaturedScrap,
	peopleStore,
	upsertPerson,
} from "~/client/src/stores/people.ts";
import { removeScrap, scrapsStore, upsertScrap } from "~/client/src/stores/scraps.ts";
import type { Scrap } from "~/shared/models/Scrap.ts";

interface ScrapFormProps {
	scrapId: string | null;
	onClose: () => void;
	defaultPeopleIds?: string[];
	onCreated?: (scrap: Scrap) => void;
}

export const ScrapForm: Component<ScrapFormProps> = (props) => {
	const initial = () => (props.scrapId ? scrapsStore.byId[props.scrapId] : undefined);

	const [body, setBody] = createSignal(initial()?.body ?? "");
	const [peopleIds, setPeopleIds] = createSignal<string[]>(
		initial()?.peopleIds ?? props.defaultPeopleIds ?? [],
	);
	const initialFeaturedFor = (): string | null => {
		const sid = props.scrapId;
		if (!sid) return null;
		const ids = initial()?.peopleIds ?? [];
		for (const pid of ids) {
			if (peopleStore.byId[pid]?.featuredScrapId === sid) return pid;
		}
		return null;
	};
	const [featuredFor, setFeaturedFor] = createSignal<string | null>(initialFeaturedFor());
	const [file, setFile] = createSignal<File | null>(null);
	const [newPersonName, setNewPersonName] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const isEdit = () => Boolean(props.scrapId);

	const taggedPeople = createMemo(() =>
		peopleIds()
			.map((id) => peopleStore.byId[id])
			.filter((p): p is NonNullable<typeof p> => Boolean(p)),
	);

	function togglePerson(id: string) {
		setPeopleIds((curr) => (curr.includes(id) ? curr.filter((p) => p !== id) : [...curr, id]));
		if (featuredFor() === id && !peopleIds().includes(id)) setFeaturedFor(null);
	}

	async function onAddPerson() {
		const name = newPersonName().trim();
		if (!name || busy()) return;
		setBusy(true);
		setError(null);
		try {
			const person = await createPerson(name);
			upsertPerson(person);
			setPeopleIds((curr) => [...curr, person.id]);
			setNewPersonName("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to add person");
		} finally {
			setBusy(false);
		}
	}

	async function applyFeaturedFor(scrapId: string) {
		const target = featuredFor();
		const tagged = peopleIds();
		for (const pid of tagged) {
			const p = peopleStore.byId[pid];
			if (!p) continue;
			if (pid === target && p.featuredScrapId !== scrapId) {
				const updated = await updatePerson(pid, { featuredScrapId: scrapId });
				upsertPerson(updated);
			} else if (pid !== target && p.featuredScrapId === scrapId) {
				const updated = await updatePerson(pid, { featuredScrapId: null });
				upsertPerson(updated);
			}
		}
	}

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (busy()) return;
		setBusy(true);
		setError(null);
		try {
			let scrap = initial();
			if (isEdit() && props.scrapId) {
				const existing = initial();
				const patch: { body?: string | null; peopleIds?: string[] } = {};
				const nextBody = body().length > 0 ? body() : null;
				if (existing?.body !== nextBody) patch.body = nextBody;
				const currIds = existing?.peopleIds ?? [];
				const nextIds = peopleIds();
				if (currIds.length !== nextIds.length || currIds.some((id) => !nextIds.includes(id))) {
					patch.peopleIds = nextIds;
				}
				if (Object.keys(patch).length > 0) {
					scrap = await updateScrap(props.scrapId, patch);
					upsertScrap(scrap);
				}
				const f = file();
				if (f) {
					scrap = await uploadScrapMedia(props.scrapId, f);
					upsertScrap(scrap);
				}
			} else {
				scrap = await createScrap({
					body: body().length > 0 ? body() : "",
					peopleIds: peopleIds(),
				});
				upsertScrap(scrap);
				const f = file();
				if (f) {
					scrap = await uploadScrapMedia(scrap.id, f);
					upsertScrap(scrap);
				}
				props.onCreated?.(scrap);
			}
			if (scrap) await applyFeaturedFor(scrap.id);
			props.onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Save failed");
		} finally {
			setBusy(false);
		}
	}

	async function onDelete() {
		if (busy()) return;
		const id = props.scrapId;
		if (!id) return;
		if (!confirm("Delete this scrap? This can't be undone.")) return;
		setBusy(true);
		setError(null);
		try {
			await deleteScrap(id);
			detachFeaturedScrap(id);
			removeScrap(id);
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
		// biome-ignore lint/a11y/noStaticElementInteractions: There is no appropriate element role here
		<div class="scrap-form-overlay" onClick={onOverlayClick}>
			<form class="scrap-form" onSubmit={onSubmit}>
				<div class="scrap-form-header">
					<span>{isEdit() ? "Edit scrap" : "New scrap"}</span>
					<button
						type="button"
						class="scrap-form-close"
						onClick={() => props.onClose()}
						disabled={busy()}
					>
						×
					</button>
				</div>

				<label class="scrap-form-label" for="scrap-form-body">
					Body
				</label>
				<textarea
					id="scrap-form-body"
					class="scrap-form-input scrap-form-textarea"
					value={body()}
					onInput={(e) => setBody(e.currentTarget.value)}
					disabled={busy()}
					rows={4}
				/>

				<label class="scrap-form-label" for="scrap-form-file">
					Image
				</label>
				<input
					id="scrap-form-file"
					class="scrap-form-input"
					type="file"
					accept="image/jpeg,image/png,image/webp,image/gif"
					onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
					disabled={busy()}
				/>
				<Show when={isEdit() && initial()?.thumbnailUrl}>
					<div class="scrap-form-hint">Has existing image — uploading replaces it.</div>
				</Show>

				<div class="scrap-form-label">People</div>
				<div class="scrap-form-people">
					<For each={peopleStore.ids}>
						{(id) => {
							const p = peopleStore.byId[id];
							if (!p) return null;
							const checked = () => peopleIds().includes(id);
							return (
								<label class="scrap-form-person">
									<input
										type="checkbox"
										checked={checked()}
										onChange={() => togglePerson(id)}
										disabled={busy()}
									/>
									{p.name}
								</label>
							);
						}}
					</For>
				</div>

				<div class="scrap-form-add-person">
					<input
						class="scrap-form-input"
						type="text"
						placeholder="New person name"
						value={newPersonName()}
						onInput={(e) => setNewPersonName(e.currentTarget.value)}
						disabled={busy()}
					/>
					<button
						type="button"
						class="scrap-form-button"
						onClick={() => void onAddPerson()}
						disabled={busy() || !newPersonName().trim()}
					>
						Add person
					</button>
				</div>

				<Show when={taggedPeople().length > 0}>
					<label class="scrap-form-label" for="scrap-form-featured-for">
						Featured scrap for
					</label>
					<select
						id="scrap-form-featured-for"
						class="scrap-form-input"
						value={featuredFor() ?? ""}
						onChange={(e) =>
							setFeaturedFor(e.currentTarget.value === "" ? null : e.currentTarget.value)
						}
						disabled={busy()}
					>
						<option value="">(No-one)</option>
						<For each={taggedPeople()}>{(p) => <option value={p.id}>{p.name}</option>}</For>
					</select>
				</Show>

				<div class="scrap-form-actions">
					<Show when={isEdit()}>
						<button
							type="button"
							class="scrap-form-button scrap-form-button--delete"
							onClick={() => void onDelete()}
							disabled={busy()}
						>
							Delete
						</button>
					</Show>
					<button type="submit" class="scrap-form-button" disabled={busy()}>
						{busy() ? "…" : isEdit() ? "Save" : "Create"}
					</button>
				</div>

				<Show when={error()}>
					<div class="scrap-form-error">{error()}</div>
				</Show>
			</form>
		</div>
	);
};
