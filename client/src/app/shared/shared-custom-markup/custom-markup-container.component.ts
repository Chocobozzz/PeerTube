import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core'
import { CustomMarkupService } from './custom-markup.service'

@Component({
  selector: 'my-custom-markup-container',
  templateUrl: './custom-markup-container.component.html',
  standalone: true
})
export class CustomMarkupContainerComponent implements OnChanges {
  @ViewChild('contentWrapper', { static: true }) contentWrapper: ElementRef<HTMLInputElement>

  @Input() content: string | HTMLDivElement

  displayed = false

  constructor (
    private customMarkupService: CustomMarkupService
  ) { }

  async ngOnChanges () {
    await this.rebuild()
  }

  private async rebuild () {
    if (this.content instanceof HTMLDivElement) {
      return this.loadElement(this.content)
    }

    const { rootElement, componentsLoaded } = await this.customMarkupService.buildElement(this.content)
    await componentsLoaded

    return this.loadElement(rootElement)
  }

  private loadElement (el: HTMLDivElement) {
    this.contentWrapper.nativeElement.appendChild(el)

    this.displayed = true
  }
}
