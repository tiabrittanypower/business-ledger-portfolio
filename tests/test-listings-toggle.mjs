/**
 * Business Ledger — Listings tab toggle (wizard default off, Settings on)
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    path.join(process.env.APPDATA || "", "npm", "node_modules", "playwright"),
    "playwright"
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      // try next
    }
  }

  throw new Error(
    "playwright not found — install it or set PLAYWRIGHT_PATH."
  );
}

const { chromium } = loadPlaywright();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const indexUrl = pathToFileURL(path.join(projectRoot, "index.html")).href;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function completeWizard(page, { enableListings = false } = {}) {
  await page.waitForFunction(
    () => document.querySelector("#setupWizard") && document.querySelector("#setupWizard").hidden === false,
    null,
    { timeout: 5000 }
  );
  await page.fill("#wizardWorkspaceName", "Listings Test Workspace");
  await page.fill("#wizardBizName", "Listings Biz");
  await page.click("#wizardAddBusiness");
  if (enableListings) {
    await page.check("#wizardShowListings");
  }
  await page.click("#wizardFinish");
  await page.waitForFunction(() => document.querySelector("#setupWizard")?.hidden === true, null, {
    timeout: 5000
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(indexUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("business-ledger-state");
    localStorage.removeItem("business-ledger-state-bak");
    localStorage.removeItem("business-ledger-demo");
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  await completeWizard(page, { enableListings: false });
  assert(
    (await page.locator('[data-view-link="assets"]').count()) === 0,
    "Listings nav should be hidden after wizard when checkbox unchecked"
  );
  const flagOff = await page.evaluate(() => state.settings.showListings);
  assert(flagOff === false, "showListings should be false");

  await page.locator('[data-view-link="settings"]').first().click();
  await page.waitForSelector("#settings.active", { timeout: 5000 });
  await page.selectOption("#showListingsSelect", "yes");
  await page.waitForFunction(() => state.settings.showListings === true, null, { timeout: 5000 });
  assert(
    (await page.locator('[data-view-link="assets"]').count()) === 1,
    "Listings nav should appear after enabling in Settings"
  );
  await page.locator('[data-view-link="assets"]').first().click();
  assert((await page.locator("#assets.active").count()) === 1, "assets view should activate");

  await page.locator('[data-view-link="settings"]').first().click();
  await page.waitForSelector("#settings.active", { timeout: 5000 });
  await page.selectOption("#showListingsSelect", "no");
  await page.waitForFunction(() => state.settings.showListings === false, null, { timeout: 5000 });
  assert(
    (await page.locator('[data-view-link="assets"]').count()) === 0,
    "Listings nav should hide again when disabled"
  );
  const view = await page.evaluate(() => currentView);
  assert(view !== "assets", "currentView should leave assets when listings disabled");

  // Fresh context: wizard with listings checked
  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.removeItem("business-ledger-state");
    localStorage.removeItem("business-ledger-state-bak");
    localStorage.removeItem("business-ledger-demo");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await completeWizard(page, { enableListings: true });
  assert(
    (await page.locator('[data-view-link="assets"]').count()) === 1,
    "Listings nav should show when wizard checkbox enabled"
  );
  const flagOn = await page.evaluate(() => state.settings.showListings);
  assert(flagOn === true, "showListings should be true after wizard checkbox");

  await browser.close();
  console.log("PASS: listings toggle (default hidden, settings + wizard)");
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
