import { Component, ComponentRef, ElementRef, OnChanges, OnDestroy, inject, input, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { CustomMarkupService } from './custom-markup.service'
import { CustomMarkupComponent } from './peertube-custom-tags/shared'

@Component({
  selector: 'my-custom-markup-container',
  templateUrl: './custom-markup-container.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true
})
export class CustomMarkupContainerComponent implements OnChanges, OnDestroy {
  private customMarkupService = inject(CustomMarkupService)

  readonly contentWrapper = viewChild<ElementRef<HTMLInputElement>>('contentWrapper')

  readonly content = input<string | HTMLDivElement>(undefined)

  displayed = false

  private dynamicComponentRefs: ComponentRef<CustomMarkupComponent>[] = []

  async ngOnChanges () {
    await this.rebuild()
  }

  ngOnDestroy () {
    this.destroyDynamicComponents()
  }

  private async rebuild () {
    this.destroyDynamicComponents()
    const wrapper = this.contentWrapper()
    if (wrapper) wrapper.nativeElement.innerHTML = ''

    const content = this.content()
    if (content instanceof HTMLDivElement) {
      return this.loadElement(content)
    }

    const { rootElement, componentsLoaded, componentRefs } = await this.customMarkupService.buildElement(content)
    this.dynamicComponentRefs = componentRefs
    await componentsLoaded

    return this.loadElement(rootElement)
  }

  private destroyDynamicComponents () {
    for (const ref of this.dynamicComponentRefs) {
      ref.destroy()
    }

    this.dynamicComponentRefs = []
  }

  private loadElement (el: HTMLDivElement) {
    this.contentWrapper().nativeElement.appendChild(el)

    this.displayed = true
  }
}
