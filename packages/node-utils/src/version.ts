/**
 * Parses a semantic version string into its separate components.
 * Fairly lax, and allows for missing or additional segments in the string.
 *
 * @param s String to parse semantic version from.
 * @returns Major, minor, and patch version, or null if string does not follow semantic version conventions.
 */
export function parseSemVersion (s: string) {
  const parsed = s.match(/v?(\d+)\.(\d+)(?:\.(\d+))?/i)

  if (!parsed) return null

  return {
    major: parseInt(parsed[1]),
    minor: parseInt(parsed[2]),
    patch: parsed[3] ? parseInt(parsed[3]) : 0
  }
}
