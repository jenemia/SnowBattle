import { expect, test } from "@playwright/test";

test("solo sandbox supports movement, snowballs, and wall placement", async ({
  page
}) => {
  await page.goto("/solo");

  const viewport = page.getByTestId("solo-viewport");
  const speed = page.getByTestId("solo-speed");
  const walls = page.getByTestId("solo-walls");
  const projectiles = page.getByTestId("solo-projectiles");
  const cursor = page.getByTestId("solo-cursor");
  const modeLabel = page.getByTestId("solo-mode-label");
  const modeState = page.getByTestId("solo-mode");

  await expect(viewport).toBeVisible();
  await expect(modeLabel).toHaveText("combat");

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

  await page.mouse.move(pointA.x, pointA.y);
  await page.keyboard.down("w");
  await expect.poll(async () => parseFloat((await speed.textContent()) ?? "0")).toBeGreaterThan(
    0.5
  );
  await page.keyboard.up("w");

  const projectileCountBefore = parseInt((await projectiles.textContent()) ?? "0", 10);
  await page.mouse.click(pointA.x, pointA.y);
  await expect.poll(async () => parseInt((await projectiles.textContent()) ?? "0", 10)).toBeGreaterThan(
    projectileCountBefore
  );

  await page.keyboard.press("1");
  await expect(modeLabel).toHaveText("build");
  await page.mouse.move(pointA.x, pointA.y);
  const cursorA = await cursor.textContent();
  await expect(modeState).toHaveText("Placement valid");
  await page.mouse.click(pointA.x, pointA.y);
  await expect(modeLabel).toHaveText("combat");
  await expect(walls).toHaveText("1");

  await page.keyboard.press("1");
  await expect(modeLabel).toHaveText("build");
  await page.mouse.move(pointB.x, pointB.y);
  await expect.poll(async () => await cursor.textContent()).not.toBe(cursorA);
  await expect(modeState).toHaveText("Placement valid");
  await page.mouse.click(pointB.x, pointB.y);
  await expect(walls).toHaveText("2");
  await expect(modeLabel).toHaveText("combat");
});
