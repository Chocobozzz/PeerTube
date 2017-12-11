import { Pipe, PipeTransform } from '@angular/core'

// Thanks: https://github.com/danrevah/ngx-pipes/blob/master/src/pipes/math/bytes.ts

@Pipe({ name: 'myNumberFormatter' })
export class NumberFormatterPipe implements PipeTransform {
  private dictionary: Array<{max: number, type: string}> = [
    { max: 1000, type: '' },
    { max: 1000000, type: 'K' },
    { max: 1000000000, type: 'M' }
  ]

  transform (value: number) {
    const format = this.dictionary.find(d => value < d.max) || this.dictionary[this.dictionary.length - 1]
    const calc = Math.floor(value / (format.max / 1000))

    return `${calc}${format.type}`
  }
}
