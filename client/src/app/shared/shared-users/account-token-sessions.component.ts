import { CommonModule } from '@angular/common'
import { Component, OnInit, inject, input } from '@angular/core'
import { ConfirmService, Notifier } from '@app/core'
import { TokenSessionService } from '@app/shared/shared-users/token-session.service'
import { TokenSession, User } from '@peertube/peertube-models'
import { UAParser } from 'ua-parser-js'

@Component({
  selector: 'my-account-token-sessions',
  templateUrl: './account-token-sessions.component.html',
  styleUrls: [ './account-token-sessions.component.scss' ],
  imports: [ CommonModule ],
  providers: [ TokenSessionService ]
})
export class AccountTokenSessionsComponent implements OnInit {
  private notifier = inject(Notifier)
  private tokenSessionService = inject(TokenSessionService)
  private confirmService = inject(ConfirmService)

  readonly user = input.required<User>()

  sessions: (TokenSession & { browserName: string, browserVersion: string, osName: string, osVersion: string })[] = []

  ngOnInit () {
    this.listSessions()
  }

  async revokeSession (session: TokenSession) {
    const res = await this.confirmService.confirm(
      $localize`Are you sure you want to revoke this token session? The device will be logged out and will need to log in again.`,
      $localize`Revoke token session`
    )
    if (!res) return

    this.tokenSessionService.revoke({
      userId: this.user().id,
      sessionId: session.id
    }).subscribe({
      next: () => {
        this.notifier.success($localize`Token session revoked`)

        this.listSessions()
      },

      error: err => this.notifier.handleError(err)
    })
  }

  private listSessions () {
    this.tokenSessionService.list({ userId: this.user().id }).subscribe({
      next: ({ data }) => {
        this.sessions = data.map(session => {
          const uaParser = new UAParser(session.lastActivityDevice)

          return {
            ...session,

            browserName: uaParser.getBrowser().name,
            browserVersion: uaParser.getBrowser().version,
            osName: uaParser.getOS().name,
            osVersion: uaParser.getOS().version
          }
        })
      },

      error: err => this.notifier.handleError(err)
    })
  }
}
