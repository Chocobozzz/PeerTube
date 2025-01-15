import { Component, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AuthService, ServerService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { UserRight, UserRightType } from '@peertube/peertube-models'

@Component({
  templateUrl: './admin-moderation.component.html',
  standalone: true,
  imports: [ HorizontalMenuComponent, RouterOutlet ]
})
export class AdminModerationComponent implements OnInit {
  menuEntries: HorizontalMenuEntry[] = []

  constructor (
    private auth: AuthService,
    private server: ServerService
  ) { }

  ngOnInit () {
    this.server.configReloaded.subscribe(() => this.buildMenu())

    this.buildMenu()
  }

  private buildMenu () {
    this.menuEntries = []

    if (this.hasRight(UserRight.MANAGE_ABUSES)) {
      this.menuEntries.push({
        label: $localize`Reports`,
        routerLink: '/admin/moderation/abuses/list'
      })
    }

    if (this.hasRight(UserRight.MANAGE_REGISTRATIONS)) {
      this.menuEntries.push({
        label: $localize`Registrations`,
        routerLink: '/admin/moderation/registrations/list'
      })
    }

    if (this.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)) {
      this.menuEntries.push({
        label: $localize`Video blocks`,
        routerLink: '/admin/moderation/video-blocks/list'
      })
    }

    if (this.hasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST) || this.hasRight(UserRight.MANAGE_SERVERS_BLOCKLIST)) {
      const item: HorizontalMenuEntry = {
        label: $localize`Mutes`,
        routerLink: '',
        children: []
      }

      if (this.hasRight(UserRight.MANAGE_ACCOUNTS_BLOCKLIST)) {
        item.children.push({
          label: $localize`Muted accounts`,
          routerLink: '/admin/moderation/blocklist/accounts'
        })
      }

      if (this.hasRight(UserRight.MANAGE_SERVERS_BLOCKLIST)) {
        item.children.push({
          label: $localize`Muted servers`,
          routerLink: '/admin/moderation/blocklist/servers'
        })
      }

      item.routerLink = item.children[0].routerLink

      this.menuEntries.push(item)
    }

    if (this.hasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS)) {
      this.menuEntries.push({
        label: $localize`Watched words`,
        routerLink: '/admin/moderation/watched-words/list'
      })
    }
  }

  private hasRight (right: UserRightType) {
    return this.auth.getUser().hasRight(right)
  }
}
