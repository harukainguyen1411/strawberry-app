/**
 * Parses the strawberry-meta HTML comment block from a GitHub issue or PR body.
 *
 * Expected block format (must be last block in body):
 * <!-- strawberry-meta
 * key: value
 * key2: value2
 * -->
 */

const META_REGEX = /<!-- strawberry-meta\n([\s\S]*?)\n-->/;

/**
 * Extracts the strawberry-meta block from a body string.
 * Returns a Record of key-value pairs, or null if no block is found.
 */
export function extractStrawberryMeta(
  body: string,
): Record<string, string> | null {
  const match = META_REGEX.exec(body);
  if (!match) return null;

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}
