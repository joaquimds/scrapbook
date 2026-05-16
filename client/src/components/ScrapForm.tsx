import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
} from "solid-js";
import { Portal } from "solid-js/web";
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
		if (!sid) return props.defaultPeopleIds?.[0] ?? null;
		const ids = initial()?.peopleIds ?? [];
		for (const pid of ids) {
			if (peopleStore.byId[pid]?.featuredScrapId === sid) return pid;
		}
		return null;
	};
	const [featuredFor, setFeaturedFor] = createSignal<string | null>(initialFeaturedFor());
	const [file, setFile] = createSignal<File | null>(null);
	let fileInputRef: HTMLInputElement | undefined;

	const ACCEPTED_IMAGE_TYPES = new Set([
		"image/jpeg",
		"image/png",
		"image/webp",
		"image/gif",
	]);

	const previewUrl = createMemo<string | null>((prev) => {
		if (prev) URL.revokeObjectURL(prev);
		const f = file();
		return f ? URL.createObjectURL(f) : null;
	}, null);
	onCleanup(() => {
		const url = previewUrl();
		if (url) URL.revokeObjectURL(url);
	});

	function onPaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.kind !== "file") continue;
			if (!ACCEPTED_IMAGE_TYPES.has(item.type)) continue;
			const blob = item.getAsFile();
			if (!blob) continue;
			e.preventDefault();
			setFile(blob);
			return;
		}
	}

	function clearFile() {
		setFile(null);
		if (fileInputRef) fileInputRef.value = "";
	}

	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const [query, setQuery] = createSignal("");
	const [suggestionOpen, setSuggestionOpen] = createSignal(false);
	const [highlightIdx, setHighlightIdx] = createSignal(0);
	const [comboboxRect, setComboboxRect] = createSignal<{
		left: number;
		top: number;
		width: number;
	} | null>(null);
	let comboboxInputRef: HTMLInputElement | undefined;
	let blurTimer: ReturnType<typeof setTimeout> | undefined;

	function updateComboboxRect() {
		if (!comboboxInputRef) return;
		const r = comboboxInputRef.getBoundingClientRect();
		setComboboxRect({ left: r.left, top: r.bottom + 2, width: r.width });
	}

	function openSuggestions() {
		updateComboboxRect();
		setSuggestionOpen(true);
	}

	function onAnyScrollOrResize() {
		if (suggestionOpen()) updateComboboxRect();
	}

	if (typeof window !== "undefined") {
		window.addEventListener("scroll", onAnyScrollOrResize, true);
		window.addEventListener("resize", onAnyScrollOrResize);
		onCleanup(() => {
			window.removeEventListener("scroll", onAnyScrollOrResize, true);
			window.removeEventListener("resize", onAnyScrollOrResize);
		});
	}

	onCleanup(() => {
		if (blurTimer) clearTimeout(blurTimer);
	});

	const isEdit = () => Boolean(props.scrapId);

	const taggedPeople = createMemo(() =>
		peopleIds()
			.map((id) => peopleStore.byId[id])
			.filter((p): p is NonNullable<typeof p> => Boolean(p)),
	);

	createEffect(() => {
		// Re-anchor the dropdown when the chip row changes the input's position.
		taggedPeople();
		if (suggestionOpen()) updateComboboxRect();
	});

	const suggestions = createMemo(() => {
		const q = query().trim().toLowerCase();
		const taken = new Set(peopleIds());
		const all = peopleStore.ids
			.map((id) => peopleStore.byId[id])
			.filter((p): p is NonNullable<typeof p> => Boolean(p))
			.filter((p) => !taken.has(p.id));
		const filtered = q.length === 0 ? all : all.filter((p) => p.name.toLowerCase().includes(q));
		filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
		return filtered.slice(0, 20);
	});

	const exactMatch = createMemo(() => {
		const q = query().trim().toLowerCase();
		if (!q) return null;
		return suggestions().find((p) => p.name.toLowerCase() === q) ?? null;
	});

	function addPersonId(id: string) {
		setPeopleIds((curr) => (curr.includes(id) ? curr : [...curr, id]));
	}

	function removePersonId(id: string) {
		setPeopleIds((curr) => curr.filter((p) => p !== id));
		if (featuredFor() === id) setFeaturedFor(null);
	}

	function pickSuggestion(idx: number) {
		const list = suggestions();
		const p = list[idx];
		if (!p) return;
		addPersonId(p.id);
		setQuery("");
		setHighlightIdx(0);
	}

	async function createPersonFromQuery() {
		const name = query().trim();
		if (!name || busy()) return;
		setBusy(true);
		setError(null);
		try {
			const person = await createPerson(name);
			upsertPerson(person);
			addPersonId(person.id);
			setQuery("");
			setHighlightIdx(0);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to add person");
		} finally {
			setBusy(false);
		}
	}

	function onComboboxKeyDown(e: KeyboardEvent) {
		const list = suggestions();
		if (e.key === "ArrowDown") {
			e.preventDefault();
			openSuggestions();
			if (list.length > 0) setHighlightIdx((i) => (i + 1) % list.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (list.length > 0) setHighlightIdx((i) => (i - 1 + list.length) % list.length);
		} else if (e.key === "Enter") {
			if (query().trim().length === 0) return;
			e.preventDefault();
			const match = exactMatch();
			if (match) {
				addPersonId(match.id);
				setQuery("");
				setHighlightIdx(0);
				return;
			}
			const highlighted = list[highlightIdx()];
			if (highlighted) {
				addPersonId(highlighted.id);
				setQuery("");
				setHighlightIdx(0);
				return;
			}
			void createPersonFromQuery();
		} else if (e.key === "Escape") {
			if (suggestionOpen()) {
				e.preventDefault();
				setSuggestionOpen(false);
			}
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
			<form class="scrap-form" onSubmit={onSubmit} onPaste={onPaste}>
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
					ref={fileInputRef}
					class="scrap-form-input"
					type="file"
					accept="image/jpeg,image/png,image/webp,image/gif"
					onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
					disabled={busy()}
				/>
				<div class="scrap-form-hint">Or paste an image (⌘V).</div>
				<Show when={file()}>
					{(_) => {
						const f = file();
						const url = previewUrl();
						if (!f || !url) return null;
						return (
							<div class="scrap-form-file-preview">
								<img class="scrap-form-file-thumb" src={url} alt="" />
								<span class="scrap-form-file-name">{f.name || "Pasted image"}</span>
								<button
									type="button"
									class="scrap-form-button scrap-form-button--outline"
									onClick={clearFile}
									disabled={busy()}
								>
									Clear
								</button>
							</div>
						);
					}}
				</Show>
				<Show when={isEdit() && initial()?.thumbnailUrl}>
					<div class="scrap-form-hint">Has existing image — uploading replaces it.</div>
				</Show>

				<div class="scrap-form-label">People</div>
				<Show when={taggedPeople().length > 0}>
					<div class="scrap-form-chips">
						<For each={taggedPeople()}>
							{(p) => (
								<button
									type="button"
									class="scrap-form-chip"
									onClick={() => removePersonId(p.id)}
									disabled={busy()}
								>
									{p.name} <span aria-hidden="true">×</span>
								</button>
							)}
						</For>
					</div>
				</Show>
				<div class="scrap-form-combobox">
					<input
						ref={comboboxInputRef}
						class="scrap-form-input"
						type="text"
						placeholder="Find or add a person"
						value={query()}
						onInput={(e) => {
							setQuery(e.currentTarget.value);
							openSuggestions();
							setHighlightIdx(0);
						}}
						onFocus={() => openSuggestions()}
						onBlur={() => {
							blurTimer = setTimeout(() => setSuggestionOpen(false), 120);
						}}
						onKeyDown={onComboboxKeyDown}
						disabled={busy()}
					/>
					<Show when={suggestionOpen() && suggestions().length > 0 && comboboxRect()}>
						{(rect) => (
							<Portal>
								<div
									class="scrap-form-combobox-list"
									style={{
										left: `${rect().left}px`,
										top: `${rect().top}px`,
										width: `${rect().width}px`,
									}}
								>
									<For each={suggestions()}>
										{(p, i) => (
											<div
												class="scrap-form-combobox-row"
												aria-selected={i() === highlightIdx()}
												onMouseEnter={() => setHighlightIdx(i())}
												onMouseDown={(e) => {
													e.preventDefault();
													pickSuggestion(i());
												}}
											>
												{p.name}
											</div>
										)}
									</For>
								</div>
							</Portal>
						)}
					</Show>
				</div>

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
					disabled={busy() || taggedPeople().length === 0}
				>
					<option value="">(No-one)</option>
					<For each={taggedPeople()}>{(p) => <option value={p.id}>{p.name}</option>}</For>
				</select>

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
