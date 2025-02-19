import { Component, ElementRef, OnChanges, inject, input, viewChild } from '@angular/core'
import { CustomMarkupService } from './custom-markup.service'

@Component({
  selector: 'my-custom-markup-container',
  templateUrl: './custom-markup-container.component.html',
  standalone: true
})
export class CustomMarkupContainerComponent implements OnChanges {
  private customMarkupService = inject(CustomMarkupService)

  readonly contentWrapper = viewChild<ElementRef<HTMLInputElement>>('contentWrapper')

  readonly content = input<string | HTMLDivElement>(undefined)

  displayed = false

  async ngOnChanges () {
    await this.rebuild()
  }

  private async rebuild () {
    const content = this.content()
    if (content instanceof HTMLDivElement) {
      return this.loadElement(content)
    }

    const { rootElement, componentsLoaded } = await this.customMarkupService.buildElement(content)
    await componentsLoaded

    return this.loadElement(rootElement)
  }

  private loadElement (el: HTMLDivElement) {
    this.contentWrapper().nativeElement.appendChild(el)

    this.displayed = true
  }
}
