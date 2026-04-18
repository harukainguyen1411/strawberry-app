import type { RouteRecordRaw } from 'vue-router'
import type { DsIconName } from '@shared/ui/icons'

export interface AppManifest {
  id: string
  name: string
  description: string
  icon: DsIconName
  category: 'myApps' | 'yourApps'
  version: string
  routes: RouteRecordRaw[]
  defaultSettings: {
    collaboration: boolean
    forkable: boolean
    personalMode: boolean
  }
}
