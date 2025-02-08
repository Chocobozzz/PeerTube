import { Component, OnInit } from '@angular/core'
import { AuthService, ConfirmService, Notifier, ScopedTokensService } from '@app/core'
import { FeedFormat, ScopedToken } from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'
import { InputTextComponent } from '../../shared/shared-forms/input-text.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { VideoService } from '@app/shared/shared-main/video/video.service'

@Component({
  selector: 'my-account-applications',
  templateUrl: './my-account-applications.component.html',
  styleUrls: [ './my-account-applications.component.scss' ],
  imports: [ GlobalIconComponent, InputTextComponent ]
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
      .subscribe({
        next: tokens => this.regenApplications(tokens),

        error: err => this.notifier.error(err.message)
      })
  }

  async renewToken () {
    const res = await this.confirmService.confirm(
      // eslint-disable-next-line max-len
      $localize`Renewing the token will disallow previously configured clients from retrieving the feed until they use the new token. Proceed?`,
      $localize`Renew token`
    )
    if (res === false) return

    this.scopedTokensService.renewScopedTokens()
      .subscribe({
        next: tokens => {
          this.regenApplications(tokens)
          this.notifier.success($localize`Token renewed. Update your client configuration accordingly.`)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private regenApplications (tokens: ScopedToken) {
    const user = this.authService.getUser()
    const feeds = this.videoService.getVideoSubscriptionFeedUrls(user.account.id, tokens.feedToken)
    this.feedUrl = this.baseURL + feeds.find(f => f.format === FeedFormat.RSS).url
    this.feedToken = tokens.feedToken
  }
}
