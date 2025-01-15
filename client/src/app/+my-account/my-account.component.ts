import { Component, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AuthUser, PluginService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'

@Component({
  templateUrl: './my-account.component.html',
  standalone: true,
  imports: [ HorizontalMenuComponent, RouterOutlet ]
})
export class MyAccountComponent implements OnInit {
  menuEntries: HorizontalMenuEntry[] = []
  user: AuthUser

  constructor (
    private pluginService: PluginService
  ) { }

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
        routerLink: '/my-account/blocklist/accounts',
        children: [
          {
            label: $localize`Muted accounts`,
            routerLink: '/my-account/blocklist/accounts'
          },
          {
            label: $localize`Muted servers`,
            routerLink: '/my-account/blocklist/servers'
          },
          {
            label: $localize`Abuse reports`,
            routerLink: '/my-account/abuses'
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
