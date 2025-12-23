import { Component, OnInit, inject } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { ServerService } from '@app/core'
import { NewFeatureInfoService } from '@app/modal/new-feature-info.service'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { HTMLServerConfig } from '@peertube/peertube-models'

@Component({
  templateUrl: './my-channel-space.component.html',
  imports: [ RouterOutlet, HorizontalMenuComponent ]
})
export class MyChannelSpaceComponent implements OnInit {
  private serverService = inject(ServerService)
  private newFeatureInfoService = inject(NewFeatureInfoService)

  menuEntries: HorizontalMenuEntry[] = []

  private serverConfig: HTMLServerConfig

  ngOnInit (): void {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.buildMenu()

    this.newFeatureInfoService.showChannelCollaboration()
  }

  private buildMenu () {
    this.menuEntries = [
      {
        label: $localize`Manage my channels`,
        routerLink: '/my-library/video-channels'
      },
      {
        label: $localize`Followers`,
        routerLink: '/my-library/followers'
      },
      {
        label: $localize`Synchronizations`,
        routerLink: '/my-library/video-channel-syncs',
        isDisplayed: () => this.isChannelSyncEnabled()
      }
    ]
  }

  private isChannelSyncEnabled () {
    const config = this.serverConfig.import

    return this.serverConfig.import.videoChannelSynchronization.enabled &&
      (config.videos.http.enabled || config.videos.torrent.enabled)
  }
}
