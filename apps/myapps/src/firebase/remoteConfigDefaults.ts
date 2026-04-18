/**
 * Default values for Remote Config parameters.
 * These are used when Remote Config has not yet fetched or fetch fails.
 * Safe defaults: new/gated features default to OFF.
 */
export const remoteConfigDefaults: Record<string, boolean> = {
  bee_visible: false,
}
