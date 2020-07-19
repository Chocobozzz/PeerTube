import { Component, OnInit } from '@angular/core'
import { AuthService, ServerService, User } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ServerConfig } from '@shared/models'
import { TopMenuDropdownParam } from '../shared/shared-main/misc/top-menu-dropdown.component'

@Component({
  selector: 'my-my-account',
  templateUrl: './my-account.component.html',
  styleUrls: [ './my-account.component.scss' ]
})
export class MyAccountComponent implements OnInit {
  menuEntries: TopMenuDropdownParam[] = []
  user: User

  private serverConfig: ServerConfig

  constructor (
    private serverService: ServerService,
    private authService: AuthService,
    private i18n: I18n
  ) { }

  ngOnInit (): void {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    const libraryEntries: TopMenuDropdownParam = {
      label: this.i18n('My library'),
      children: [
        {
          label: this.i18n('My channels'),
          routerLink: '/my-account/video-channels',
          iconName: 'channel'
        },
        {
          label: this.i18n('My videos'),
          routerLink: '/my-account/videos',
          iconName: 'videos'
        },
        {
          label: this.i18n('My playlists'),
          routerLink: '/my-account/video-playlists',
          iconName: 'playlists'
        },
        {
          label: this.i18n('My subscriptions'),
          routerLink: '/my-account/subscriptions',
          iconName: 'subscriptions'
        },
        {
          label: this.i18n('My history'),
          routerLink: '/my-account/history/videos',
          iconName: 'history'
        }
      ]
    }

    if (this.isVideoImportEnabled()) {
      libraryEntries.children.push({
        label: 'My imports',
        routerLink: '/my-account/video-imports',
        iconName: 'cloud-download'
      })
    }

    this.user = this.authService.getUser()

    this.authService.userInformationLoaded.subscribe(
      () => {
        // Cannot see videos links, hide my videos and my imports
        if (!this.canSeeVideosLink()) {
          libraryEntries.children.splice(1, 1)

          if (this.isVideoImportEnabled()) {
            libraryEntries.children.splice(4, 1)
          }
        }
      }
    )

    const miscEntries: TopMenuDropdownParam = {
      label: this.i18n('Misc'),
      children: [
        {
          label: this.i18n('Muted accounts'),
          routerLink: '/my-account/blocklist/accounts',
          iconName: 'user-x'
        },
        {
          label: this.i18n('Muted servers'),
          routerLink: '/my-account/blocklist/servers',
          iconName: 'peertube-x'
        },
        {
          label: this.i18n('Ownership changes'),
          routerLink: '/my-account/ownership',
          iconName: 'download'
        }
      ]
    }

    this.menuEntries = [
      {
        label: this.i18n('My settings'),
        routerLink: '/my-account/settings'
      },
      {
        label: this.i18n('My notifications'),
        routerLink: '/my-account/notifications'
      },
      libraryEntries,
      miscEntries
    ]
  }

  isVideoImportEnabled () {
    const importConfig = this.serverConfig.import.videos

    return importConfig.http.enabled || importConfig.torrent.enabled
  }

  canSeeVideosLink () {
    const { videoQuota, videoQuotaDaily, videosCount } = this.user

    // can upload
    if ((videoQuota > 0 || videoQuota === -1) && (videoQuotaDaily > 0 || videoQuotaDaily === -1)) {
      return true
    }

    // cannot upload but has already some videos
    if (videosCount > 0) {
      return true
    }
  }
}
