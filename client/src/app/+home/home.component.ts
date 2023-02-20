import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { CustomPageService } from '@app/shared/shared-main/custom-page'

@Component({
  templateUrl: './home.component.html'
})

export class HomeComponent implements OnInit {
  @ViewChild('contentWrapper') contentWrapper: ElementRef<HTMLInputElement>

  homepageContent: string

  constructor (
    private customPageService: CustomPageService
  ) { }

  ngOnInit () {
    this.customPageService.getInstanceHomepage()
      .subscribe(({ content }) => this.homepageContent = content)
  }
}
