/**
 * Business Ledger readiness smoke test — wizard + core flows.
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    "playwright"
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      // try next path
    }
  }

  throw new Error(
    "playwright not found — install Playwright or set PLAYWRIGHT_PATH. Manual check: open index.html, complete wizard, add a money record, export/import backup."
  );
}

const { chromium } = loadPlaywright();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const indexUrl = pathToFileURL(path.join(projectRoot, "index.html")).href;

const failures = [];

function compact(text) {
  return String(text ?? "")
    .replace(/[\u00a0\u202f\u2009\u2007\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function check(name, cond, detail = "") {
  if (cond) {
    console.log("PASS: " + name);
    return;
  }
  const suffix = detail ? " (" + detail + ")" : "";
  console.log("FAIL: " + name + suffix);
  failures.push(detail ? name + ": " + detail : name);
}

async function completeWizard(page) {
  await page.waitForFunction(() => document.querySelector('#setupWizard') && document.querySelector('#setupWizard').hidden === false, null, { timeout: 5000 });
  await page.fill("#wizardWorkspaceName", "Smoke Workspace");
  await page.selectOption("#wizardCurrency", "ZAR");
  await page.selectOption("#wizardVat", "no");
  await page.fill("#wizardBizName", "Smoke Bakery");
  await page.fill("#wizardBizType", "Food");
  await page.click("#wizardAddBusiness");
  await page.waitForTimeout(50);
  await page.click("#wizardFinish");
  await page.waitForFunction(() => document.querySelector('#setupWizard')?.hidden === true, null, { timeout: 5000 });
}

async function main() {
  console.log("Business Ledger smoke readiness (product)");
  console.log("");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(indexUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("business-ledger-state");
    localStorage.removeItem("business-ledger-demo");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(200);

  check("loads without pageerror", pageErrors.length === 0, pageErrors.join("; "));
  check("title set", (await page.title()).includes("Business Ledger"));
  check("wizard visible on empty", (await page.locator("#setupWizard:not([hidden])").count()) === 1);

  await completeWizard(page);

  check("dashboard active after wizard", (await page.locator("#dashboard.active").count()) === 1);
  check(
    "business filter has All + 1 business",
    (await page.locator("#businessFilter option").count()) === 2,
    "expected 2 options"
  );
  check(
    "no personal seed assets",
    (await page.evaluate(() => (state.assets || []).filter((a) => String(a.id || "").startsWith("asset-nsr-")).length)) === 0
  );

  check(
    "listings tab hidden by default",
    (await page.locator('[data-view-link="assets"]').count()) === 0,
    "assets nav should be absent when showListings is false"
  );

  const views = [
    "transactions",
    "invoices",
    "reports",
    "settings",
    "quotes",
    "projects",
    "orders",
    "suppliers",
    "todos"
  ];
  for (const view of views) {
    await page.locator('[data-view-link="' + view + '"]').first().click();
    await page.waitForTimeout(50);
    check("view " + view, (await page.locator("#" + view + ".active").count()) === 1);
  }

  await page.locator('[data-view-link="transactions"]').first().click();
  const bizValue = await page.locator('#transactionForm [name="businessId"] option').nth(0).getAttribute("value");
  await page.selectOption('#transactionForm [name="businessId"]', bizValue);
  await page.selectOption('#transactionForm [name="type"]', "income");
  await page.fill('#transactionForm [name="amount"]', "245");
  await page.fill('#transactionForm [name="description"]', "Smoke test sale");
  const todayStr = new Date().toISOString().slice(0, 10);
  await page.fill('#transactionForm [name="date"]', todayStr);
  await page.selectOption('#transactionForm [name="category"]', "Product sales");
  await page.click("#transactionSubmit");
  await page.waitForTimeout(100);

  const txnCount = await page.evaluate(() => state.transactions.length);
  check("transaction saved", txnCount >= 1, "count=" + txnCount);

  await page.selectOption("#periodFilter", "all");
  await page.waitForTimeout(50);
  await page.locator('[data-view-link="dashboard"]').first().click();
  const incomeText = compact(await page.locator("#dashIncome").innerText());
  check("dashboard income updated", incomeText.includes("245") || /245/.test(incomeText), incomeText);

  await browser.close();

  console.log("");
  if (failures.length) {
    console.log("FAILED: " + failures.length);
    failures.forEach((f) => console.log(" - " + f));
    process.exit(1);
  }
  console.log("All smoke checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
