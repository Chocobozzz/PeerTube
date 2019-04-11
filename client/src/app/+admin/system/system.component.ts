import { Component } from '@angular/core'
import { UserRight } from '@shared/models'
import { AuthService } from '@app/core'

@Component({
  templateUrl: './system.component.html',
  styleUrls: [ './system.component.scss' ]
})
export class SystemComponent {

  constructor (private auth: AuthService) {}

  hasLogsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_LOGS)
  }

  hasJobsRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_JOBS)
  }

  hasDebugRight () {
    return this.auth.getUser().hasRight(UserRight.MANAGE_DEBUG)
  }
}
