import { type Component, createSignal, For, Show } from "solid-js";
import {
	createPerson,
	createScrap,
	updateScrap,
	uploadScrapMedia,
} from "~/client/src/api/services.ts";
import { peopleStore, upsertPerson } from "~/client/src/stores/people.ts";
import { scrapsStore, upsertScrap } from "~/client/src/stores/scraps.ts";
import { ScrapKindSchema } from "~/shared/models/Scrap.ts";

const KINDS = ScrapKindSchema.options;

interface ScrapFormProps {
	scrapId: string | null;
	onClose: () => void;
}

export const ScrapForm: Component<ScrapFormProps> = (props) => {
	const initial = () => (props.scrapId ? scrapsStore.byId[props.scrapId] : undefined);

	const [body, setBody] = createSignal(initial()?.body ?? "");
	const [kind, setKind] = createSignal<(typeof KINDS)[number]>(initial()?.kind ?? "quote");
	const [peopleIds, setPeopleIds] = createSignal<string[]>(initial()?.peopleIds ?? []);
	const [file, setFile] = createSignal<File | null>(null);
	const [newPersonName, setNewPersonName] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const isEdit = () => Boolean(props.scrapId);

	function togglePerson(id: string) {
		setPeopleIds((curr) => (curr.includes(id) ? curr.filter((p) => p !== id) : [...curr, id]));
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

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (busy()) return;
		setBusy(true);
		setError(null);
		try {
			let scrap = initial();
			if (isEdit() && props.scrapId) {
				const existing = initial();
				const patch: { body?: string | null; kind?: (typeof KINDS)[number]; peopleIds?: string[] } =
					{};
				const nextBody = body().length > 0 ? body() : null;
				if (existing?.body !== nextBody) patch.body = nextBody;
				if (existing?.kind !== kind()) patch.kind = kind();
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
					kind: kind(),
					body: body().length > 0 ? body() : "",
					peopleIds: peopleIds(),
				});
				upsertScrap(scrap);
				const f = file();
				if (f) {
					scrap = await uploadScrapMedia(scrap.id, f);
					upsertScrap(scrap);
				}
			}
			props.onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Save failed");
		} finally {
			setBusy(false);
		}
	}

	function onOverlayClick(e: MouseEvent) {
		if (busy()) return;
		if (e.target === e.currentTarget) props.onClose();
	}

	return (
		<div class="scrap-form-overlay" aria-hidden="true" onClick={onOverlayClick}>
			<form class="scrap-form" onSubmit={onSubmit}>
				<div class="scrap-form-header">
					<span>{isEdit() ? "edit scrap" : "new scrap"}</span>
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

				<label class="scrap-form-label" for="scrap-form-kind">
					Kind
				</label>
				<select
					id="scrap-form-kind"
					class="scrap-form-input"
					value={kind()}
					onChange={(e) => setKind(e.currentTarget.value as (typeof KINDS)[number])}
					disabled={busy()}
				>
					<For each={KINDS}>{(k) => <option value={k}>{k}</option>}</For>
				</select>

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
						placeholder="new person name"
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
						add person
					</button>
				</div>

				<div class="scrap-form-actions">
					<button type="submit" class="scrap-form-button" disabled={busy()}>
						{busy() ? "…" : isEdit() ? "save" : "create"}
					</button>
				</div>

				<Show when={error()}>
					<div class="scrap-form-error">{error()}</div>
				</Show>
			</form>
		</div>
	);
};
