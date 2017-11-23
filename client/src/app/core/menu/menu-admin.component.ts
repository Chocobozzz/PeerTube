import { Component } from '@angular/core'

import { AuthService } from '../auth/auth.service'
import { UserRight } from '../../../../../shared'

@Component({
  selector: 'my-menu-admin',
  templateUrl: './menu-admin.component.html',
  styleUrls: [ './menu.component.scss' ]
})
export class MenuAdminComponent {
  constructor (private auth: AuthService) {}

  hasUsersRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_USERS)
  }

  hasFriendsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_PEERTUBE_FOLLOW)
  }

  hasVideoAbusesRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_VIDEO_ABUSES)
  }

  hasVideoBlacklistRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)
  }
}
