import { Component, OnInit } from '@angular/core'
import { AuthService, AuthUser, ScreenService, ServerService } from '@app/core'
import { ServerConfig } from '@shared/models'
import { TopMenuDropdownParam } from '../shared/shared-main/misc/top-menu-dropdown.component'

@Component({
  selector: 'my-my-account',
  templateUrl: './my-account.component.html',
  styleUrls: [ './my-account.component.scss' ]
})
export class MyAccountComponent implements OnInit {
  menuEntries: TopMenuDropdownParam[] = []
  user: AuthUser

  private serverConfig: ServerConfig

  constructor (
    private serverService: ServerService,
    private authService: AuthService,
    private screenService: ScreenService
    ) { }

  get isBroadcastMessageDisplayed () {
    return this.screenService.isBroadcastMessageDisplayed
  }

  ngOnInit (): void {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.user = this.authService.getUser()

    this.authService.userInformationLoaded.subscribe(
      () => this.buildMenu()
    )
  }

  isVideoImportEnabled () {
    const importConfig = this.serverConfig.import.videos

    return importConfig.http.enabled || importConfig.torrent.enabled
  }

  private buildMenu () {
    const libraryEntries: TopMenuDropdownParam = {
      label: $localize`My library`,
      children: [
        {
          label: $localize`My channels`,
          routerLink: '/my-account/video-channels',
          iconName: 'channel'
        },
        {
          label: $localize`My videos`,
          routerLink: '/my-account/videos',
          iconName: 'videos',
          isDisplayed: () => this.user.canSeeVideosLink
        },
        {
          label: $localize`My playlists`,
          routerLink: '/my-account/video-playlists',
          iconName: 'playlists'
        },
        {
          label: $localize`My subscriptions`,
          routerLink: '/my-account/subscriptions',
          iconName: 'subscriptions'
        },
        {
          label: $localize`My history`,
          routerLink: '/my-account/history/videos',
          iconName: 'history'
        }
      ]
    }

    if (this.isVideoImportEnabled()) {
      libraryEntries.children.push({
        label: 'My imports',
        routerLink: '/my-account/video-imports',
        iconName: 'cloud-download',
        isDisplayed: () => this.user.canSeeVideosLink
      })
    }

    const miscEntries: TopMenuDropdownParam = {
      label: $localize`Misc`,
      children: [
        {
          label: $localize`Muted accounts`,
          routerLink: '/my-account/blocklist/accounts',
          iconName: 'user-x'
        },
        {
          label: $localize`Muted servers`,
          routerLink: '/my-account/blocklist/servers',
          iconName: 'peertube-x'
        },
        {
          label: $localize`My abuse reports`,
          routerLink: '/my-account/abuses',
          iconName: 'flag'
        },
        {
          label: $localize`Ownership changes`,
          routerLink: '/my-account/ownership',
          iconName: 'download'
        }
      ]
    }

    this.menuEntries = [
      {
        label: $localize`My settings`,
        routerLink: '/my-account/settings'
      },
      {
        label: $localize`My notifications`,
        routerLink: '/my-account/notifications'
      },
      libraryEntries,
      miscEntries
    ]
  }
}
