import { Component, Input, OnInit, booleanAttribute } from '@angular/core'
import { ServerService } from '@app/core'
import { NgIf, NgClass } from '@angular/common'

@Component({
  selector: 'my-instance-banner',
  templateUrl: './instance-banner.component.html',
  standalone: true,
  imports: [ NgIf, NgClass ]
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
