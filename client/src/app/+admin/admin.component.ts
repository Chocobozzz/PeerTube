import { Component } from '@angular/core'
import { UserRight } from '../../../../shared'
import { AuthService } from '../core/auth/auth.service'

@Component({
  templateUrl: './admin.component.html'
})
export class AdminComponent {
  constructor (private auth: AuthService) {}

  hasUsersRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_USERS)
  }

  hasServerFollowRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_SERVER_FOLLOW)
  }

  hasVideoAbusesRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_VIDEO_ABUSES)
  }

  hasVideoBlacklistRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)
  }

  hasJobsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_JOBS)
  }

  hasConfigRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_CONFIGURATION)
  }
}
