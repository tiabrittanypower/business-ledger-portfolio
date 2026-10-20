/**
 * Business Ledger — feed cards for Tue 13 – Sat 24 Oct 2026 (Powers Publication hub).
 * Same look as ../is-business-ledger-for-you.html. HTML → PNG (1080x1350) via the
 * Web Design Business Playwright. Run: PW_CHANNEL=chrome node generate-cards.mjs
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = require(
  path.resolve(__dirname, "../../../../Web Design Business/node_modules/playwright")
);

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const cards = [
  {
    file: "2026-10-13-money-in-out",
    tag: "How it works",
    headline: "Money in. Money out. Per business.",
    sub: "Log it once. See which hustle actually pays.",
    listTitle: "Three steps",
    items: [
      ["1", "Pick the business"],
      ["2", "Log the income or expense"],
      ["3", "See profit per business, or all together"],
    ],
    foot: "One-time buy · data stays on your PC",
  },
  {
    file: "2026-10-15-data-on-your-pc",
    tag: "Your data",
    headline: "Your books stay on your PC.",
    sub: "No account. No cloud login. Your backups, your call.",
    listTitle: "How it works",
    items: [
      ["✓", "No account to create"],
      ["✓", "Data stays in your browser, on your computer"],
      ["✓", "Export a backup as JSON or CSV anytime"],
      ["!", "Keep your backups somewhere safe"],
    ],
    foot: "Runs in Chrome or Edge",
  },
  {
    file: "2026-10-17-admin-checklists",
    tag: "Admin",
    headline: "The admin you keep forgetting.",
    sub: "Recurring checklists for each business. Set once, tick off.",
    listTitle: "For example",
    items: [
      ["☐", "Send this month's invoices"],
      ["☐", "File the receipts"],
      ["☐", "Export a backup"],
      ["☐", "Whatever your business needs"],
    ],
    foot: "Daily, weekly or monthly · per business",
  },
  {
    file: "2026-10-20-quotes-invoices",
    tag: "Quotes & invoices",
    headline: "Quotes and invoices, per business.",
    sub: "Right next to that business's money in and out.",
    listTitle: "In the same app",
    items: [
      ["✓", "Make a quote under the right business"],
      ["✓", "Make an invoice when the job is done"],
      ["✓", "Keep it with that business's books"],
      ["✓", "No separate invoicing subscription"],
    ],
    foot: "One-time buy · no monthly fee",
  },
  {
    file: "2026-10-22-tax-year-check",
    tag: "SA tax year",
    headline: "Seven months in. Quick check?",
    sub: "Tax year: 1 March – end February. March to September is done.",
    listTitle: "Check now, not in February",
    items: [
      ["☐", "Every income and expense logged"],
      ["☐", "Each one under the right business"],
      ["☐", "Receipts somewhere you can find them"],
    ],
    foot: "Reports follow the SA tax year by default",
  },
  {
    file: "2026-10-24-quick-answers",
    tag: "Quick answers",
    headline: "Business Ledger, answered.",
    sub: "The questions people ask before buying.",
    listTitle: "FAQ",
    items: [
      ["?", "How do I open it? Unzip, open index.html in Chrome or Edge"],
      ["?", "Account needed? No"],
      ["?", "Where's my data? On your PC. Export JSON or CSV backups"],
      ["?", "Monthly fee? None. One-time buy"],
    ],
    foot: "VAT yes/no is set in setup · it does not file with SARS",
  },
];

function card(c) {
  return `<section class="card" id="c-${c.file}">
  <div class="tag">${esc(c.tag)}</div>
  <h1>${esc(c.headline)}</h1>
  <p class="sub">${esc(c.sub)}</p>
  <div class="panel">
    <h2>${esc(c.listTitle)}</h2>
    <ul>${c.items
      .map(([ico, t]) => `<li><span class="ico">${esc(ico)}</span><span>${esc(t)}</span></li>`)
      .join("")}</ul>
    <div class="note">${esc(c.foot)}</div>
  </div>
  <div class="foot">
    <div class="brand">Business Ledger<small>by Powers Publication</small></div>
    <div class="disc">Helper only, not tax advice</div>
  </div>
</section>`;
}

const css = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0b1a3c;font-family:"Segoe UI","Poppins",Arial,sans-serif;color:#fff;padding:20px}
  .card{width:1080px;height:1350px;padding:84px 80px 72px;display:flex;flex-direction:column;margin-bottom:20px;
    background:linear-gradient(160deg,#0f2350 0%,#16377f 55%,#1f5fbf 100%)}
  .tag{align-self:flex-start;background:#f4c04e;color:#0f2350;font-weight:800;letter-spacing:4px;
    font-size:30px;padding:18px 28px;border-radius:14px;text-transform:uppercase}
  h1{margin-top:40px;font-size:92px;line-height:1.02;font-weight:900;font-style:italic;letter-spacing:-2px}
  .sub{margin-top:24px;font-size:36px;line-height:1.3;color:#cfe0ff}
  .panel{margin-top:52px;flex:1;background:#fff;color:#0f2350;border-radius:28px;padding:44px 44px 36px;
    display:flex;flex-direction:column}
  .panel h2{font-size:34px;font-weight:800;margin-bottom:18px}
  ul{list-style:none;flex:1;display:flex;flex-direction:column;justify-content:space-evenly}
  li{display:flex;align-items:center;gap:22px;font-size:34px;line-height:1.25;padding:14px 0;
    border-top:2px solid rgba(15,35,80,.1)}
  li:first-child{border-top:none}
  .ico{width:56px;height:56px;border-radius:50%;flex:none;display:inline-flex;align-items:center;justify-content:center;
    background:#1f5fbf;color:#fff;font-size:30px;font-weight:900}
  .note{margin-top:18px;align-self:flex-start;background:#eaf1ff;color:#16377f;font-weight:700;font-size:26px;
    padding:14px 22px;border-radius:14px}
  .foot{margin-top:44px;display:flex;justify-content:space-between;align-items:flex-end;font-size:28px;color:#cfe0ff}
  .brand{font-weight:800;color:#fff;font-size:34px}
  .brand small{display:block;font-weight:500;font-size:26px;color:#cfe0ff;margin-top:6px}
  .disc{text-align:right}
`;

async function main() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Business Ledger cards 13–24 Oct 2026</title>
<style>${css}</style></head><body>${cards.map(card).join("\n")}</body></html>`;
  const htmlPath = path.join(__dirname, "cards.html");
  fs.writeFileSync(htmlPath, html, "utf8");

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
  await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "load" });
  await page.waitForTimeout(800);
  for (const c of cards) {
    const out = path.join(__dirname, `${c.file}.png`);
    await page.locator(`#c-${c.file}`).screenshot({ path: out, type: "png" });
    console.log("Wrote", out);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
