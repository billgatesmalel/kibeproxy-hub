const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // iPhone 12 dimensions
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    const filePath = path.resolve(__dirname, '..', 'store.html');
    const url = 'file:///' + filePath.replace(/\\/g, '/');

    console.log('Loading:', url);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Ensure body is ready
    await page.waitForTimeout(800);

    const outDir = path.resolve(__dirname, '..', 'screenshots');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    const outPath = path.join(outDir, 'store_mobile.png');

    await page.screenshot({ path: outPath, fullPage: true });
    console.log('Screenshot saved to', outPath);

    await browser.close();
  } catch (err) {
    console.error('Error taking screenshot:', err);
    process.exit(1);
  }
})();
