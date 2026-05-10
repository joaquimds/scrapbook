import type { Locator, Page } from "@playwright/test";

// Canvas-node locators. Always filter by visible content rather than the bare
// class — the e2e DB isn't reset between specs, so `.scrap-node` /
// `.person-node` alone will match leakage from prior runs. Filtering by the
// rendered name/body doubles as a content assertion.

export function personNode(page: Page, name: string): Locator {
	return page.locator(".person-node", {
		has: page.getByText(name, { exact: true }),
	});
}

// A scrap with media — body lives on the `.scrap-photo` `title` attribute.
export function scrapNodeByPhoto(page: Page, body: string): Locator {
	return page.locator(".scrap-node", {
		has: page.locator(`.scrap-photo[title="${body}"]`),
	});
}

// A scrap without media — body is rendered as visible text in `.scrap-card`.
export function scrapNodeByBody(page: Page, body: string): Locator {
	return page.locator(".scrap-node", { hasText: body });
}
