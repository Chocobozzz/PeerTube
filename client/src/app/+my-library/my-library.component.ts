import { NgClass } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AuthService, AuthUser, ScreenService, ServerService } from '@app/core'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { TopMenuDropdownComponent, TopMenuDropdownParam } from '../shared/shared-main/misc/top-menu-dropdown.component'

@Component({
  templateUrl: './my-library.component.html',
  styleUrls: [ './my-library.component.scss' ],
  standalone: true,
  imports: [ TopMenuDropdownComponent, NgClass, RouterOutlet ]
})
export class MyLibraryComponent implements OnInit {
  menuEntries: TopMenuDropdownParam[] = []
  user: AuthUser

  private serverConfig: HTMLServerConfig

  constructor (
    private serverService: ServerService,
    private authService: AuthService,
    private screenService: ScreenService
  ) { }

  get isBroadcastMessageDisplayed () {
    return this.screenService.isBroadcastMessageDisplayed
  }

  ngOnInit (): void {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.user = this.authService.getUser()
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
        routerLink: '/my-library/video-channels'
      }
    ]

    if (this.user.canSeeVideosLink) {
      this.menuEntries.push({
        label: $localize`Videos`,
        routerLink: '/my-library/videos'
      })
    }

    this.menuEntries = this.menuEntries.concat([
      {
        label: $localize`Playlists`,
        routerLink: '/my-library/video-playlists'
      },

      {
        label: $localize`Follows`,
        children: [
          {
            label: $localize`Subscriptions`,
            iconName: 'subscriptions',
            routerLink: '/my-library/subscriptions'
          },
          {
            label: $localize`Followers`,
            iconName: 'follower',
            routerLink: '/my-library/followers'
          }
        ]
      },

      {
        label: $localize`History`,
        routerLink: '/my-library/history/videos'
      }
    ])
  }
}
