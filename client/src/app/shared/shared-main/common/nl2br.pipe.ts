import { Pipe, PipeTransform } from '@angular/core'
import { HtmlRendererService } from '@app/core'

@Pipe({
  name: 'nl2br',
  standalone: true
})
export class Nl2BrPipe implements PipeTransform {

  constructor (private htmlRenderer: HtmlRendererService) {

  }

  transform (value: string): string {
    return this.htmlRenderer.convertToBr(value)
  }
}
