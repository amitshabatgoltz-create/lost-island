// Converts Mixamo FBX characters into game skins (public/models/skins/<name>.glb).
// Usage (from the repo root, with `npm run dev -- --port 5199` running):
//   node tools/skins/convert.cjs Ch01 Ch02 ...      (reads tools/skins/fbx/<name>.fbx)
// Needs Playwright with Chromium, and @gltf-transform/cli (npx downloads it).
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '../../public/models/skins');
const TMP = path.join(__dirname, 'tmp');

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 640 } });
  for (const name of process.argv.slice(2)) {
    await page.goto(`http://localhost:5199/tools/skins/convert.html?export&m=${encodeURIComponent(name)}`);
    await page.waitForFunction(() => window.DONE, null, { timeout: 300000, polling: 500 });
    console.log(name, JSON.stringify(await page.evaluate(() => window.INFO)));
    await page.screenshot({ path: path.join(TMP, `${name}.png`) });
    const raw = path.join(TMP, `${name}.glb`);
    fs.writeFileSync(raw, Buffer.from(await page.evaluate(() => window.GLB), 'base64'));
    // meshopt geometry + 1024 px WebP textures: ~1 MB per character instead of 50+ MB
    execFileSync('npx', ['-y', '@gltf-transform/cli@4', 'optimize', raw, path.join(OUT, `${name.toLowerCase()}.glb`),
      '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024',
      '--simplify', 'false', '--join', 'false', '--instance', 'false', '--flatten', 'false'], { stdio: 'inherit' });
  }
  await browser.close();
})();
