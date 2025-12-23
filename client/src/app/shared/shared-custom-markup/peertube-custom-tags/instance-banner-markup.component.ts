import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core'
import { ServerService } from '@app/core'
import { maxBy } from '@peertube/peertube-core-utils'
import { CustomMarkupComponent } from './shared'

/*
 * Markup component that creates the img HTML element containing the instance banner
 */

@Component({
  selector: 'my-instance-banner-markup',
  templateUrl: 'instance-banner-markup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: []
})
export class InstanceBannerMarkupComponent implements OnInit, CustomMarkupComponent {
  private cd = inject(ChangeDetectorRef)
  private server = inject(ServerService)

  instanceBannerUrl: string
  loaded: undefined

  ngOnInit () {
    const { instance } = this.server.getHTMLConfig()

    this.instanceBannerUrl = maxBy(instance.banners, 'width')?.fileUrl
    this.cd.markForCheck()
  }
}
