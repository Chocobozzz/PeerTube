
import { Component, OnInit } from '@angular/core'
import { AuthService, Notifier, ConfirmService } from '@app/core'
import { VideoService } from '@app/shared/shared-main'
import { FeedFormat } from '@shared/models'
import { Subject, merge } from 'rxjs'
import { debounceTime } from 'rxjs/operators'

@Component({
  selector: 'my-account-applications',
  templateUrl: './my-account-applications.component.html',
  styleUrls: [ './my-account-applications.component.scss' ]
})
export class MyAccountApplicationsComponent implements OnInit {
  feedUrl: string
  feedToken: string

  private baseURL = window.location.protocol + '//' + window.location.host
  private tokenStream = new Subject()

  constructor (
    private authService: AuthService,
    private videoService: VideoService,
    private notifier: Notifier,
    private confirmService: ConfirmService
  ) {}

  ngOnInit () {
    this.feedUrl = this.baseURL

    merge(
      this.tokenStream,
      this.authService.userInformationLoaded
    ).pipe(debounceTime(400))
     .subscribe(
       _ => {
         const user = this.authService.getUser()
         this.videoService.getVideoSubscriptionFeedUrls(user.account.id)
                          .then(feeds => this.feedUrl = this.baseURL + feeds.find(f => f.format === FeedFormat.RSS).url)
                          .then(_ => this.authService.getScopedTokens().then(tokens => this.feedToken = tokens.feedToken))
       },

       err => {
         this.notifier.error(err.message)
       }
     )
  }

  async renewToken () {
    const res = await this.confirmService.confirm('Renewing the token will disallow previously configured clients from retrieving the feed until they use the new token. Proceed?', 'Renew token')
    if (res === false) return

    await this.authService.renewScopedTokens()
    this.notifier.success('Token renewed. Update your client configuration accordingly.')
    this.tokenStream.next()
  }
}
