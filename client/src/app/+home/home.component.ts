import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { CustomPageService } from '@app/shared/shared-main/custom-page'
import { CustomMarkupContainerComponent } from '../shared/shared-custom-markup/custom-markup-container.component'

@Component({
  templateUrl: './home.component.html',
  styleUrls: [ './home.component.scss' ],
  standalone: true,
  imports: [ CustomMarkupContainerComponent ]
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
