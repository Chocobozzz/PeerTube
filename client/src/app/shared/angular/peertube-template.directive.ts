import { Directive, Input, TemplateRef } from '@angular/core'

@Directive({
  selector: '[ptTemplate]'
})
export class PeerTubeTemplateDirective {
  @Input('ptTemplate') name: string

  constructor (public template: TemplateRef<any>) {
    // empty
  }
}
