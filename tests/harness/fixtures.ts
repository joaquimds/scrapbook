const _chatId = 12345;
let _updateId = 1000;
let _messageId = 1;

export function nextUpdateId(): number {
	return _updateId++;
}

interface TextUpdate {
	update_id: number;
	message: {
		message_id: number;
		chat: { id: number };
		text: string;
	};
}

interface PhotoUpdate {
	update_id: number;
	message: {
		message_id: number;
		chat: { id: number };
		photo: Array<{
			file_id: string;
			file_unique_id: string;
			width: number;
			height: number;
			file_size: number;
		}>;
		caption?: string;
		media_group_id?: string;
	};
}

export function textUpdate(text: string, chatId = _chatId): TextUpdate {
	return {
		update_id: nextUpdateId(),
		message: {
			message_id: _messageId++,
			chat: { id: chatId },
			text,
		},
	};
}

interface DocumentUpdate {
	update_id: number;
	message: {
		message_id: number;
		chat: { id: number };
		document: {
			file_id: string;
			file_unique_id: string;
			mime_type?: string;
			file_name?: string;
			file_size?: number;
		};
		caption?: string;
	};
}

export function documentUpdate(opts?: {
	fileId?: string;
	mimeType?: string;
	caption?: string;
	chatId?: number;
}): DocumentUpdate {
	const fileId = opts?.fileId ?? `doc_${Math.random().toString(36).slice(2)}`;
	return {
		update_id: nextUpdateId(),
		message: {
			message_id: _messageId++,
			chat: { id: opts?.chatId ?? _chatId },
			document: {
				file_id: fileId,
				file_unique_id: fileId,
				mime_type: opts?.mimeType ?? "image/jpeg",
				file_name: "photo.jpg",
				file_size: 80000,
			},
			...(opts?.caption !== undefined ? { caption: opts.caption } : {}),
		},
	};
}

export function photoUpdate(opts?: {
	fileId?: string;
	caption?: string;
	mediaGroupId?: string;
	chatId?: number;
}): PhotoUpdate {
	const fileId = opts?.fileId ?? `file_${Math.random().toString(36).slice(2)}`;
	return {
		update_id: nextUpdateId(),
		message: {
			message_id: _messageId++,
			chat: { id: opts?.chatId ?? _chatId },
			photo: [
				{ file_id: fileId, file_unique_id: fileId, width: 100, height: 100, file_size: 10000 },
				{
					file_id: `${fileId}_lg`,
					file_unique_id: `${fileId}_lg`,
					width: 800,
					height: 800,
					file_size: 80000,
				},
			],
			...(opts?.caption !== undefined ? { caption: opts.caption } : {}),
			...(opts?.mediaGroupId ? { media_group_id: opts.mediaGroupId } : {}),
		},
	};
}
