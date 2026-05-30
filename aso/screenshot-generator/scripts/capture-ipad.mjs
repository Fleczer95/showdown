#!/usr/bin/env node
// Headless capture of iPad App Store screenshots.
// Assumes `yarn dev` is already running on http://localhost:3000.
// Drives system Chrome via puppeteer-core; no chromium download.

import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const OUT_BASE = resolve(ROOT, "screenshots", "processed", "app-store", "ipad");

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const W = 2064;
const H = 2752;

const LOCALES = ["en", "pl"];
const SLIDES = [
  "01_home",
  "02_setup",
  "03_icebreaker",
  "04_would_you_rather",
  "05_forbidden_words",
  "06_letter_game",
  "07_5_seconds",
  "08_spy_reveal",
  "09_who_am_i",
  "10_results",
];

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      `--window-size=${W + 100},${H + 100}`,
      "--hide-scrollbars",
    ],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

    for (const locale of LOCALES) {
      const outDir = resolve(OUT_BASE, locale);
      await mkdir(outDir, { recursive: true });

      for (const slide of SLIDES) {
        const url = `${BASE_URL}/raw-ipad/${locale}/${slide}`;
        process.stdout.write(`→ ${locale}/${slide} ... `);
        await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
        await page.waitForSelector('#capture-root[data-ready="1"]', {
          timeout: 30000,
        });
        // Extra settle for fonts / paint.
        await new Promise((r) => setTimeout(r, 500));

        const el = await page.$("#capture-root");
        if (!el) {
          console.log("MISS (no #capture-root)");
          continue;
        }
        const file = resolve(outDir, `${slide}_${locale}.png`);
        await el.screenshot({ path: file, type: "png", omitBackground: false });
        console.log(`saved ${file}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
