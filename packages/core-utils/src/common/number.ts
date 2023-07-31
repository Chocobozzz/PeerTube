export function forceNumber (value: any) {
  return parseInt(value + '')
}

export function isOdd (num: number) {
  return (num % 2) !== 0
}

export function toEven (num: number) {
  if (isOdd(num)) return num + 1

  return num
}
