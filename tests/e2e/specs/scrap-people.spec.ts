import { expect, test } from "@playwright/test";
import { signIn } from "~/tests/e2e/actions/sign-in.ts";
import { personNode, scrapNodeByBody } from "~/tests/e2e/locators.ts";

test("scrap with two people renders edges to both", async ({ page }) => {
	// 1. Sign in as the pre-seeded credentialed user.
	await signIn(page);

	// 2. Open the scrap form.
	await page.getByRole("button", { name: "add" }).click();
	const form = page.locator(".scrap-form");
	await form.waitFor();

	// 3. Fill the body, then add two people inline. The form auto-checks each
	//    new person, so they're attached to the scrap on submit.
	await form.locator("#scrap-form-body").fill("a memorable moment");
	const personCombobox = form.locator(".scrap-form-combobox input");

	await personCombobox.fill("Alice");
	await personCombobox.press("Enter");
	await expect(form.locator(".scrap-form-chip").filter({ hasText: "Alice" })).toBeVisible();

	await personCombobox.fill("Bob");
	await personCombobox.press("Enter");
	await expect(form.locator(".scrap-form-chip").filter({ hasText: "Bob" })).toBeVisible();

	// 4. Submit. Form closes on success.
	await form.locator("button[type='submit']").click();
	await expect(form).toHaveCount(0);

	// 5. Resolve the rendered nodes by their visible content. The DB isn't reset
	//    between specs, so the locators in `tests/e2e/locators.ts` filter by the
	//    name span / body text — that doubles as a content assertion and avoids
	//    matching leakage from prior runs.
	const aliceNode = personNode(page, "Alice");
	const bobNode = personNode(page, "Bob");
	const scrapNode = scrapNodeByBody(page, "a memorable moment");

	await expect(aliceNode).toBeVisible();
	await expect(bobNode).toBeVisible();
	await expect(scrapNode).toBeVisible();

	const aliceId = await aliceNode.getAttribute("data-id");
	const bobId = await bobNode.getAttribute("data-id");
	const scrapId = await scrapNode.getAttribute("data-id");

	expect(aliceId).toBeTruthy();
	expect(bobId).toBeTruthy();
	expect(scrapId).toBeTruthy();

	// 6. Verify edges exist linking the scrap to each person. We don't assert
	//    on position — only that the SVG <line> elements with the right
	//    source/target attributes are in the DOM.
	await expect(
		page.locator(`line[data-source="${scrapId}"][data-target="${aliceId}"]`),
	).toHaveCount(1);
	await expect(page.locator(`line[data-source="${scrapId}"][data-target="${bobId}"]`)).toHaveCount(
		1,
	);
});
