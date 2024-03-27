import { NgClass, NgIf } from '@angular/common'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core'
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
  standalone: true,
  imports: [ NgIf, NgClass ]
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

    this.instanceBannerUrl = maxBy(instance.banners, 'width')?.path
    this.cd.markForCheck()
  }
}
