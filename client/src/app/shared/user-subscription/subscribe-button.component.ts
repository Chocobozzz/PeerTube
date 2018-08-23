import { Component, Input, OnInit } from '@angular/core'
import { AuthService } from '@app/core'
import { RestExtractor } from '@app/shared/rest'
import { RedirectService } from '@app/core/routing/redirect.service'
import { UserSubscriptionService } from '@app/shared/user-subscription/user-subscription.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'

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
    private restExtractor: RestExtractor,
    private redirectService: RedirectService,
    private notificationsService: NotificationsService,
    private userSubscriptionService: UserSubscriptionService,
    private i18n: I18n
  ) { }

  get uri () {
    return this.videoChannel.name + '@' + this.videoChannel.host
  }

  ngOnInit () {
    this.userSubscriptionService.isSubscriptionExists(this.uri)
      .subscribe(
        res => this.subscribed = res[this.uri],

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

  subscribe () {
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
}
