import { Component, OnInit } from '@angular/core'
import { AuthService, ServerService, AuthUser } from '@app/core'
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
  user: AuthUser

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

    this.user = this.authService.getUser()

    this.authService.userInformationLoaded.subscribe(
      () => {
        const libraryEntries: TopMenuDropdownParam = {
          label: this.i18n('My library'),
          isDisplayed: () => true,
          children: [
            {
              label: this.i18n('My channels'),
              routerLink: '/my-account/video-channels',
              iconName: 'channel',
              isDisplayed: () => true
            },
            {
              label: this.i18n('My videos'),
              routerLink: '/my-account/videos',
              iconName: 'videos',
              isDisplayed: () => this.user.canSeeVideosLink()
            },
            {
              label: this.i18n('My playlists'),
              routerLink: '/my-account/video-playlists',
              iconName: 'playlists',
              isDisplayed: () => true
            },
            {
              label: this.i18n('My subscriptions'),
              routerLink: '/my-account/subscriptions',
              iconName: 'inbox-full',
              isDisplayed: () => true
            },
            {
              label: this.i18n('My history'),
              routerLink: '/my-account/history/videos',
              iconName: 'history',
              isDisplayed: () => true
            }
          ]
        }

        if (this.isVideoImportEnabled()) {
          libraryEntries.children.push({
            label: 'My imports',
            routerLink: '/my-account/video-imports',
            iconName: 'cloud-download',
            isDisplayed: () => this.user.canSeeVideosLink()
          })
        }

        const miscEntries: TopMenuDropdownParam = {
          label: this.i18n('Misc'),
          isDisplayed: () => true,
          children: [
            {
              label: this.i18n('Muted accounts'),
              routerLink: '/my-account/blocklist/accounts',
              iconName: 'user-x',
              isDisplayed: () => true
            },
            {
              label: this.i18n('Muted servers'),
              routerLink: '/my-account/blocklist/servers',
              iconName: 'peertube-x',
              isDisplayed: () => true
            },
            {
              label: this.i18n('Ownership changes'),
              routerLink: '/my-account/ownership',
              iconName: 'download',
              isDisplayed: () => true
            }
          ]
        }

        this.menuEntries = [
          {
            label: this.i18n('My settings'),
            routerLink: '/my-account/settings',
            isDisplayed: () => true
          },
          {
            label: this.i18n('My notifications'),
            routerLink: '/my-account/notifications',
            isDisplayed: () => true
          },
          libraryEntries,
          miscEntries
        ]
      }
    )
  }

  isVideoImportEnabled () {
    const importConfig = this.serverConfig.import.videos

    return importConfig.http.enabled || importConfig.torrent.enabled
  }
}
