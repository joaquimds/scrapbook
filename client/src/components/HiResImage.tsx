import { type Component, createSignal, Show } from "solid-js";

export const HiResImage: Component<{
	thumbUrl: string | null;
	mediaUrl: string | null;
	alt: string;
	class: string;
	title?: string;
}> = (props) => {
	const [thumbSettled, setThumbSettled] = createSignal(false);
	const [hiResLoaded, setHiResLoaded] = createSignal(false);

	const canLoadHiRes = () => !props.thumbUrl || thumbSettled();

	return (
		<div class="photo-wrap">
			<Show when={props.thumbUrl}>
				{(t) => (
					<img
						class={props.class}
						src={t()}
						alt={props.alt}
						title={props.title}
						draggable={false}
						onLoad={() => setThumbSettled(true)}
						onError={() => setThumbSettled(true)}
					/>
				)}
			</Show>
			<Show when={canLoadHiRes() && props.mediaUrl}>
				{(m) => (
					<img
						class={`${props.class} photo-overlay${hiResLoaded() ? " loaded" : ""}`}
						src={m()}
						alt={props.alt}
						title={props.title}
						draggable={false}
						onLoad={() => setHiResLoaded(true)}
					/>
				)}
			</Show>
		</div>
	);
};
