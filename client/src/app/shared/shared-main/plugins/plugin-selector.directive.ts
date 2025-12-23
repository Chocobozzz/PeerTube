import { Directive, ElementRef, OnInit, Renderer2, inject, input } from '@angular/core'
import { PluginSelectorId } from '@peertube/peertube-models'

@Directive({
  selector: '[myPluginSelector]',
  standalone: true
})
export class PluginSelectorDirective implements OnInit {
  private renderer = inject(Renderer2)
  private hostElement = inject<ElementRef<HTMLElement>>(ElementRef)

  readonly pluginSelectorId = input<PluginSelectorId>(undefined)

  ngOnInit () {
    const pluginSelectorId = this.pluginSelectorId()
    if (!pluginSelectorId) return

    const id = this.hostElement.nativeElement.getAttribute('id')
    if (id) throw new Error('Cannot set id on element that already has an id')

    this.renderer.setAttribute(this.hostElement.nativeElement, 'id', `plugin-selector-${pluginSelectorId}`)
  }
}
