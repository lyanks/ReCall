// Run from frontend/: node scripts/make-icons.cjs (needs Playwright). Re-run after changing public/logo.svg.
// Renders public/logo.svg into the PNG icons (tab fallback, iPhone home screen, Android/PWA).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const svg = fs.readFileSync('public/logo.svg', 'utf8');
  fs.mkdirSync('public/icons', { recursive: true });
  const b = await chromium.launch();
  for (const [name, size, bleed] of [['icon-32', 32, 0], ['apple-touch-icon', 180, 1], ['icon-192', 192, 1], ['icon-512', 512, 1]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    // home-screen icons: square, the OS rounds the corners itself
    const s = bleed ? svg.replace(/rx="16"/, 'rx="0"') : svg;
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${s}`);
    await p.screenshot({ path: `public/icons/${name}.png`, omitBackground: true });
    await p.close();
  }
  await b.close();
})();
