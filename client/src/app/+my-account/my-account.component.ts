import { Component, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
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

  private serverConfig: ServerConfig

  constructor (
    private serverService: ServerService,
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
          iconName: 'inbox-full'
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

    const blocklistEntries: TopMenuDropdownParam = {
      label: this.i18n('My blocklist'),
      children: [
        {
          label: this.i18n('Muted accounts'),
          routerLink: '/my-account/blocklist/accounts',
          iconName: 'user'
        },
        {
          label: this.i18n('Muted servers'),
          routerLink: '/my-account/blocklist/servers',
          iconName: 'server'
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
      {
        label: this.i18n('My ownership changes'),
        routerLink: '/my-account/ownership',
      },
      libraryEntries,
      blocklistEntries
    ]
  }

  isVideoImportEnabled () {
    const importConfig = this.serverConfig.import.videos

    return importConfig.http.enabled || importConfig.torrent.enabled
  }

}
