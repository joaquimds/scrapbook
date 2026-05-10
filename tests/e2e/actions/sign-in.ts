import type { Page } from "@playwright/test";
import { SIGNIN_PASSWORD, SIGNIN_USERNAME } from "~/tests/e2e/constants.ts";

// Drives the login page using the pre-seeded credentialed user. Every spec
// except the registration one should call this — the setup token is single-use.
export async function signIn(page: Page): Promise<void> {
	await page.goto("/login");
	await page.locator("#login-username").fill(SIGNIN_USERNAME);
	await page.locator("#login-password").fill(SIGNIN_PASSWORD);
	await page.locator("button.login-button").click();
	await page.locator(".add-button").waitFor();
}
