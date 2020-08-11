import { Pipe, PipeTransform } from '@angular/core'

// Thanks: https://github.com/danrevah/ngx-pipes/blob/master/src/ng-pipes/pipes/math/bytes.ts

@Pipe({ name: 'bytes' })
export class BytesPipe implements PipeTransform {
  private dictionary: Array<{ max: number; type: string }> = [
    { max: 1024, type: 'B' },
    { max: 1048576, type: 'KB' },
    { max: 1073741824, type: 'MB' },
    { max: 1.0995116e12, type: 'GB' }
  ]

  transform (value: number, precision?: number | undefined): string | number {
    const format = this.dictionary.find(d => value < d.max) || this.dictionary[this.dictionary.length - 1]
    const calc = value / (format.max / 1024)

    const num = precision === undefined
      ? calc
      : applyPrecision(calc, precision)

    return `${num} ${format.type}`
  }
}

function applyPrecision (num: number, precision: number) {
  if (precision <= 0) {
    return Math.round(num)
  }

  const tho = 10 ** precision

  return Math.round(num * tho) / tho
}
