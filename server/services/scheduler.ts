import { Cron } from "croner";
import { runDailyReminder } from "~/server/app/reminders.ts";
import { env } from "~/server/env.ts";
import { logger } from "~/server/utils/logger.ts";

let job: Cron | undefined;

// Registers the daily reminder cron. Disabled when REMINDER_CRON="off" or
// running under NODE_ENV=test. Croner's `protect` flag drops overlapping
// ticks if a previous run is still in flight.
export function startScheduler(): void {
	if (env.NODE_ENV === "test" || env.REMINDER_CRON.toLowerCase() === "off") {
		logger.info({ reminderCron: env.REMINDER_CRON }, "scheduler disabled");
		return;
	}
	job = new Cron(env.REMINDER_CRON, { protect: true }, async () => {
		logger.info("scheduler tick: running daily reminder");
		try {
			await runDailyReminder();
		} catch (err) {
			logger.error({ err }, "daily reminder run failed");
		}
	});
	const next = job.nextRun();
	logger.info(
		{ cron: env.REMINDER_CRON, nextRun: next?.toISOString() ?? null },
		"scheduler started",
	);
}

export function stopScheduler(): void {
	job?.stop();
	job = undefined;
}
