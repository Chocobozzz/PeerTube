import { NgClass } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AuthUser, PluginService, ScreenService } from '@app/core'
import { TopMenuDropdownComponent, TopMenuDropdownParam } from '../shared/shared-main/misc/top-menu-dropdown.component'

@Component({
  templateUrl: './my-account.component.html',
  styleUrls: [ './my-account.component.scss' ],
  standalone: true,
  imports: [ TopMenuDropdownComponent, NgClass, RouterOutlet ]
})
export class MyAccountComponent implements OnInit {
  menuEntries: TopMenuDropdownParam[] = []
  user: AuthUser

  constructor (
    private pluginService: PluginService,
    private screenService: ScreenService
  ) { }

  get isBroadcastMessageDisplayed () {
    return this.screenService.isBroadcastMessageDisplayed
  }

  ngOnInit (): void {
    this.pluginService.ensurePluginsAreLoaded('my-account')
      .then(() => this.buildMenu())
  }

  private buildMenu () {
    const clientRoutes = this.pluginService.getAllRegisteredClientRoutesForParent('/my-account') || {}

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
        label: $localize`Import/Export`,
        routerLink: '/my-account/import-export'
      },

      {
        label: $localize`Applications`,
        routerLink: '/my-account/applications'
      },

      {
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
          },
          {
            label: $localize`Comments on your videos`,
            routerLink: '/my-account/videos/comments',
            iconName: 'message-circle'
          },
          {
            label: $localize`Watched words`,
            routerLink: '/my-account/watched-words/list',
            iconName: 'eye-open'
          },
          {
            label: $localize`Auto tag policies`,
            routerLink: '/my-account/auto-tag-policies',
            iconName: 'no'
          }
        ]
      },

      ...Object.values(clientRoutes)
        .map(clientRoute => ({
          label: clientRoute.menuItem?.label,
          routerLink: '/my-account/p/' + clientRoute.route
        }))
    ]
  }
}
