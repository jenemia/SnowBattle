import { expect, test, type Page } from "@playwright/test";

test("solo sandbox supports movement and snowballs", async ({
  page
}) => {
  await page.goto("/solo");

  const viewport = page.getByTestId("solo-viewport");
  const position = page.getByTestId("solo-position");
  const projectiles = page.getByTestId("solo-projectiles");
  const cursor = page.getByTestId("solo-cursor");
  const preview = page.getByTestId("solo-preview");
  const status = page.getByTestId("solo-status");
  const timerBadge = page.getByTestId("solo-timer-badge");

  await expect(viewport).toBeVisible();
  await expect(status).toHaveText("Combat");
  await expect(timerBadge).toBeVisible();
  await expect(timerBadge).toContainText(/0[12]:[0-5]\d/);

  const box = await viewport.boundingBox();

  if (!box) {
    throw new Error("Viewport bounds unavailable");
  }

  const pointA = {
    x: box.x + box.width * 0.32,
    y: box.y + box.height * 0.64
  };
  const pointB = {
    x: box.x + box.width * 0.62,
    y: box.y + box.height * 0.56
  };

  const initialPosition = await position.textContent();
  await page.mouse.move(pointA.x, pointA.y);
  await page.keyboard.down("w");
  await expect
    .poll(async () => await position.textContent())
    .not.toBe(initialPosition);
  await page.keyboard.up("w");

  const projectileCountBefore = parseInt((await projectiles.textContent()) ?? "0", 10);
  await page.mouse.click(pointA.x, pointA.y);
  await expect
    .poll(async () => parseInt((await projectiles.textContent()) ?? "0", 10))
    .toBeGreaterThan(projectileCountBefore);

  await page.keyboard.press("1");
  await expect(status).toHaveText("Build");
  const placementPoint = await findValidPlacementPoint(page, box);
  await page.mouse.move(placementPoint.x, placementPoint.y);
  await expect.poll(async () => await cursor.textContent()).not.toBe("0.0 / 0.0");
  await expect(preview).toHaveText("valid");
  const structureCountBefore = parseInt((await page.getByTestId("solo-structures").textContent()) ?? "0", 10);
  await page.mouse.click(placementPoint.x, placementPoint.y);
  await expect(status).toHaveText("Combat");
  await expect
    .poll(
      async () =>
        parseInt((await page.getByTestId("solo-structures").textContent()) ?? "0", 10)
    )
    .toBeGreaterThan(structureCountBefore);
});

async function findValidPlacementPoint(
  page: Page,
  box: { x: number; y: number; width: number; height: number }
) {
  const preview = page.getByTestId("solo-preview");
  const columns = [0.45, 0.5, 0.55, 0.6, 0.65];
  const rows = [0.45, 0.5, 0.55, 0.6, 0.65];

  for (const row of rows) {
    for (const column of columns) {
      const point = {
        x: box.x + box.width * column,
        y: box.y + box.height * row
      };
      await page.mouse.move(point.x, point.y);

      if ((await preview.textContent()) === "valid") {
        return point;
      }
    }
  }

  throw new Error("Could not find a valid build placement point");
}
