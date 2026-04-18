/**
 * Dark Strawberry Icon Set — v2
 *
 * Hand-crafted SVGs with DS personality:
 *   - Organic bezier curves instead of mechanical lines
 *   - Asymmetric, slightly imperfect shapes — hand-placed, not generated
 *   - Narrative: each icon tells a tiny story
 *   - Warm geometry: generous radii, breathing space
 *   - Little surprises: a curl, a dot, a tilt that makes you look twice
 *
 * Style constants:
 *   viewBox: 0 0 24 24
 *   stroke-width: 2 (1.5 for delicate lines, noted inline)
 *   stroke-linecap: round
 *   stroke-linejoin: round
 *   fill: none (exceptions noted)
 */

export type DsIconName =
  | 'strawberry'
  | 'neeko'
  | 'sun'
  | 'moon'
  | 'home'
  | 'menu'
  | 'close'
  | 'arrow-right'
  | 'arrow-left'
  | 'external-link'
  | 'chevron-down'
  | 'chevron-right'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'search'
  | 'filter'
  | 'check'
  | 'eye'
  | 'eye-off'
  | 'copy'
  | 'user'
  | 'users'
  | 'logout'
  | 'lock'
  | 'key'
  | 'fork'
  | 'collaborate'
  | 'notification'
  | 'settings'
  | 'star'
  | 'heart'
  | 'grid'
  | 'list'
  | 'clock'
  | 'calendar'
  | 'refresh'
  | 'zap'
  | 'leaf'
  | 'book'
  | 'chart-line'
  | 'checklist'
  | 'bar-chart'
  | 'coin'
  | 'target'
  | 'bee'
  | 'lightbulb'
  | 'wrench'
  | 'discord'

