#!/usr/bin/env node
// Headless capture of Google Play phone screenshots (1440x2560) + feature graphic (1024x500).
// Assumes `yarn dev` is running on http://localhost:3000. Uses system Chrome via puppeteer-core.

import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_PHONE = resolve(ROOT, "out", "play-store", "phone");
const OUT_FEATURE = resolve(ROOT, "out", "play-store", "feature-graphic");

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const LOCALES = ["en", "pl"];
const SLIDES = ["home", "ladder", "drop", "wheel"];

async function shoot(page, url, w, h, file) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector('#capture-root[data-ready="1"]', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));
  const el = await page.$("#capture-root");
  if (!el) { console.log(`MISS ${url}`); return; }
  await el.screenshot({ path: file, type: "png" });
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });
  try {
    const page = await browser.newPage();
    // Phone screenshots
    for (const locale of LOCALES) {
      const outDir = resolve(OUT_PHONE, locale);
      await mkdir(outDir, { recursive: true });
      for (let i = 0; i < SLIDES.length; i++) {
        const slide = SLIDES[i];
        const name = `${String(i + 1).padStart(2, "0")}-${slide}_${locale}.png`;
        process.stdout.write(`-> phone ${locale}/${slide} ... `);
        await shoot(page, `${BASE_URL}/raw-play/phone/${locale}/${slide}`, 1440, 2560, resolve(outDir, name));
        console.log("saved " + name);
      }
    }
    // Feature graphic (1024x500)
    await mkdir(OUT_FEATURE, { recursive: true });
    for (const locale of LOCALES) {
      const name = `feature-graphic_${locale}.png`;
      process.stdout.write(`-> feature ${locale} ... `);
      await shoot(page, `${BASE_URL}/feature-graphic/${locale}`, 1024, 500, resolve(OUT_FEATURE, name));
      console.log("saved " + name);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
