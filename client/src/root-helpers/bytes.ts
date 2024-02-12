const dictionary: { max: number, type: string }[] = [
  { max: 1024, type: 'B' },
  { max: 1048576, type: 'KB' },
  { max: 1073741824, type: 'MB' },
  { max: 1.0995116e12, type: 'GB' },
  { max: 1.125899906842624e15, type: 'TB' }
]

function getBytes (value: number, precision?: number | undefined): string | number {
  const format = dictionary.find(d => value < d.max) || dictionary[dictionary.length - 1]
  const calc = value / (format.max / 1024)

  const num = precision === undefined
    ? calc
    : applyPrecision(calc, precision)

  return `${num} ${format.type}`
}

function applyPrecision (num: number, precision: number) {
  if (precision <= 0) {
    return Math.round(num)
  }

  const tho = 10 ** precision

  return Math.round(num * tho) / tho
}

export {
  getBytes
}
