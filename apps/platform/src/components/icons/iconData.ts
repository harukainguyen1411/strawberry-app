// Brand color palette for icon customization
export const brandColors = [
  { name: 'Strawberry', hex: '#e8614a' },
  { name: 'Deep Red', hex: '#c94a35' },
  { name: 'Accent Pink', hex: '#e040a0' },
  { name: 'Muted Purple', hex: '#8b5cf6' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Emerald', hex: '#10b981' },
] as const

// Curated icon categories for the picker
export const iconCategories: Record<string, string[]> = {
  'Productivity': [
    'check-square', 'list-todo', 'calendar', 'clock', 'timer', 'target',
    'clipboard-list', 'file-text', 'folder', 'inbox', 'kanban', 'layout-grid',
    'sticky-note', 'notebook-pen', 'pen-tool', 'pencil', 'bookmark', 'tag',
    'filter', 'search', 'bell', 'flag', 'pin', 'layers'
  ],
  'Finance': [
    'trending-up', 'trending-down', 'bar-chart-3', 'pie-chart', 'line-chart',
    'wallet', 'credit-card', 'banknote', 'coins', 'receipt', 'calculator',
    'percent', 'dollar-sign', 'euro', 'circle-dollar-sign', 'landmark',
    'arrow-up-right', 'arrow-down-right', 'scale', 'briefcase'
  ],
  'Health': [
    'heart', 'heart-pulse', 'activity', 'dumbbell', 'bike', 'footprints',
    'apple', 'salad', 'cup-soda', 'droplets', 'flame', 'moon', 'sun',
    'bed', 'brain', 'stethoscope', 'pill', 'thermometer', 'syringe', 'baby'
  ],
  'Social': [
    'users', 'user', 'user-plus', 'message-circle', 'message-square',
    'mail', 'at-sign', 'phone', 'video', 'share-2', 'link', 'globe',
    'thumbs-up', 'smile', 'party-popper', 'gift', 'cake', 'hand-heart'
  ],
  'Media': [
    'book-open', 'book', 'library', 'headphones', 'music', 'play-circle',
    'camera', 'image', 'film', 'tv', 'monitor', 'podcast', 'mic',
    'radio', 'newspaper', 'rss', 'youtube', 'twitch', 'gamepad-2', 'palette'
  ],
  'Dev': [
    'code', 'terminal', 'bug', 'git-branch', 'git-merge', 'database',
    'server', 'cloud', 'cpu', 'hard-drive', 'wifi', 'shield', 'lock',
    'key', 'settings', 'wrench', 'cog', 'zap', 'rocket', 'flask-conical'
  ],
  'Misc': [
    'home', 'star', 'sparkles', 'lightbulb', 'compass', 'map', 'navigation',
    'truck', 'plane', 'car', 'anchor', 'umbrella', 'mountain', 'tree-pine',
    'flower-2', 'cat', 'dog', 'paw-print', 'leaf', 'recycle'
  ]
}

// Default icon assignments for existing apps
export const defaultAppIcons: Record<string, { name: string; color: string }> = {
  'read-tracker': { name: 'book-open', color: '#e8614a' },
  'portfolio-tracker': { name: 'trending-up', color: '#10b981' },
  'task-list': { name: 'check-square', color: '#38bdf8' },
  'bee': { name: 'sparkles', color: '#f59e0b' }
}
