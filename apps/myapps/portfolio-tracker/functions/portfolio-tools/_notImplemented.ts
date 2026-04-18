/**
 * NotImplementedError — thrown by v1+ stub handlers.
 * Honest about scope: the tool surface exists but these handlers are not
 * implemented in v0. They will be filled in per phase (v1, v2, etc.).
 */
export class NotImplementedError extends Error {
  constructor(phase = 'v1') {
    super(`not implemented — scheduled for ${phase}`)
    this.name = 'NotImplementedError'
  }
}

/**
 * notImplemented — returns a stub function that throws NotImplementedError.
 * Use this for all v1+ tools so the tool surface compiles with honest stubs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function notImplemented(phase = 'v1'): (...args: any[]) => never {
  return () => {
    throw new NotImplementedError(phase)
  }
}
