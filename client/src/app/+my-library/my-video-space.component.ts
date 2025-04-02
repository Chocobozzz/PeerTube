import { Component, OnInit, inject } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { ServerService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { HTMLServerConfig } from '@peertube/peertube-models'

@Component({
  templateUrl: './my-video-space.component.html',
  imports: [ RouterOutlet, HorizontalMenuComponent ]
})
export class MyVideoSpaceComponent implements OnInit {
  private serverService = inject(ServerService)

  menuEntries: HorizontalMenuEntry[] = []

  private serverConfig: HTMLServerConfig

  ngOnInit (): void {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.buildMenu()
  }

  private buildMenu () {
    this.menuEntries = [
      {
        label: $localize`Manage my videos`,
        routerLink: '/my-library/videos'
      },

      {
        label: $localize`Comments`,
        routerLink: '/my-library/comments-on-my-videos',
        children: [
          {
            label: $localize`Comments on my videos`,
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
      },

      {
        label: $localize`Settings`,
        routerLink: '/my-library/video-imports',
        children: [
          {
            label: $localize`Imports`,
            routerLink: '/my-library/video-imports',
            isDisplayed: () => this.isVideoImportEnabled()
          },
          {
            label: $localize`Ownership changes`,
            routerLink: '/my-library/ownership'
          }
        ]
      }
    ]
  }

  private isVideoImportEnabled () {
    const config = this.serverConfig.import.videos

    return config.http.enabled || config.torrent.enabled
  }
}
