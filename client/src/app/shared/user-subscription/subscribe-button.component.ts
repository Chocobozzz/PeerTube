import { Component, Input, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { UserSubscriptionService } from '@app/shared/user-subscription/user-subscription.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoService } from '@app/shared/video/video.service'
import { FeedFormat } from '../../../../../shared/models/feeds'
import { Account } from '@app/shared/account/account.model'
import { forkJoin, merge } from 'rxjs'

@Component({
  selector: 'my-subscribe-button',
  templateUrl: './subscribe-button.component.html',
  styleUrls: [ './subscribe-button.component.scss' ]
})
export class SubscribeButtonComponent implements OnInit {
  /**
   * SubscribeButtonComponent can be used with a single VideoChannel passed as [VideoChannel],
   * or with an account and a full list of that account's videoChannels. The latter is intended
   * to allow mass un/subscription from an account's page, while keeping the channel-centric
   * subscription model.
   */
  @Input() account: Account
  @Input() videoChannels: VideoChannel[]
  @Input() displayFollowers = false
  @Input() size: 'small' | 'normal' = 'normal'

  subscribed = new Map<string, boolean>()

  constructor (
    private authService: AuthService,
    private router: Router,
    private notifier: Notifier,
    private userSubscriptionService: UserSubscriptionService,
    private i18n: I18n,
    private videoService: VideoService
  ) { }

  get handle () {
    return this.account
      ? this.account.nameWithHost
      : this.videoChannel.name + '@' + this.videoChannel.host
  }

  get channelHandle () {
    return this.getChannelHandler(this.videoChannel)
  }

  get uri () {
    return this.account
      ? this.account.url
      : this.videoChannels[0].url
  }

  get rssUri () {
    const rssFeed = this.account
      ? this.videoService
          .getAccountFeedUrls(this.account.id)
          .find(i => i.format === FeedFormat.RSS)
      : this.videoService
          .getVideoChannelFeedUrls(this.videoChannels[0].id)
          .find(i => i.format === FeedFormat.RSS)

    return rssFeed.url
  }

  get videoChannel () {
    return this.videoChannels[0]
  }

  ngOnInit () {
    this.loadSubscribedStatus()
  }

  subscribe () {
    if (this.isUserLoggedIn()) {
      return this.localSubscribe()
    }

    return this.gotoLogin()
  }

  localSubscribe () {
    const observableBatch = this.videoChannels
      .map(videoChannel => this.getChannelHandler(videoChannel))
      .filter(handle => this.subscribeStatus(false).includes(handle))
      .map(handle => this.userSubscriptionService.addSubscription(handle))

    merge(observableBatch, 2)
      .subscribe(
        () => {
          this.notifier.success(
            this.account
              ? this.i18n(
                  'Subscribed to all current channels of {{nameWithHost}}. You will be notified of all their new videos.',
                  { nameWithHost: this.account.displayName }
                )
              : this.i18n(
                  'Subscribed to {{nameWithHost}}. You will be notified of all their new videos.',
                  { nameWithHost: this.videoChannels[0].displayName }
                )
            ,
            this.i18n('Subscribed')
          )
        },

          err => this.notifier.error(err.message)
      )
  }

  unsubscribe () {
    if (this.isUserLoggedIn()) {
      this.localUnsubscribe()
    }
  }

  localUnsubscribe () {
    const observableBatch = this.videoChannels
      .map(videoChannel => this.getChannelHandler(videoChannel))
      .filter(handle => this.subscribeStatus(true).includes(handle))
      .map(handle => this.userSubscriptionService.deleteSubscription(handle))

    forkJoin(observableBatch)
        .subscribe(
          () => {
            this.notifier.success(
              this.account
                ? this.i18n('Unsubscribed from all channels of {{nameWithHost}}', { nameWithHost: this.account.nameWithHost })
                : this.i18n('Unsubscribed from {{nameWithHost}}', { nameWithHost: this.videoChannels[0].nameWithHost })
              ,
              this.i18n('Unsubscribed')
            )
          },

          err => this.notifier.error(err.message)
        )
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  isAllChannelsSubscribed () {
    return !Array.from(this.subscribed.values()).includes(false)
  }

  isAtLeastOneChannelSubscribed () {
    return this.subscribeStatus(true).length > 0
  }

  isBigButton () {
    return this.isUserLoggedIn() && this.videoChannels.length > 1 && this.isAtLeastOneChannelSubscribed()
  }

  gotoLogin () {
    this.router.navigate([ '/login' ])
  }

  subscribeStatus (subscribed: boolean) {
    const accumulator: string[] = []
    for (const [key, value] of this.subscribed.entries()) {
      if (value === subscribed) accumulator.push(key)
    }

    return accumulator
  }

  private getChannelHandler (videoChannel: VideoChannel) {
    return videoChannel.name + '@' + videoChannel.host
  }

  private loadSubscribedStatus () {
    if (!this.isUserLoggedIn()) return

    for (const videoChannel of this.videoChannels) {
      const handle = this.getChannelHandler(videoChannel)
      this.subscribed.set(handle, false)
      merge(
        this.userSubscriptionService.listenToSubscriptionCacheChange(handle),
        this.userSubscriptionService.doesSubscriptionExist(handle)
      )
          .subscribe(
            res => this.subscribed.set(handle, res),

            err => this.notifier.error(err.message)
          )
    }
  }
}
