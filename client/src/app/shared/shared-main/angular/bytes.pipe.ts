import { Pipe, PipeTransform } from '@angular/core'
import { getBytes } from '@root-helpers/bytes'

// Thanks: https://github.com/danrevah/ngx-pipes/blob/master/src/ng-pipes/pipes/math/bytes.ts

@Pipe({
  name: 'bytes',
  standalone: true
})
export class BytesPipe implements PipeTransform {

  transform (value: number, precision = 0): string | number {
    return getBytes(value, precision)
  }
}
