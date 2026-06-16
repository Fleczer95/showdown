#!/usr/bin/env node
// Headless capture of iPhone 6.9" App Store screenshots (1320x2868).
// Assumes `yarn dev` is already running on http://localhost:3000.
// Drives system Chrome via puppeteer-core; no chromium download.

import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, ".."); // screenshot-generator dir
const OUT_BASE = resolve(ROOT, "out", "app-store", "iphone-6.9");

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const W = 1320;
const H = 2868;

const LOCALES = ["en", "pl"];
const SLIDES = ["home", "ladder", "drop", "wheel"];

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

      for (let i = 0; i < SLIDES.length; i++) {
        const slide = SLIDES[i];
        const url = `${BASE_URL}/raw/${locale}/${slide}`;
        process.stdout.write(`-> ${locale}/${slide} ... `);
        await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
        await page.waitForSelector('#capture-root[data-ready="1"]', {
          timeout: 30000,
        });
        await new Promise((r) => setTimeout(r, 500));

        const el = await page.$("#capture-root");
        if (!el) {
          console.log("MISS (no #capture-root)");
          continue;
        }
        const name = `${String(i + 1).padStart(2, "0")}-${slide}_${locale}.png`;
        const file = resolve(outDir, name);
        await el.screenshot({ path: file, type: "png", omitBackground: false });
        console.log(`saved ${name}`);
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
