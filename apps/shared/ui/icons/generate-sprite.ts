/**
 * Generates the DS icon SVG sprite sheet.
 * Run: npx tsx generate-sprite.ts > ds-icons.sprite.svg
 *
 * The sprite is included once in the page <body> (hidden), then referenced via:
 *   <svg><use href="#ds-icon-sun"/></svg>
 */

import { DS_ICONS, type DsIconName } from './icons'

const symbols = (Object.entries(DS_ICONS) as [DsIconName, string][])
  .map(([name, content]) => `  <symbol id="ds-icon-${name}" viewBox="0 0 24 24">${content.trim()}</symbol>`)
  .join('\n')

const sprite = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Dark Strawberry Icon Sprite
  Generated from apps/shared/ui/icons/icons.ts
  Run: npx tsx generate-sprite.ts > ds-icons.sprite.svg

  Usage in HTML:
    1. Include this file once (hidden) in <body>:
       <div style="display:none" aria-hidden="true">
         <!-- sprite contents pasted here -->
       </div>

    2. Reference an icon:
       <svg width="24" height="24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <use href="#ds-icon-sun"/>
       </svg>

  Style: 24×24 viewBox, 2px stroke, round caps/joins
-->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
${symbols}
</svg>
`

process.stdout.write(sprite)
