import { Directive, TemplateRef, inject, input } from '@angular/core'

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[ptTemplate]',
  standalone: true
})
export class PeerTubeTemplateDirective<T extends string> {
  template = inject<TemplateRef<any>>(TemplateRef)

  readonly name = input<T>(undefined, { alias: 'ptTemplate' })
}
