import { Component } from '@angular/core'
import { UserRight } from '../../../../../shared'
import { AuthService } from '@app/core/auth/auth.service'

@Component({
  templateUrl: './moderation.component.html',
  styleUrls: [ './moderation.component.scss' ]
})
export class ModerationComponent {
  constructor (private auth: AuthService) {}

  hasVideoAbusesRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_VIDEO_ABUSES)
  }

  hasVideoBlacklistRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)
  }
}
