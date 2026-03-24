// https://stackoverflow.com/a/7616484
export function generateNaiveHash (str: string) {
  let hash = 0

  if (!str) return hash

  for (const char of str) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash |= 0 // Constrain to 32bit integer
  }
  return hash
}
