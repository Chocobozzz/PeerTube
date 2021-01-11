import { Pipe, PipeTransform } from '@angular/core'

// Thanks: https://github.com/danrevah/ngx-pipes/blob/master/src/ng-pipes/pipes/math/bytes.ts

@Pipe({ name: 'myNumberFormatter' })
export class NumberFormatterPipe implements PipeTransform {
  private dictionary: Array<{max: number, type: string}> = [
    { max: 1000, type: '' },
    { max: 1000000, type: 'K' },
    { max: 1000000000, type: 'M' }
  ]

  /**
   * @param x number
   * @param n number of decimals to get (defaults to 1, needs to be >= 1)
   */
  static getDecimalForNumber (x: number, n = 1) {
    const v = x.toString().split('.')
    const f = v[1] || ''
    if (f.length > n) return +f.substr(0, n)
    return +f
  }

  transform (value: number) {
    const format = this.dictionary.find(d => value < d.max) || this.dictionary[this.dictionary.length - 1]
    const calc = value / (format.max / 1000)
    const integralPart = Math.floor(calc)
    const decimalPart = NumberFormatterPipe.getDecimalForNumber(calc)

    return integralPart < 10 && decimalPart > 0
      ? `${integralPart}.${decimalPart}${format.type}`
      : `${integralPart}${format.type}`
  }
}
