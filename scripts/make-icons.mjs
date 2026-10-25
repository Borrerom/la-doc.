// Genera los íconos PNG de la PWA a partir de public/favicon.svg.
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/favicon.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [size, name, pad] of [
  [192, 'icon-192.png', 0],
  [512, 'icon-512.png', 0],
  [512, 'maskable-512.png', 64],
  [180, 'apple-touch-icon.png', 0],
]) {
  await page.setViewportSize({ width: size, height: size })
  const inner = size - pad * 2
  await page.setContent(
    `<body style="margin:0;background:#0f766e;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `) +
      '</body>',
  )
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: false })
}
await browser.close()
