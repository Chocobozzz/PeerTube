import { NgClass } from '@angular/common'
import { Component, OnInit, booleanAttribute, inject, input } from '@angular/core'
import { ServerService } from '@app/core'
import { maxBy } from '@peertube/peertube-core-utils'

@Component({
  selector: 'my-instance-banner',
  templateUrl: './instance-banner.component.html',
  imports: [ NgClass ]
})
export class InstanceBannerComponent implements OnInit {
  private server = inject(ServerService)

  readonly rounded = input(false, { transform: booleanAttribute })

  instanceBannerUrl: string

  ngOnInit () {
    const { instance } = this.server.getHTMLConfig()

    this.instanceBannerUrl = maxBy(instance.banners, 'width')?.fileUrl
  }
}
