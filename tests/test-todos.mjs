/**
 * Note: product build uses setup wizard; seed empty then complete wizard or inject businesses before todo checks.
 *
 * Business Ledger - recurring to-do checklist smoke test
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
      // try next
    }
  }

  throw new Error("playwright not found");
}

const { chromium } = loadPlaywright();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexUrl = pathToFileURL(path.join(__dirname, "..", "index.html")).href;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(indexUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(150);

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#setupWizard")?.hidden === false, null, { timeout: 5000 });
  await page.fill("#wizardWorkspaceName", "Todo Test");
  for (const name of ["Test Bakery", "Test Studio"]) {
    await page.fill("#wizardBizName", name);
    await page.fill("#wizardBizType", "Test");
    await page.click("#wizardAddBusiness");
  }
  await page.click("#wizardFinish");
  await page.waitForFunction(() => document.querySelector("#setupWizard")?.hidden === true, null, { timeout: 5000 });
  const [bakeryId, studioId] = await page.evaluate(() => getBusinessList().map((b) => b.id));

  await page.locator('[data-view-link="todos"]').first().click();
  await page.waitForTimeout(80);
  assert((await page.locator("#todos.active").count()) === 1, "Checklists view not active");
  assert((await page.locator("#todoForm").count()) === 1, "todo form missing");
  assert((await page.locator(".todo-column").count()) === 3, "expected 3 cadence columns");

  for (const [text, cadence, businessId] of [
    ["Check bank balance", "daily", bakeryId],
    ["Export ledger backup", "weekly", "all"],
    ["Review listings", "monthly", studioId]
  ]) {
    await page.fill('#todoForm [name="text"]', text);
    await page.selectOption('#todoForm [name="cadence"]', cadence);
    await page.selectOption('#todoForm [name="businessId"]', businessId);
    await page.locator("#todoForm button.primary").click();
    await page.waitForTimeout(80);
  }

  const counts = await page.evaluate((ids) => ({
    total: state.todos.length,
    daily: state.todos.filter((t) => t.cadence === "daily").length,
    weekly: state.todos.filter((t) => t.cadence === "weekly").length,
    monthly: state.todos.filter((t) => t.cadence === "monthly").length,
    bakery: state.todos.filter((t) => t.businessId === ids.bakeryId).length,
    nsr: state.todos.filter((t) => t.businessId === ids.studioId).length
  }), { bakeryId, studioId });
  assert(counts.total === 3, "expected 3 todos, got " + counts.total);
  assert(counts.daily === 1 && counts.weekly === 1 && counts.monthly === 1, "cadence split wrong");
  assert(counts.bakery === 1 && counts.nsr === 1, "businessId not saved");

  const colored = await page.locator(`.todo-item[data-business='${bakeryId}']`).count();
  assert(colored === 1, "bakery task not colour-coded in list");
  const style = await page.locator(`.todo-item[data-business='${bakeryId}']`).getAttribute("style");
  assert(style && style.includes("--todo-color"), "missing business colour variable");

  await page.locator('.todo-column[data-cadence="daily"] [data-todo-toggle]').check();
  await page.waitForTimeout(80);

  const afterCheck = await page.evaluate(() => {
    const t = state.todos.find((x) => x.cadence === "daily");
    return {
      done: Boolean(t.completedPeriod),
      period: t.completedPeriod,
      completeFn: isTodoComplete(t)
    };
  });
  assert(afterCheck.done && afterCheck.completeFn, "daily todo not marked complete");
  assert(
    (await page.locator('.todo-column[data-cadence="daily"] .todo-item.is-done').count()) === 1,
    "done styling missing"
  );

  // Simulate yesterday complete - daily should reopen
  const reopened = await page.evaluate(() => {
    const t = state.todos.find((x) => x.cadence === "daily");
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    t.completedPeriod = y + "-" + m + "-" + day;
    saveState();
    renderTodos();
    return isTodoComplete(t);
  });
  assert(reopened === false, "daily should not stay done across days");

  const weekKeys = await page.evaluate(() => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return {
      thisWeek: todoPeriodKey("weekly", now),
      nextWeek: todoPeriodKey("weekly", nextWeek),
      thisMonth: todoPeriodKey("monthly", now)
    };
  });
  assert(weekKeys.thisWeek !== weekKeys.nextWeek, "weekly keys should change next week");
  assert(/^\d{4}-\d{2}$/.test(weekKeys.thisMonth), "monthly key shape");

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.click("#exportJson")
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  assert(Array.isArray(json.todos) && json.todos.length === 3, "export missing todos");

  page.once("dialog", (d) => d.accept());
  await page.locator('.todo-column[data-cadence="monthly"] [data-delete="todos"]').click();
  await page.waitForTimeout(80);
  assert((await page.evaluate(() => state.todos.length)) === 2, "delete failed");

  assert(errors.length === 0, "page errors: " + errors.join("; "));
  await browser.close();
  console.log("PASS: recurring to-dos checklist");
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exitCode = 1;
});
