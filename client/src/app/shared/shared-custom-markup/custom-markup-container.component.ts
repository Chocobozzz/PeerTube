import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core'
import { CustomMarkupService } from './custom-markup.service'

@Component({
  selector: 'my-custom-markup-container',
  templateUrl: './custom-markup-container.component.html',
  styleUrls: [ './custom-markup-container.component.scss' ]
})
export class CustomMarkupContainerComponent implements OnChanges {
  @ViewChild('contentWrapper') contentWrapper: ElementRef<HTMLInputElement>

  @Input() content: string

  constructor (
    private customMarkupService: CustomMarkupService
  ) { }

  async ngOnChanges () {
    await this.buildElement()
  }

  private async buildElement () {
    const element = await this.customMarkupService.buildElement(this.content)
    this.contentWrapper.nativeElement.appendChild(element)
  }

}
