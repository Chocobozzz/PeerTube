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
          routerLink: '/my-account/videos'
        },
        {
          label: this.i18n('My videos'),
          routerLink: '/my-account/videos'
        },
        {
          label: this.i18n('My subscriptions'),
          routerLink: '/my-account/subscriptions'
        }
      ]
    }

    if (this.isVideoImportEnabled()) {
      libraryEntries.children.push({
        label: 'My imports',
        routerLink: '/my-account/video-imports'
      })
    }

    const miscEntries: TopMenuDropdownParam = {
      label: this.i18n('Misc'),
      children: [
        {
          label: this.i18n('Muted accounts'),
          routerLink: '/my-account/blocklist/accounts'
        },
        {
          label: this.i18n('Muted instances'),
          routerLink: '/my-account/blocklist/servers'
        },
        {
          label: this.i18n('Ownership changes'),
          routerLink: '/my-account/ownership'
        }
      ]
    }

    this.menuEntries = [
      {
        label: this.i18n('My settings'),
        routerLink: '/my-account/settings'
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
