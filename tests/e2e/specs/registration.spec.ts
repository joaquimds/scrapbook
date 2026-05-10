import { expect, test } from "@playwright/test";
import { STUB_PASSWORD, STUB_SETUP_TOKEN, STUB_USERNAME } from "~/tests/e2e/constants.ts";

// The setup token is single-use, so this spec is the only one allowed to
// exercise the registration flow. Other specs sign in via tests/e2e/harness/sign-in.ts.
test("registration via setup token sets a password and signs the user in", async ({ page }) => {
	await page.goto(`/setup?token=${STUB_SETUP_TOKEN}`);

	// Setup page resolves the token and reveals the username it belongs to.
	await expect(page.locator(".login-help")).toContainText(STUB_USERNAME);

	const passwordInput = page.locator("#setup-password");
	await passwordInput.fill(STUB_PASSWORD);
	await page.getByRole("button", { name: /set password/i }).click();

	// On success the app navigates to "/" and the canvas chrome appears.
	await expect(page.locator(".add-button")).toBeVisible();

	// Reload to confirm the session cookie persisted (i.e. we're really signed
	// in, not just routed).
	await page.reload();
	await expect(page.locator(".add-button")).toBeVisible();
});
