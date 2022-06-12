import { Directive, ElementRef, Input, OnInit, Renderer2 } from '@angular/core'
import { PluginSelectorId } from '@shared/models'

@Directive({ selector: '[myPluginSelector]' })
export class PluginSelectorDirective implements OnInit {
  @Input() pluginSelectorId: PluginSelectorId

  constructor (
    private renderer: Renderer2,
    private hostElement: ElementRef<HTMLElement>
  ) {

  }

  ngOnInit () {
    const id = this.hostElement.nativeElement.getAttribute('id')
    if (id) throw new Error('Cannot set id on element that already has an id')

    this.renderer.setAttribute(this.hostElement.nativeElement, 'id', `plugin-selector-${this.pluginSelectorId}`)
  }
}
