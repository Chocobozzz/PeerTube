export function capitalizeFirstLetter (str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function randomString (length: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charsLength = chars.length
  const randomArray = new Uint8Array(length)

  let result = ''

  for (const v of crypto.getRandomValues(randomArray)) {
    result += chars[v % charsLength]
  }

  return result
}

export function splitAndGetNotEmpty (value: string) {
  return value
    .split('\n')
    .filter(line => line && line.length !== 0) // Eject empty lines
}
