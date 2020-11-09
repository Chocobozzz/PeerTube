import { Component, OnInit } from '@angular/core'
import { AuthUser, ScreenService } from '@app/core'
import { TopMenuDropdownParam } from '../shared/shared-main/misc/top-menu-dropdown.component'

@Component({
  selector: 'my-my-account',
  templateUrl: './my-account.component.html',
  styleUrls: [ './my-account.component.scss' ]
})
export class MyAccountComponent implements OnInit {
  menuEntries: TopMenuDropdownParam[] = []
  user: AuthUser

  constructor (
    private screenService: ScreenService
    ) { }

  get isBroadcastMessageDisplayed () {
    return this.screenService.isBroadcastMessageDisplayed
  }

  ngOnInit (): void {
    this.buildMenu()
  }

  private buildMenu () {
    const moderationEntries: TopMenuDropdownParam = {
      label: $localize`Moderation`,
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
          label: $localize`Abuse reports`,
          routerLink: '/my-account/abuses',
          iconName: 'flag'
        }
      ]
    }

    this.menuEntries = [
      {
        label: $localize`Settings`,
        routerLink: '/my-account/settings'
      },

      {
        label: $localize`Notifications`,
        routerLink: '/my-account/notifications'
      },

      {
        label: $localize`Applications`,
        routerLink: '/my-account/applications'
      },

      moderationEntries
    ]
  }
}
