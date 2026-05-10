import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { signIn } from "~/tests/e2e/actions/sign-in.ts";
import { personNode, scrapNodeByBody, scrapNodeByPhoto } from "~/tests/e2e/locators.ts";

test("edit person renames and replaces featured photo with a new scrap", async ({ page }) => {
	await signIn(page);

	// Seed a person on the canvas via the scrap form (body + inline person).
	await page.getByRole("button", { name: "add" }).click();
	const scrapForm = page.locator(".scrap-form");
	await scrapForm.waitFor();
	await scrapForm.locator("#scrap-form-body").fill("edit-person seed scrap");
	await scrapForm.getByPlaceholder("new person name").fill("Carol");
	await scrapForm.locator(".scrap-form-add-person button").click();
	await expect(scrapForm.locator(".scrap-form-people").getByText("Carol")).toBeVisible();
	await scrapForm.locator("button[type='submit']").click();
	await expect(scrapForm).toHaveCount(0);

	const carolNode = personNode(page, "Carol");
	await expect(carolNode).toBeVisible();
	await expect(carolNode.locator(".person-photo")).toHaveCount(0);

	// Open the person form by clicking the node.
	await carolNode.click();
	const personForm = page.locator(".scrap-form").first();
	await personForm.waitFor();

	// Rename Carol → Caroline.
	const nameInput = personForm.locator("#person-form-name");
	await nameInput.fill("Caroline");

	// Open the nested scrap form to create a new scrap as the featured photo.
	await personForm.getByRole("button", { name: /create new scrap/i }).click();
	const newScrapForm = page.locator(".scrap-form").nth(1);
	await newScrapForm.waitFor();
	await newScrapForm.locator("#scrap-form-body").fill("edit-person featured photo");

	// Upload a real (in-memory) PNG so the server can generate a thumbnail.
	const pngBuffer = await sharp({
		create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 100, b: 50 } },
	})
		.png()
		.toBuffer();
	await newScrapForm.locator("#scrap-form-file").setInputFiles({
		name: "featured.png",
		mimeType: "image/png",
		buffer: pngBuffer,
	});

	await newScrapForm.locator("button[type='submit']").click();
	await expect(newScrapForm).toHaveCount(0);

	// The new scrap should now be selected as the featured scrap in PersonForm.
	const featuredSelect = personForm.locator("#person-form-featured");
	await expect(featuredSelect).not.toHaveValue("");

	// Save the person form.
	await personForm.locator("button[type='submit']").click();
	await expect(page.locator(".scrap-form")).toHaveCount(0);

	// Renamed label appears on the canvas; old name does not.
	const carolineNode = personNode(page, "Caroline");
	await expect(carolineNode).toBeVisible();
	await expect(personNode(page, "Carol")).toHaveCount(0);

	// The person node now renders a featured photo (HiResImage → .person-photo).
	await expect(carolineNode.locator(".person-photo").first()).toBeVisible();

	// The featured scrap is rendered inline on the person-node — it must NOT
	// appear as a standalone scrap-node.
	const orphanedFeatured = scrapNodeByPhoto(page, "edit-person featured photo");
	await expect(orphanedFeatured).toHaveCount(0);

	// Re-open the person form and delete Caroline. The confirm dialog should be
	// auto-accepted; deletion cascades to the featured scrap on the server.
	await carolineNode.click();
	const personFormForDelete = page.locator(".scrap-form").first();
	await personFormForDelete.waitFor();
	page.once("dialog", (d) => void d.accept());
	await personFormForDelete
		.locator(".scrap-form-actions button")
		.filter({ hasText: "Delete" })
		.click();
	await expect(page.locator(".scrap-form")).toHaveCount(0);

	// Caroline is gone; the seed scrap remains; the featured scrap was deleted
	// rather than left orphaned (would have shown up as a standalone node).
	await expect(personNode(page, "Caroline")).toHaveCount(0);
	await expect(scrapNodeByBody(page, "edit-person seed scrap")).toBeVisible();
	await expect(orphanedFeatured).toHaveCount(0);
});
