import { Component, OnInit, inject } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AuthService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { UserRight, UserRightType } from '@peertube/peertube-models'

@Component({
  selector: 'my-admin-overview',
  templateUrl: './admin-overview.component.html',
  imports: [ HorizontalMenuComponent, RouterOutlet ]
})
export class AdminOverviewComponent implements OnInit {
  private auth = inject(AuthService)

  menuEntries: HorizontalMenuEntry[] = []

  ngOnInit () {
    this.buildMenu()
  }

  private buildMenu () {
    this.menuEntries = []

    if (this.hasRight(UserRight.MANAGE_USERS)) {
      this.menuEntries.push({
        label: $localize`Users`,
        routerLink: '/admin/overview/users'
      })
    }

    if (this.hasRight(UserRight.SEE_ALL_VIDEOS)) {
      this.menuEntries.push({
        label: $localize`Videos`,
        routerLink: '/admin/overview/videos',
        queryParams: {
          search: 'isLocal:true'
        }
      })
    }

    if (this.hasRight(UserRight.SEE_ALL_COMMENTS)) {
      this.menuEntries.push({
        label: $localize`Comments`,
        routerLink: '/admin/overview/comments'
      })
    }
  }

  private hasRight (right: UserRightType) {
    return this.auth.getUser().hasRight(right)
  }
}
