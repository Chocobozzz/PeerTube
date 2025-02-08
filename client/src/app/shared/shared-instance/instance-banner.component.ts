import { NgClass, NgIf } from '@angular/common'
import { Component, Input, OnInit, booleanAttribute } from '@angular/core'
import { ServerService } from '@app/core'
import { maxBy } from '@peertube/peertube-core-utils'

@Component({
  selector: 'my-instance-banner',
  templateUrl: './instance-banner.component.html',
  imports: [ NgIf, NgClass ]
})
export class InstanceBannerComponent implements OnInit {
  @Input({ transform: booleanAttribute }) rounded = false

  instanceBannerUrl: string

  constructor (private server: ServerService) {

  }

  ngOnInit () {
    const { instance } = this.server.getHTMLConfig()

    this.instanceBannerUrl = maxBy(instance.banners, 'width')?.path
  }
}
