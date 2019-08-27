import { Directive, Input, TemplateRef } from '@angular/core'

@Directive({
  selector: '[ptTemplate]'
})
export class PeerTubeTemplateDirective <T extends string> {
  @Input('ptTemplate') name: T

  constructor (public template: TemplateRef<any>) {
    // empty
  }
}
