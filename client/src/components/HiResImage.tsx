import { type Component, createSignal, Show } from "solid-js";

export const HiResImage: Component<{
	thumbUrl: string | null;
	mediaUrl: string | null;
	alt: string;
	class: string;
	title?: string;
}> = (props) => {
	const [loaded, setLoaded] = createSignal(false);

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
					/>
				)}
			</Show>
			<Show when={props.mediaUrl}>
				{(m) => (
					<img
						class={`${props.class} photo-overlay${loaded() ? " loaded" : ""}`}
						src={m()}
						alt={props.alt}
						title={props.title}
						draggable={false}
						onLoad={() => setLoaded(true)}
					/>
				)}
			</Show>
		</div>
	);
};
