import { Pipe, PipeTransform } from '@angular/core'

@Pipe({ name: 'myObjectLength' })
export class ObjectLengthPipe implements PipeTransform {
  transform (value: Object) {
    return Object.keys(value).length
  }
}
