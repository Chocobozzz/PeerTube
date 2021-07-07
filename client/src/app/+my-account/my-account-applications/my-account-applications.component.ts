import { Component, OnInit } from '@angular/core'
import { AuthService, Notifier, ConfirmService, ScopedTokensService } from '@app/core'
import { VideoService } from '@app/shared/shared-main'
import { FeedFormat } from '@shared/models'
import { ScopedToken } from '@shared/models/users/user-scoped-token'
import { environment } from '../../../environments/environment'

@Component({
  selector: 'my-account-applications',
  templateUrl: './my-account-applications.component.html',
  styleUrls: [ './my-account-applications.component.scss' ]
})
export class MyAccountApplicationsComponent implements OnInit {
  feedUrl: string
  feedToken: string

  private baseURL = environment.originServerUrl || window.location.origin

  constructor (
    private authService: AuthService,
    private scopedTokensService: ScopedTokensService,
    private videoService: VideoService,
    private notifier: Notifier,
    private confirmService: ConfirmService
  ) {}

  ngOnInit () {
    this.feedUrl = this.baseURL
    this.scopedTokensService.getScopedTokens()
      .subscribe(
        tokens => this.regenApplications(tokens),

        err => {
          this.notifier.error(err.message)
        }
      )
  }

  async renewToken () {
    const res = await this.confirmService.confirm(
      $localize`Renewing the token will disallow previously configured clients from retrieving the feed until they use the new token. Proceed?`,
      $localize`Renew token`
    )
    if (res === false) return

    this.scopedTokensService.renewScopedTokens().subscribe(
      tokens => {
        this.regenApplications(tokens)
        this.notifier.success($localize`Token renewed. Update your client configuration accordingly.`)
      },

      err => {
        this.notifier.error(err.message)
      }
    )

  }

  private regenApplications (tokens: ScopedToken) {
    const user = this.authService.getUser()
    const feeds = this.videoService.getVideoSubscriptionFeedUrls(user.account.id, tokens.feedToken)
    this.feedUrl = this.baseURL + feeds.find(f => f.format === FeedFormat.RSS).url
    this.feedToken = tokens.feedToken
  }
}
