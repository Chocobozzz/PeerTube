import { Component } from '@angular/core'
import { ServerService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { TopMenuDropdownParam } from '@app/shared/menu/top-menu-dropdown.component'

@Component({
  selector: 'my-my-account',
  templateUrl: './my-account.component.html',
  styleUrls: [ './my-account.component.scss' ]
})
export class MyAccountComponent {
  menuEntries: TopMenuDropdownParam[] = []

  constructor (
    private serverService: ServerService,
    private i18n: I18n
  ) {

    const libraryEntries: TopMenuDropdownParam = {
      label: this.i18n('My library'),
      children: [
        {
          label: this.i18n('My channels'),
          routerLink: '/my-account/video-channels',
          iconName: 'folder'
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

    const miscEntries: TopMenuDropdownParam = {
      label: this.i18n('Misc'),
      children: [
        {
          label: this.i18n('Muted accounts'),
          routerLink: '/my-account/blocklist/accounts',
          iconName: 'user'
        },
        {
          label: this.i18n('Muted instances'),
          routerLink: '/my-account/blocklist/servers',
          iconName: 'server'
        },
        {
          label: this.i18n('Ownership changes'),
          routerLink: '/my-account/ownership',
          iconName: 'im-with-her'
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
    const importConfig = this.serverService.getConfig().import.videos

    return importConfig.http.enabled || importConfig.torrent.enabled
  }

}
