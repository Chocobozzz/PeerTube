import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core'
import { CustomMarkupService } from './custom-markup.service'

@Component({
  selector: 'my-custom-markup-container',
  templateUrl: './custom-markup-container.component.html'
})
export class CustomMarkupContainerComponent implements OnChanges {
  @ViewChild('contentWrapper') contentWrapper: ElementRef<HTMLInputElement>

  @Input() content: string

  displayed = false

  constructor (
    private customMarkupService: CustomMarkupService
  ) { }

  async ngOnChanges () {
    await this.buildElement()
  }

  private async buildElement () {
    if (!this.content) return

    const { rootElement, componentsLoaded } = await this.customMarkupService.buildElement(this.content)
    this.contentWrapper.nativeElement.appendChild(rootElement)

    await componentsLoaded

    this.displayed = true
  }
}
