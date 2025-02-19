import { Component, ElementRef, OnInit, inject, viewChild } from '@angular/core'
import { CustomPageService } from '@app/shared/shared-main/custom-page/custom-page.service'
import { CustomMarkupContainerComponent } from '../shared/shared-custom-markup/custom-markup-container.component'

@Component({
  templateUrl: './home.component.html',
  imports: [ CustomMarkupContainerComponent ]
})
export class HomeComponent implements OnInit {
  private customPageService = inject(CustomPageService)

  readonly contentWrapper = viewChild<ElementRef<HTMLInputElement>>('contentWrapper')

  homepageContent: string

  ngOnInit () {
    this.customPageService.getInstanceHomepage()
      .subscribe(({ content }) => this.homepageContent = content)
  }
}
