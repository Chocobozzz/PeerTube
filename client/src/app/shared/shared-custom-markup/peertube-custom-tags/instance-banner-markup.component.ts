import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core'
import { CustomMarkupComponent } from './shared'
import { ServerService } from '@app/core'

/*
 * Markup component that creates the img HTML element containing the instance banner
*/

@Component({
  selector: 'my-instance-banner-markup',
  templateUrl: 'instance-banner-markup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstanceBannerMarkupComponent implements OnInit, CustomMarkupComponent {
  @Input() revertHomePaddingTop: boolean

  instanceBannerUrl: string
  loaded: undefined

  constructor (
    private cd: ChangeDetectorRef,
    private server: ServerService
  ) {}

  ngOnInit () {
    const { instance } = this.server.getHTMLConfig()

    this.instanceBannerUrl = instance.banners?.[0]?.path
    this.cd.markForCheck()
  }
}
