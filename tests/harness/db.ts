import pg from "pg";

export async function truncateAll(): Promise<void> {
	const client = new pg.Client({
		connectionString: process.env.DATABASE_URL,
	});
	await client.connect();
	try {
		await client.query(`
			truncate scraps, people, ingestion_sessions, contact_log, reminders_sent
			restart identity cascade
		`);
	} finally {
		await client.end();
	}
}
