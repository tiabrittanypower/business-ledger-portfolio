/**
 * Business Ledger — Export / Import backup feature test (Playwright)
 * Completes setup wizard, then verifies JSON download + round-trip import.
 */
import fs from "fs";
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
    "playwright not found — install it or set PLAYWRIGHT_PATH. Manual: wizard → Export backup → Import backup."
  );
}

const { chromium } = loadPlaywright();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const indexPath = path.join(projectRoot, "index.html");
const backupsDir = path.join(projectRoot, "backups");
const indexUrl = pathToFileURL(indexPath).href;

const EXPECTED_TOP_KEYS = [
  "transactions",
  "quotes",
  "invoices",
  "projects",
  "orders",
  "suppliers",
  "assets",
  "todos",
  "settings"
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function completeWizard(page) {
  await page.waitForFunction(() => document.querySelector('#setupWizard') && document.querySelector('#setupWizard').hidden === false, null, { timeout: 5000 });
  await page.fill("#wizardWorkspaceName", "Export Test Workspace");
  await page.fill("#wizardBizName", "Export Biz");
  await page.click("#wizardAddBusiness");
  await page.click("#wizardFinish");
  await page.waitForFunction(() => document.querySelector('#setupWizard')?.hidden === true, null, { timeout: 5000 });
}

async function main() {
  fs.mkdirSync(backupsDir, { recursive: true });
  assert(fs.existsSync(indexPath), "Missing " + indexPath);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(indexUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("business-ledger-state");
    localStorage.removeItem("business-ledger-demo");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await completeWizard(page);

  // Seed one transaction via evaluate for stable export payload
  await page.evaluate(() => {
    const bizId = Object.keys(state.settings.businesses)[0];
    state.transactions.push({
      id: "txn-export-test",
      businessId: bizId,
      type: "income",
      date: "2026-07-15",
      amount: 100,
      category: "Other income",
      method: "Test",
      description: "Export test row",
      attachment: null
    });
    saveState();
    render();
  });

  const exportBtn = page.locator("#exportJson");
  const importInput = page.locator("#importJson");
  assert((await exportBtn.count()) === 1, "Export backup button #exportJson missing");
  assert((await importInput.count()) === 1, "Import backup input #importJson missing");

  const stateBefore = await page.evaluate(() => state);
  assert(stateBefore && typeof stateBefore === "object", "App state not available after load");
  for (const key of EXPECTED_TOP_KEYS) {
    assert(key in stateBefore, "state missing key: " + key);
  }
  assert(stateBefore.settings.setupComplete === true, "setupComplete should be true after wizard");
  assert(Object.keys(stateBefore.settings.businesses || {}).length >= 1, "expected businesses after wizard");
  assert(stateBefore.settings.showListings === false, "showListings should default to false");

  // Enable listings then re-export path verifies setting persistence in state before download
  await page.evaluate(() => {
    state.settings.showListings = true;
    saveState();
  });
  const withListings = await page.evaluate(() => state.settings.showListings);
  assert(withListings === true, "showListings should flip to true in state");

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    exportBtn.click()
  ]);

  const suggested = download.suggestedFilename();
  assert(
    /^business-ledger-backup-\d{4}-\d{2}-\d{2}\.json$/.test(suggested),
    "Unexpected download filename: " + suggested
  );

  const dest = path.join(backupsDir, suggested);
  await download.saveAs(dest);
  const raw = fs.readFileSync(dest, "utf8");
  const parsed = JSON.parse(raw);
  for (const key of EXPECTED_TOP_KEYS) {
    assert(key in parsed, "export JSON missing key: " + key);
  }
  assert(parsed.transactions.some((t) => t.id === "txn-export-test"), "export missing seeded txn");
  assert(parsed.settings.showListings === true, "export JSON must include showListings true");

  // Clear and import
  await page.evaluate(() => {
    localStorage.removeItem("business-ledger-state");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  // After clear, wizard shows — import should restore
  await page.setInputFiles("#importJson", dest);
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => state);
  assert(after.transactions.some((t) => t.id === "txn-export-test"), "import did not restore txn");
  assert(after.settings.setupComplete === true, "import should mark setup complete");
  assert(Object.keys(after.settings.businesses).length >= 1, "import should restore businesses");
  assert(after.settings.showListings === true, "import should restore showListings=true");

  await browser.close();

  const resultPath = path.join(backupsDir, "EXPORT-TEST-RESULT.md");
  fs.writeFileSync(
    resultPath,
    [
      "# Export / import verification",
      "",
      "- Date: " + new Date().toISOString(),
      "- File: " + suggested,
      "- Result: PASS (wizard + export + import round-trip)",
      ""
    ].join("\n")
  );

  console.log("PASS: export/import round-trip");
  console.log("Saved:", dest);
  if (consoleErrors.length) {
    console.log("Page errors (non-fatal log):", consoleErrors.join(" | "));
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
