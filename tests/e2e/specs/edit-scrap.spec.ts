import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { signIn } from "~/tests/e2e/actions/sign-in.ts";
import { personNode, scrapNodeByPhoto } from "~/tests/e2e/locators.ts";

async function makePng(r: number, g: number, b: number, size: number): Promise<Buffer> {
	return await sharp({
		create: { width: size, height: size, channels: 3, background: { r, g, b } },
	})
		.png()
		.toBuffer();
}

test("edit scrap rewrites body, people, and photo, then deletes", async ({ page }) => {
	await signIn(page);

	// Create a scrap with body, an attached person (Eve), and a red photo.
	await page.getByRole("button", { name: "add" }).click();
	const createForm = page.locator(".scrap-form");
	await createForm.waitFor();
	await createForm.locator("#scrap-form-body").fill("edit-scrap first body");
	await createForm.getByPlaceholder("new person name").fill("Eve");
	await createForm.locator(".scrap-form-add-person button").click();
	await expect(createForm.locator(".scrap-form-people").getByText("Eve")).toBeVisible();
	await createForm.locator("#scrap-form-file").setInputFiles({
		name: "first.png",
		mimeType: "image/png",
		buffer: await makePng(220, 40, 40, 32),
	});
	await createForm.locator("button[type='submit']").click();
	await expect(createForm).toHaveCount(0);

	// The scrap node is identified by the body text on its photo's title attr.
	const scrapNode = scrapNodeByPhoto(page, "edit-scrap first body");
	await expect(scrapNode).toBeVisible();
	const scrapId = await scrapNode.getAttribute("data-id");
	expect(scrapId).toBeTruthy();

	const eveNode = personNode(page, "Eve");
	await expect(eveNode).toBeVisible();
	const eveId = await eveNode.getAttribute("data-id");
	await expect(page.locator(`line[data-source="${scrapId}"][data-target="${eveId}"]`)).toHaveCount(
		1,
	);

	// Open the edit form. Change body, swap people (uncheck Eve, add Frank),
	// and replace the photo with a different image.
	await scrapNode.click();
	const editForm = page.locator(".scrap-form");
	await editForm.waitFor();
	await expect(editForm.locator("#scrap-form-body")).toHaveValue("edit-scrap first body");

	await editForm.locator("#scrap-form-body").fill("edit-scrap second body");
	await editForm
		.locator(".scrap-form-people label")
		.filter({ hasText: "Eve" })
		.locator("input")
		.uncheck();
	await editForm.getByPlaceholder("new person name").fill("Frank");
	await editForm.locator(".scrap-form-add-person button").click();
	await expect(editForm.locator(".scrap-form-people").getByText("Frank")).toBeVisible();

	// Confirm the edit form acknowledges the existing image before we replace.
	await expect(editForm.getByText(/uploading replaces it/i)).toBeVisible();
	await editForm.locator("#scrap-form-file").setInputFiles({
		name: "second.png",
		mimeType: "image/png",
		buffer: await makePng(40, 80, 220, 64),
	});
	await editForm.locator("button[type='submit']").click();
	await expect(editForm).toHaveCount(0);

	// The same scrap node now matches by the new body title; edges go to Frank.
	const editedScrapNode = scrapNodeByPhoto(page, "edit-scrap second body");
	await expect(editedScrapNode).toBeVisible();
	await expect(editedScrapNode).toHaveAttribute("data-id", scrapId ?? "");

	const frankNode = personNode(page, "Frank");
	await expect(frankNode).toBeVisible();
	const frankId = await frankNode.getAttribute("data-id");
	await expect(
		page.locator(`line[data-source="${scrapId}"][data-target="${frankId}"]`),
	).toHaveCount(1);
	await expect(page.locator(`line[data-source="${scrapId}"][data-target="${eveId}"]`)).toHaveCount(
		0,
	);

	// Delete the scrap. People remain on the canvas (Eve was detached, Frank
	// was only attached via this scrap but the person row itself is untouched).
	await editedScrapNode.click();
	const deleteForm = page.locator(".scrap-form");
	await deleteForm.waitFor();
	page.once("dialog", (d) => void d.accept());
	await deleteForm.locator(".scrap-form-actions button").filter({ hasText: "Delete" }).click();
	await expect(page.locator(".scrap-form")).toHaveCount(0);

	await expect(editedScrapNode).toHaveCount(0);
	await expect(eveNode).toBeVisible();
	await expect(frankNode).toBeVisible();
});
