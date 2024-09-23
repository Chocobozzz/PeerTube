import { Directive, Input, TemplateRef } from '@angular/core'

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[ptTemplate]',
  standalone: true
})
export class PeerTubeTemplateDirective <T extends string> {
  @Input('ptTemplate') name: T

  constructor (public template: TemplateRef<any>) {
    // empty
  }
}
