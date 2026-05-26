import { describe, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { render } from '@testing-library/vue'
import { renderWithProviders } from '@/test/utils'
import router from '@/router'
import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import Home from './Home.vue'

/**
 * Renders Home with an optional authenticated user email.
 * When userEmail is provided, the auth store's user is patched before mount.
 */
function mountHome(options?: { userEmail?: string }) {
  const pinia = createPinia()
  setActivePinia(pinia)

  if (options?.userEmail) {
    const authStore = useAuthStore()
    authStore.$patch({
      user: { email: options.userEmail } as never,
      loading: false,
      localMode: false
    })
  }

  return render(Home, {
    global: {
      plugins: [pinia, router, i18n]
    }
  })
}

describe('Home', () => {
  it('renders welcome heading', async () => {
    const { findByRole } = renderWithProviders(Home)
    const heading = await findByRole('heading', { level: 1 })
    expect(heading).toBeDefined()
  })

  it('shows app cards when not loading', async () => {
    const { findByText, queryByText } = renderWithProviders(Home)
    const readTracker = await findByText(/Read Tracker/)
    const taskList = await findByText(/Task List/)
    expect(readTracker).toBeDefined()
    expect(taskList).toBeDefined()
    expect(queryByText(/loading/i)).toBeNull()
  })

  it('shows Open App buttons for each app', async () => {
    const { findAllByRole } = renderWithProviders(Home)
    const buttons = await findAllByRole('button', { name: /open app/i })
    expect(buttons.length).toBe(2)
  })

  it('shows the portfolio-tracker card for allowlisted users', async () => {
    const { findByText } = mountHome({ userEmail: 'harukainguyen1411@gmail.com' })
    const card = await findByText(/Portfolio Tracker/)
    expect(card).toBeDefined()
  })

  it('hides the portfolio-tracker card for non-allowlisted users', async () => {
    const { queryByText } = mountHome({ userEmail: 'random@example.com' })
    expect(queryByText(/Portfolio Tracker/)).toBeNull()
  })
})
