import { Component, OnInit } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { TopMenuDropdownParam } from '../shared/shared-main/misc/top-menu-dropdown.component'

@Component({
  selector: 'my-my-account',
  templateUrl: './my-account.component.html',
  styleUrls: [ './my-account.component.scss' ]
})
export class MyAccountComponent implements OnInit {
  menuEntries: TopMenuDropdownParam[] = []

  constructor (
    private i18n: I18n
  ) { }

  ngOnInit (): void {
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
      blocklistEntries
    ]
  }
}
