import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    appId?: string
    appCategory?: 'myApps' | 'yourApps'
  }
}
