import { Component, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { ServerService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { HTMLServerConfig } from '@peertube/peertube-models'

@Component({
  templateUrl: './my-video-space.component.html',
  imports: [ RouterOutlet, HorizontalMenuComponent ]
})
export class MyVideoSpaceComponent implements OnInit {
  menuEntries: HorizontalMenuEntry[] = []

  private serverConfig: HTMLServerConfig

  constructor (
    private serverService: ServerService
  ) { }

  ngOnInit (): void {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.buildMenu()
  }

  isVideoImportEnabled () {
    const importConfig = this.serverConfig.import.videos

    return importConfig.http.enabled || importConfig.torrent.enabled
  }

  private buildMenu () {
    this.menuEntries = [
      {
        label: $localize`Channels`,
        routerLink: '/my-library/video-channels',
        children: [
          {
            label: $localize`Manage`,
            routerLink:'/my-library/video-channels'
          },
          {
            label: $localize`Followers`,
            routerLink: '/my-library/followers'
          },
          {
            label: $localize`Synchronizations`,
            routerLink: '/my-library/video-channel-syncs'
          }
        ]
      },

      {
        label: $localize`Videos`,
        routerLink: '/my-library/videos',
        children: [
          {
            label: $localize`Manage`,
            routerLink: '/my-library/videos'
          },

          {
            label: $localize`Imports`,
            routerLink: '/my-library/video-imports',
            isDisplayed: () => this.isVideoImportEnabled()
          },

          {
            label: $localize`Ownership changes`,
            routerLink: '/my-library/ownership'
          },

          {
            label: $localize`Comments`,
            routerLink: '/my-library/comments-on-my-videos'
          },
          {
            label: $localize`Watched words`,
            routerLink: '/my-library/watched-words/list'
          },
          {
            label: $localize`Auto tag policies`,
            routerLink: '/my-library/auto-tag-policies'
          }
        ]
      }
    ]
  }
}
