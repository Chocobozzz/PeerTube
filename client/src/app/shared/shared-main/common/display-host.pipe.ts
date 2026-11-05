import { Pipe, PipeTransform } from '@angular/core'
import { getDisplayHost } from '@app/helpers'

// Decode a punycode host for display purpose: xn--fdivienne-b4a.org -> fédivienne.org
@Pipe({
  name: 'displayHost',
  standalone: true
})
export class DisplayHostPipe implements PipeTransform {
  transform (host: string): string {
    return getDisplayHost(host)
  }
}
