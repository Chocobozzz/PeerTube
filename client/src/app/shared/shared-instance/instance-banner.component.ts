import { Component, Input, OnInit, booleanAttribute } from '@angular/core'
import { ServerService } from '@app/core'

@Component({
  selector: 'my-instance-banner',
  templateUrl: './instance-banner.component.html'
})
export class InstanceBannerComponent implements OnInit {
  @Input({ transform: booleanAttribute }) rounded = false

  instanceBannerUrl: string

  constructor (private server: ServerService) {

  }

  ngOnInit () {
    const { instance } = this.server.getHTMLConfig()

    this.instanceBannerUrl = instance.banners?.[0]?.path
  }
}
