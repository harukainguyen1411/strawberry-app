# MyApps

A personal multi-app platform. Each app is a self-contained tool for tracking and managing aspects of daily life. Hosted on Firebase, built with Vue 3.

## Apps

### Read Tracker (fully built)

Tracks daily reading time with book management and goal setting.

**Features:**
- Reading session logging (date, start/end time, book selection)
- Dashboard with stats: today/week/month/year totals, daily averages, reading streaks
- Charts: line chart for trends, bar chart for daily breakdown, average trends
- Books management: add/edit/delete books, status tracking (reading/completed/want to read), per-book session history
- Goals: set daily/weekly/monthly/yearly reading targets with progress indicators
- Stats page with detailed breakdowns

**What's missing / known gaps:**
- No timer-based session entry (manual only)
- No reading reminders or notifications
- No book cover images (text-only book entries)
- No data export/import
- Charts could use more interactivity (no drill-down, no date range picker)
- No social/sharing features

### Portfolio Tracker (partially built)

Tracks stock holdings and investment performance.

**Features:**
- Holdings dashboard with current positions
- Transaction logging (buy/sell)
- Account-level settings
- Stock price fetching (via external API)

**What's missing / known gaps:**
- No historical performance charts
- No profit/loss calculations displayed
- No dividend tracking
- No multi-currency support
- No portfolio allocation visualization

### Task List (partially built)

Weekly task board with drag-and-drop.

**Features:**
- Week grid view with day columns
- Task cards with status and priority
- Drag-and-drop between days
- Undo support for deletions and status changes

**What's missing / known gaps:**
- No recurring tasks
- No categories or labels
- No task search or filtering
- No calendar integration

## Platform Features (shared)

- Google authentication via Firebase
- Local mode: works without login using localStorage (auto-enables when not authenticated)
- Data sync: localStorage to Firestore when signing in, with conflict resolution modal
- i18n support (internationalization infrastructure in place)
- Mobile-responsive design with touch-friendly interactions
- Per-app settings pages

## Tech Stack

- Vue 3 (Composition API) + TypeScript
- Pinia (state management)
- Tailwind CSS
- Chart.js + vue-chartjs
- Firebase (Auth, Firestore, Hosting)
- Vite

## Architecture Notes

- Each app lives under `src/views/<AppName>/` with its own layout component
- Stores are per-domain: `books.ts`, `goals.ts`, `readingSessions.ts`, `portfolio.ts`, `taskList.ts`
- All stores support dual backends: Firebase (authenticated) and localStorage (local mode)
- Routing uses nested routes with a shared auth guard
- Components are organized by app under `src/components/<AppName>/`

## What Contributions Are Welcome

- Bug fixes in any app
- UI/UX improvements (especially mobile experience)
- New features for existing apps (see "missing/known gaps" above)
- Performance improvements
- Accessibility improvements
- New app ideas that fit the personal productivity theme
- Chart improvements and data visualization
- i18n translations

## Out of Scope

- Backend/server-side changes (Firebase-only architecture)
- Authentication providers other than Google
- Features requiring paid APIs or external services with costs
- Breaking changes to the data model without a migration plan
