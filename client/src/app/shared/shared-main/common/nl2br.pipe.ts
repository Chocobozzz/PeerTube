import { Pipe, PipeTransform, inject } from '@angular/core'
import { HtmlRendererService } from '@app/core'

@Pipe({
  name: 'nl2br',
  standalone: true
})
export class Nl2BrPipe implements PipeTransform {
  private htmlRenderer = inject(HtmlRendererService)

  transform (value: string, allowFormatting = false): string {
    return this.htmlRenderer.convertToBr(value, allowFormatting)
  }
}
