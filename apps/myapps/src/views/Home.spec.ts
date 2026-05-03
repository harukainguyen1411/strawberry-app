import { describe, it, expect } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import Home from './Home.vue'

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
})
