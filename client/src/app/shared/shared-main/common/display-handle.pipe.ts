import { Pipe, PipeTransform } from '@angular/core'
import { getDisplayHandle } from '@app/helpers'

// Decode the punycode host of an actor handle for display purpose: name@xn--fdivienne-b4a.org -> name@fédivienne.org
@Pipe({
  name: 'displayHandle',
  standalone: true
})
export class DisplayHandlePipe implements PipeTransform {
  transform (handle: string): string {
    return getDisplayHandle(handle)
  }
}
