
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { CustomMarkupService } from '@app/shared/shared-custom-markup'
import { CustomPageService } from '@app/shared/shared-main/custom-page'

@Component({
  templateUrl: './home.component.html',
  styleUrls: [ './home.component.scss' ]
})

export class HomeComponent implements OnInit {
  @ViewChild('contentWrapper') contentWrapper: ElementRef<HTMLInputElement>

  constructor (
    private customMarkupService: CustomMarkupService,
    private customPageService: CustomPageService
  ) { }

  async ngOnInit () {
    this.customPageService.getInstanceHomepage()
      .subscribe(async ({ content }) => {
        const element = await this.customMarkupService.buildElement(content)
        this.contentWrapper.nativeElement.appendChild(element)
      })
  }
}
