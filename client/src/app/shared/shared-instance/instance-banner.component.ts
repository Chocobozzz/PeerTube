import { Component, Input, OnInit, booleanAttribute } from '@angular/core'
import { InstanceService } from './instance.service'

@Component({
  selector: 'my-instance-banner',
  templateUrl: './instance-banner.component.html'
})
export class InstanceBannerComponent implements OnInit {
  @Input({ transform: booleanAttribute }) rounded = false

  instanceBannerUrl: string

  constructor (private instanceService: InstanceService) {

  }

  ngOnInit () {
    this.instanceService.getInstanceBannerUrl()
      .subscribe(instanceBannerUrl => this.instanceBannerUrl = instanceBannerUrl)
  }
}
