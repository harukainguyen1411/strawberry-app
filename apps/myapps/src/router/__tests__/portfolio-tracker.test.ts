import { describe, it, expect } from 'vitest'
import router from '@/router'

describe('portfolio-tracker routes in shell router', () => {
  const allRoutes = router.getRoutes()

  it('has /yourApps/portfolio-tracker route group with requiresAuth + appId meta', () => {
    const parent = allRoutes.find((r) => r.path === '/yourApps/portfolio-tracker')
    expect(parent).toBeDefined()
    expect(parent!.meta.requiresAuth).toBe(true)
    expect(parent!.meta.appId).toBe('portfolio-tracker')
  })

  it('has portfolio-tracker-dashboard child at the parent path', () => {
    const dashboard = allRoutes.find((r) => r.name === 'portfolio-tracker-dashboard')
    expect(dashboard).toBeDefined()
    expect(dashboard!.path).toBe('/yourApps/portfolio-tracker')
  })

  it('has portfolio-tracker-import child at /yourApps/portfolio-tracker/import', () => {
    const importRoute = allRoutes.find((r) => r.name === 'portfolio-tracker-import')
    expect(importRoute).toBeDefined()
    expect(importRoute!.path).toBe('/yourApps/portfolio-tracker/import')
  })

  it('has no portfolio-tracker-settings route in v0.2', () => {
    const settings = allRoutes.find((r) => r.name === 'portfolio-tracker-settings')
    expect(settings).toBeUndefined()
  })
})
