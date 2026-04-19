import { describe, it } from 'vitest'

// V0.1 bootstrap tests — verifies firebase project config files are in place.
// Run via: firebase emulators:exec --only firestore "npx vitest run functions/__tests__/emulator-boot.test.ts"

describe('V0.1 — Firebase project bootstrap', () => {
  it('firebase.json exists at apps/myapps/portfolio-tracker/', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const dir = path.resolve(__dirname, '../..')
    const exists = fs.existsSync(path.join(dir, 'firebase.json'))
    if (!exists) throw new Error('firebase.json not found at portfolio-tracker root')
  })

  it('.firebaserc exists and references myapps-b31ea', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const dir = path.resolve(__dirname, '../..')
    const rcPath = path.join(dir, '.firebaserc')
    if (!fs.existsSync(rcPath)) throw new Error('.firebaserc not found')
    const rc = JSON.parse(fs.readFileSync(rcPath, 'utf-8'))
    if (rc.projects?.default !== 'myapps-b31ea') {
      throw new Error(`expected project myapps-b31ea, got ${rc.projects?.default}`)
    }
  })

  it('firestore.rules is a deny-all stub (no allow read/write: if true)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const dir = path.resolve(__dirname, '../..')
    const rulesPath = path.join(dir, 'firestore.rules')
    if (!fs.existsSync(rulesPath)) throw new Error('firestore.rules not found')
    const rules = fs.readFileSync(rulesPath, 'utf-8')
    if (/allow\s+read.*if\s+true/.test(rules) || /allow\s+write.*if\s+true/.test(rules)) {
      throw new Error('firestore.rules contains an allow:if true — must be deny-all in v0')
    }
    if (!/allow read, write: if false/.test(rules) && !/allow read, write: if false;/.test(rules)) {
      throw new Error('firestore.rules does not contain deny-all rule')
    }
  })

  it('firestore.indexes.json exists and is empty (no composite indexes)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const dir = path.resolve(__dirname, '../..')
    const indexesPath = path.join(dir, 'firestore.indexes.json')
    if (!fs.existsSync(indexesPath)) throw new Error('firestore.indexes.json not found')
    const indexes = JSON.parse(fs.readFileSync(indexesPath, 'utf-8'))
    if (!Array.isArray(indexes.indexes) || indexes.indexes.length !== 0) {
      throw new Error('firestore.indexes.json should have empty indexes array at v0')
    }
  })

  it('storage.rules is a deny-all stub', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const dir = path.resolve(__dirname, '../..')
    const storageRulesPath = path.join(dir, 'storage.rules')
    if (!fs.existsSync(storageRulesPath)) throw new Error('storage.rules not found')
    const rules = fs.readFileSync(storageRulesPath, 'utf-8')
    if (!/allow read, write: if false/.test(rules)) {
      throw new Error('storage.rules must be deny-all at v0')
    }
  })
})