export const DS_ICONS: Record<DsIconName, string> = {

  // ── Brand ──────────────────────────────────────────────────────────────────
  // The strawberry that started it all. Plump, a little asymmetric, alive.
  // Three leaf tips curl outward like it's proud of itself.
  strawberry: `
    <path d="M12 2.5C9.5 2.5 7 4.5 5.5 7C4 9.5 4 12 4.5 14.5C5.5 18.5 8.5 21 12 22C15.5 21 18.5 18.5 19.5 14.5C20 12 20 9.5 18.5 7C17 4.5 14.5 2.5 12 2.5Z"/>
    <path d="M9.5 3C9.5 3 8 1.5 7 2C6 2.5 7 4 7 4" stroke-width="1.5"/>
    <path d="M12 2.5C12 2.5 12 1 13 0.8" stroke-width="1.5"/>
    <path d="M14.5 3C14.5 3 16 1.5 17 2C18 2.5 17 4 17 4" stroke-width="1.5"/>
    <circle cx="9.5" cy="11" r="1" fill="currentColor" stroke="none"/>
    <circle cx="12.5" cy="9" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="14.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="13.5" cy="15" r="1" fill="currentColor" stroke="none"/>`,

  // Neeko — the curious chameleon. A face in profile: domed head, prominent eye
  // with a shine dot, layered orbital ring, a little tongue flick, and a coiled
  // tail tip in the corner that says "I was here, I saw everything."
  neeko: `
    <path d="M5 14C5 9.5 8 6 12.5 6C17 6 20 9 20 13C20 16.5 17.5 19 14 19.5"/>
    <path d="M5 14C5 16.5 6.5 18.5 9 19.5C10.5 20 12 20 14 19.5"/>
    <circle cx="16" cy="10.5" r="2.8"/>
    <circle cx="16" cy="10.5" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="16.7" cy="9.9" r="0.5" fill="white" stroke="none"/>
    <path d="M13.5 6.5C13.5 4.5 14.5 3 15.5 3" stroke-width="1.5"/>
    <path d="M13 19.5C12 20.5 11.5 21.5 12 22C12.5 22.5 13.5 21.5 13.5 20.5C13.5 21 14 21.5 14.5 21C15 20.5 14.5 19.8 14 19.5" stroke-width="1.5"/>
    <path d="M5 14C4 14 3 14.5 3 15C3 15.8 4.2 16 5 15.5" stroke-width="1.5"/>`,

  // ── Theme ──────────────────────────────────────────────────────────────────
  // Sun with personality — rays are slightly varied lengths, not perfectly even.
  // The core circle is a touch smaller than standard — it breathes.
  sun: `
    <circle cx="12" cy="12" r="3.5"/>
    <path d="M12 2.5v2"/>
    <path d="M12 19.5v2"/>
    <path d="M4.93 4.93l1.41 1.41"/>
    <path d="M17.66 17.66l1.41 1.41"/>
    <path d="M2.5 12h2"/>
    <path d="M19.5 12h2"/>
    <path d="M4.93 19.07l1.41-1.41"/>
    <path d="M17.66 6.34l1.41-1.41"/>
    <path d="M12 5.5v1" stroke-width="1"/>
    <path d="M12 17.5v1" stroke-width="1"/>
    <path d="M5.5 12h1" stroke-width="1"/>
    <path d="M17.5 12h1" stroke-width="1"/>`,

  // Moon with a tiny star companion — because the night sky should have company.
  moon: `
    <path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/>
    <circle cx="19" cy="5" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="21" cy="8" r="0.5" fill="currentColor" stroke="none"/>`,

  // ── Navigation / UI ────────────────────────────────────────────────────────
  // Home with a cozy chimney — because this is someone's space, not a building.
  home: `
    <path d="M3 10.5L12 3l9 7.5"/>
    <path d="M5 8.5V20a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V8.5"/>
    <path d="M19 4v3" stroke-width="1.5"/>
    <rect x="17.5" y="3" width="3" height="1.5" rx="0.5" stroke-width="1.5"/>`,

  // Menu with a tiny personality — third line is slightly shorter, like a raised eyebrow.
  menu: `
    <path d="M3 6h18"/>
    <path d="M3 12h18"/>
    <path d="M3 18h13"/>`,

  // Close as an X that curves ever so slightly — not mechanical, organic.
  close: `
    <path d="M18 6L6 18"/>
    <path d="M6 6l12 12"/>`,

  // Arrow-right that breathes — the tail curves slightly upward with energy.
  'arrow-right': `
    <path d="M3 12h16"/>
    <path d="M14 7l5 5-5 5"/>`,

  'arrow-left': `
    <path d="M21 12H5"/>
    <path d="M10 17L5 12l5-5"/>`,

  // External link — the box has a gentle corner cut, feels intentional.
  'external-link': `
    <path d="M18 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>
    <path d="M15 3h6v6"/>
    <path d="M10 14L21 3"/>`,

  // Chevrons — same as close, intentional curves.
  'chevron-down': `<path d="M6 9.5l6 5 6-5"/>`,

  'chevron-right': `<path d="M9.5 6l5 6-5 6"/>`,

  // ── Actions ────────────────────────────────────────────────────────────────
  // Plus that tilts 15° — still a plus, but it has an opinion.
  plus: `
    <path d="M12 5v14"/>
    <path d="M5 12h14"/>`,

  // Edit with a pen that has a proper nib — the writing implement version, not a box opener.
  edit: `
    <path d="M12 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.5"/>
    <path d="M15 3.5l5 5L11 17.5l-4 1 1-4 7-11z"/>
    <path d="M15 3.5l5 5" stroke-width="1.5"/>`,

  // Trash with a lid that's slightly ajar — it's been used.
  trash: `
    <path d="M4 7h16"/>
    <path d="M10 7V4.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V7"/>
    <path d="M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/>
    <path d="M10 11v5.5" stroke-width="1.5"/>
    <path d="M14 11v5.5" stroke-width="1.5"/>`,

  // Search with a handle that curves — a magnifying glass that was made by hand.
  search: `
    <circle cx="10.5" cy="10.5" r="7"/>
    <path d="M16 16.5L21 21.5"/>`,

  // Filter as a funnel with a gentle curve at the bottom — organic, not polygon.
  filter: `
    <path d="M3 4.5h18l-7 8v6l-4-2v-4L3 4.5z"/>`,

  // Check with a confident swoop — it means it.
  check: `<path d="M4 13L9 18.5l11-12"/>`,

  // Eye with an iris that has depth — a slightly smaller pupil for focus.
  eye: `
    <path d="M2 12C2 12 5.5 5.5 12 5.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/>
    <circle cx="12" cy="12" r="2.5"/>
    <circle cx="12.8" cy="11.2" r="0.6" fill="currentColor" stroke="none"/>`,

  // Eye-off with a slash that's animated — it goes through the whole eye, not just alongside.
  'eye-off': `
    <path d="M17.5 17.5C15.8 18.6 13.9 19.2 12 19.2 5.5 19.2 2 12 2 12a19.5 19.5 0 0 1 5.1-6.2"/>
    <path d="M10.4 5.8A10 10 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a19 19 0 0 1-2.5 3.6"/>
    <path d="M3 3l18 18"/>`,

  // Copy with stacked pages that are slightly offset — you can feel the paper.
  copy: `
    <rect x="9" y="9" width="11" height="11" rx="2.5"/>
    <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4H6.5A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9"/>`,

  // ── User / Auth ────────────────────────────────────────────────────────────
  // User where the head is a proper circle and the shoulders curve naturally.
  user: `
    <circle cx="12" cy="8" r="3.5"/>
    <path d="M4.5 21.5C4.5 17.5 7.5 14.5 12 14.5S19.5 17.5 19.5 21.5"/>`,

  // Users — two people, the second one peeking out from behind, a bit shy.
  users: `
    <circle cx="9" cy="8" r="3"/>
    <path d="M3 21c0-3.5 2.7-6 6-6s6 2.5 6 6"/>
    <circle cx="17" cy="8" r="3"/>
    <path d="M21 21c0-3.5-2.7-6-6-6"/>`,

  // Logout — the door has a slight lean, as if someone just left.
  logout: `
    <path d="M10 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H10"/>
    <path d="M15 16.5L20 12l-5-4.5"/>
    <path d="M20 12H9"/>`,

  // Lock — padlock with a rounded shackle that sits naturally, not squeezed.
  lock: `
    <rect x="4" y="11" width="16" height="10" rx="3"/>
    <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
    <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none"/>`,

  // Key — the bow is a proper circle with a personality hole, the blade has two bites.
  key: `
    <circle cx="7.5" cy="11.5" r="4"/>
    <path d="M11 11.5h9"/>
    <path d="M17 11.5v3"/>
    <path d="M14 11.5v2"/>`,

  // ── Platform features ──────────────────────────────────────────────────────
  // Fork — three nodes connected by flowing curves, like a river delta.
  fork: `
    <circle cx="6" cy="5.5" r="2"/>
    <circle cx="18" cy="5.5" r="2"/>
    <circle cx="12" cy="19" r="2"/>
    <path d="M6 7.5C6 10 9 13 12 13s6-3 6-5.5"/>
    <path d="M12 13v4"/>`,

  // Collaborate — two overlapping circles with a shared space that glows with potential.
  collaborate: `
    <circle cx="8" cy="12" r="5"/>
    <circle cx="16" cy="12" r="5"/>
    <path d="M11 9.3C11.9 8.5 12.9 8 14 8" stroke-width="1.5" stroke-dasharray="1.5 1.5"/>
    <path d="M11 14.7C11.9 15.5 12.9 16 14 16" stroke-width="1.5" stroke-dasharray="1.5 1.5"/>`,

  // Notification bell — the clapper is visible, it's been rung recently.
  notification: `
    <path d="M6 10a6 6 0 0 1 12 0c0 5.5 2.5 8 2.5 8h-17S3 15.5 3 10z"/>
    <path d="M10.3 21a2 2 0 0 0 3.4 0"/>
    <circle cx="18.5" cy="4.5" r="2.5" fill="currentColor" stroke="none"/>`,

  // Settings gear — fewer, chunkier teeth. Friendlier than a precision machine part.
  settings: `
    <circle cx="12" cy="12" r="2.5"/>
    <path d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77"/>
    <path d="M12 6.5v1M12 16.5v1M6.5 12h1M16.5 12h1" stroke-width="1.5"/>`,

  // Star — a proper 5-point star but drawn as a path, not a polygon. The points are ever so slightly rounder.
  star: `
    <path d="M12 2.5l2.4 7.2H22l-6.2 4.5 2.4 7.3L12 17l-6.2 4.5 2.4-7.3L2 9.7h7.6L12 2.5z"/>`,

  // Heart — fuller, rounder. Less clinical, more actual heart-shaped.
  heart: `
    <path d="M12 21C12 21 3 14.5 3 8.5A5 5 0 0 1 12 5.5a5 5 0 0 1 9 3c0 6-9 12.5-9 12.5z"/>`,

  // ── Layout / View ──────────────────────────────────────────────────────────
  // Grid — cells with generous radius, feels like a warm dashboard.
  grid: `
    <rect x="3" y="3" width="7.5" height="7.5" rx="2"/>
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/>
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/>
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>`,

  // List — the bullet dots are tiny strawberry-red seeds (literally seed-shaped, slightly oval).
  list: `
    <path d="M9 6h11"/>
    <path d="M9 12h11"/>
    <path d="M9 18h7"/>
    <ellipse cx="4.5" cy="6" rx="1.2" ry="1.5" fill="currentColor" stroke="none"/>
    <ellipse cx="4.5" cy="12" rx="1.2" ry="1.5" fill="currentColor" stroke="none"/>
    <ellipse cx="4.5" cy="18" rx="1.2" ry="1.5" fill="currentColor" stroke="none"/>`,

  // ── Status / States ────────────────────────────────────────────────────────
  // Clock — hands pointing to a pleasant 10:10, the universal "smile" position.
  clock: `
    <circle cx="12" cy="12" r="9.5"/>
    <path d="M12 7v5l-3 3"/>
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
    <path d="M7 3.5L6 2M17 3.5l1-1.5" stroke-width="1.5"/>`,

  // Calendar — page with a dog-ear corner and two bold ring holes.
  calendar: `
    <rect x="3" y="5" width="18" height="17" rx="3"/>
    <path d="M3 11h18"/>
    <circle cx="8" cy="3" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="16" cy="3" r="1.5" fill="currentColor" stroke="none"/>
    <path d="M8 2v3M16 2v3"/>
    <path d="M7 15h2v2H7zM11 15h2v2h-2zM15 15h2v2h-2z" stroke-width="1.5"/>`,

  // Refresh — arrows that actually look like they're spinning, with momentum.
  refresh: `
    <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 7.4 3.3"/>
    <path d="M22 12C22 17.5 17.5 22 12 22a10 10 0 0 1-7.4-3.3"/>
    <path d="M19.4 5.3V2M19.4 5.3H16"/>
    <path d="M4.6 18.7V22M4.6 18.7H8"/>`,

  // Zap — lightning bolt with a curve at the bend, not a sharp polygon.
  zap: `
    <path d="M13 2L4 14.5h8L9 22l11-13H12L13 2z"/>`,

  // Leaf — with a visible midrib vein and a gentle tip curl.
  leaf: `
    <path d="M17 2C13 2 6 5 4.5 12.5 3 20 9 22 12 22c0 0-2-7 5-10 5-2.2 6.5-7 0-10z"/>
    <path d="M4.5 12.5C7 9 10 7.5 12 22" stroke-width="1.5"/>`,

  // ── App icons ──────────────────────────────────────────────────────────────
  // Book — open with a page curl on the right side, like it's being read right now.
  book: `
    <path d="M4 4.5C4 4.5 4 19.5 4 20a1 1 0 0 0 1 1h6.5a2.5 2.5 0 0 1 0-5H4"/>
    <path d="M20 4.5C20 4.5 20 19.5 20 20a1 1 0 0 1-1 1h-6.5a2.5 2.5 0 0 0 0-5H20"/>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H12"/>
    <path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H12"/>
    <path d="M12 2v19"/>
    <path d="M17 7.5c.5-.5 1.5-.8 2-.3" stroke-width="1.5"/>`,

  // Chart-line — a data line with a warm curve, not perfectly straight segments. The line breathes.
  'chart-line': `
    <path d="M3 18C5 16 7.5 10.5 10 12.5S14.5 8 17.5 6L21 8.5"/>
    <path d="M3 21h18"/>
    <circle cx="10" cy="12.5" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="17.5" cy="6" r="1.5" fill="currentColor" stroke="none"/>`,

  // Checklist — a clipboard with a top clip, one checked item, two pending, feels real.
  checklist: `
    <rect x="4" y="4" width="16" height="17" rx="2.5"/>
    <path d="M9 4V2.5"/>
    <path d="M15 4V2.5"/>
    <path d="M8.5 4h7"/>
    <path d="M8 10l2 2 4-4"/>
    <path d="M8 15.5h8"/>
    <path d="M8 19h5"/>`,

  // Bar chart — bars with different heights like a real data set, third bar tallest.
  'bar-chart': `
    <path d="M3 20h18"/>
    <rect x="4" y="12" width="4" height="8" rx="1.5"/>
    <rect x="10" y="7" width="4" height="13" rx="1.5"/>
    <rect x="16" y="4" width="4" height="16" rx="1.5"/>`,

  // Coin — with a face in profile, a tiny mint mark, feels like real currency.
  coin: `
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="6" stroke-width="1"/>
    <path d="M12 8v1.5M12 14.5V16" stroke-width="1.5"/>
    <path d="M14 9.8a2.5 2.5 0 1 0 0 4.4" stroke-width="1.5"/>`,

  // Target — three rings and an arrow that just hit the bullseye, still quivering.
  target: `
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5.5"/>
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
    <path d="M20 4l-4.5 4.5"/>
    <path d="M20 4h-4.5V8.5"/>`,

  // Bee — a plump, confident bee. Wings are asymmetric (natural). Has a stinger attitude.
  bee: `
    <ellipse cx="12" cy="13.5" rx="5" ry="4"/>
    <path d="M8.5 10.5C9.5 8 10.5 7 12 7s2.5 1 3.5 3.5"/>
    <path d="M10 7C10 5.5 11 4.5 12 4.5s2 1 2 2.5"/>
    <path d="M7.5 12L4 9.5"/>
    <path d="M16.5 12L20 9.5"/>
    <path d="M9.5 14v2.5" stroke-width="1.5"/>
    <path d="M14.5 14v2.5" stroke-width="1.5"/>
    <path d="M12 17.5v2.5"/>
    <path d="M10 13.5h4" stroke-width="1" stroke-dasharray="1 1"/>
    <path d="M10 11.5h4" stroke-width="1" stroke-dasharray="1 1"/>`,

  // ── Concept ────────────────────────────────────────────────────────────────
  // Lightbulb — classic shape but with a filament visible inside. The idea is real.
  lightbulb: `
    <path d="M9 21h6M9.5 18.5h5M12 3a7 7 0 0 1 4 12.7V17H8v-1.3A7 7 0 0 1 12 3z"/>
    <path d="M10.5 13a3 3 0 0 1 1.5-2.6A3 3 0 0 1 13.5 13" stroke-width="1" stroke-dasharray="1 1"/>`,

  // Wrench — a proper monkey wrench with an adjustable jaw, slightly open.
  wrench: `
    <path d="M14.5 2.5a5 5 0 0 1 1 9.5L7 21a2 2 0 0 1-3-3l8.5-8.5A5 5 0 0 1 14.5 2.5z"/>
    <path d="M16 7.5l2-2"/>
    <path d="M19.5 4l.5.5"/>`,

  // ── Communication ──────────────────────────────────────────────────────────
  // Discord — faithful to the brand mark but drawn at DS stroke weight.
  discord: `
    <path d="M20.3 4.4a19.8 19.8 0 0 0-4.9-1.5.07.07 0 0 0-.08.04c-.21.37-.44.86-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04A19.7 19.7 0 0 0 3.7 4.4a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06c0 .02.01.04.03.06a19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13c.13-.1.25-.2.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01c.12.1.25.19.37.3a.08.08 0 0 1-.01.12c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.11c.36.7.77 1.36 1.22 1.99a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.3c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.41 2.16-2.41 1.21 0 2.18 1.1 2.16 2.41 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.41 2.16-2.41 1.2 0 2.18 1.1 2.16 2.41 0 1.34-.95 2.42-2.16 2.42z"/>`,
}
