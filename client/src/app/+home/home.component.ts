import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { CustomPageService } from '@app/shared/shared-main/custom-page'

@Component({
  templateUrl: './home.component.html',
  styleUrls: [ './home.component.scss' ]
})

export class HomeComponent implements OnInit {
  @ViewChild('contentWrapper') contentWrapper: ElementRef<HTMLInputElement>

  homepageContent: string

  constructor (
    private customPageService: CustomPageService
  ) { }

  async ngOnInit () {
    this.customPageService.getInstanceHomepage()
      .subscribe(({ content }) => this.homepageContent = content)
  }
}
