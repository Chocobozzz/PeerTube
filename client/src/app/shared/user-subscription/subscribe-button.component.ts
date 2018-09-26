import { Component, Input, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '@app/core'
import { UserSubscriptionService } from '@app/shared/user-subscription/user-subscription.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoService } from '@app/shared/video/video.service'
import { FeedFormat } from '../../../../../shared/models/feeds'

@Component({
  selector: 'my-subscribe-button',
  templateUrl: './subscribe-button.component.html',
  styleUrls: [ './subscribe-button.component.scss' ]
})
export class SubscribeButtonComponent implements OnInit {
  @Input() videoChannel: VideoChannel
  @Input() displayFollowers = false
  @Input() size: 'small' | 'normal' = 'normal'

  subscribed: boolean

  constructor (
    private authService: AuthService,
    private router: Router,
    private notificationsService: NotificationsService,
    private userSubscriptionService: UserSubscriptionService,
    private i18n: I18n,
    private videoService: VideoService
  ) { }

  get uri () {
    return this.videoChannel.name + '@' + this.videoChannel.host
  }

  get uriAccount () {
    return this.videoChannel.ownerAccount.name + '@' + this.videoChannel.host
  }

  ngOnInit () {
    if (this.isUserLoggedIn()) {
      this.userSubscriptionService.isSubscriptionExists(this.uri)
        .subscribe(
          res => this.subscribed = res[this.uri],

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
    }
  }

  subscribe () {
    if (this.isUserLoggedIn()) {
      this.localSubscribe()
    } else {
      this.gotoLogin()
    }
  }

  localSubscribe () {
    this.userSubscriptionService.addSubscription(this.uri)
      .subscribe(
        () => {
          this.subscribed = true

          this.notificationsService.success(
            this.i18n('Subscribed'),
            this.i18n('Subscribed to {{nameWithHost}}', { nameWithHost: this.videoChannel.displayName })
          )
        },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

  unsubscribe () {
    if (this.isUserLoggedIn()) {
      this.localUnsubscribe()
    }
  }

  localUnsubscribe () {
    this.userSubscriptionService.deleteSubscription(this.uri)
        .subscribe(
          () => {
            this.subscribed = false

            this.notificationsService.success(
              this.i18n('Unsubscribed'),
              this.i18n('Unsubscribed from {{nameWithHost}}', { nameWithHost: this.videoChannel.displayName })
            )
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  gotoLogin () {
    this.router.navigate([ '/login' ])
  }

  rssOpen () {
    const rssFeed = this.videoService
                      .getVideoChannelFeedUrls(this.videoChannel.id)
                      .find(i => i.format === FeedFormat.RSS)

    window.open(rssFeed.url)
  }
}
