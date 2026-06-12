import { Component, DestroyRef, OnInit, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { RouterOutlet } from '@angular/router'
import { AuthService, ServerService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { UserRight, UserRightType } from '@peertube/peertube-models'

@Component({
  selector: 'my-admin-moderation',
  templateUrl: './admin-moderation.component.html',
  imports: [ HorizontalMenuComponent, RouterOutlet ]
})
export class AdminModerationComponent implements OnInit {
  private destroyRef = inject(DestroyRef)
  private auth = inject(AuthService)
  private server = inject(ServerService)

  menuEntries: HorizontalMenuEntry[] = []

  ngOnInit () {
    this.server.configReloaded
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildMenu())

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

    if (
      this.hasRight(UserRight.MANAGE_SERVER_ACCOUNTS_BLOCKLIST) || this.hasRight(UserRight.MANAGE_SERVER_SERVERS_BLOCKLIST) ||
      this.hasRight(UserRight.MANAGE_SERVER_BLOCKLIST_SUBSCRIPTIONS)
    ) {
      const item: HorizontalMenuEntry = {
        label: $localize`Mutes`,
        routerLink: '',
        children: []
      }

      if (this.hasRight(UserRight.MANAGE_SERVER_ACCOUNTS_BLOCKLIST)) {
        item.children.push({
          label: $localize`Muted accounts`,
          routerLink: '/admin/moderation/blocklist/accounts'
        })
      }

      if (this.hasRight(UserRight.MANAGE_SERVER_SERVERS_BLOCKLIST)) {
        item.children.push({
          label: $localize`Muted servers`,
          routerLink: '/admin/moderation/blocklist/servers'
        })
      }

      if (this.hasRight(UserRight.MANAGE_SERVER_BLOCKLIST_SUBSCRIPTIONS)) {
        item.children.push({
          label: $localize`Subscriptions`,
          routerLink: '/admin/moderation/blocklist/subscriptions'
        })
      }

      item.routerLink = item.children[0].routerLink

      this.menuEntries.push(item)
    }

    if (this.hasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS) || this.hasRight(UserRight.MANAGE_INSTANCE_AUTO_TAGS)) {
      const item: HorizontalMenuEntry = {
        label: $localize`Watched words`,
        routerLink: '',
        children: []
      }

      if (this.hasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS)) {
        item.children.push({
          label: $localize`Lists`,
          routerLink: '/admin/moderation/watched-words/list'
        })

        item.children.push({
          label: $localize`Subscriptions`,
          routerLink: '/admin/moderation/watched-words/subscriptions'
        })
      }

      if (this.hasRight(UserRight.MANAGE_INSTANCE_AUTO_TAGS)) {
        item.children.push({
          label: $localize`Auto tag policies`,
          routerLink: '/admin/moderation/watched-words/automatic-tag-policies'
        })
      }

      item.routerLink = item.children[0].routerLink

      this.menuEntries.push(item)
    }
  }

  private hasRight (right: UserRightType) {
    return this.auth.getUser().hasRight(right)
  }
}
