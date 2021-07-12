import { concat, forkJoin, merge } from 'rxjs'
import { Component, Input, OnChanges, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { Account, VideoChannel, VideoService } from '@app/shared/shared-main'
import { FeedFormat } from '@shared/models'
import { UserSubscriptionService } from './user-subscription.service'

@Component({
  selector: 'my-subscribe-button',
  templateUrl: './subscribe-button.component.html',
  styleUrls: [ './subscribe-button.component.scss' ]
})
export class SubscribeButtonComponent implements OnInit, OnChanges {
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

  get isAllChannelsSubscribed () {
    return this.subscribeStatus(true).length === this.videoChannels.length
  }

  get isAtLeastOneChannelSubscribed () {
    return this.subscribeStatus(true).length > 0
  }

  get isBigButton () {
    return this.isUserLoggedIn() && this.videoChannels.length > 1 && this.isAtLeastOneChannelSubscribed
  }

  ngOnInit () {
    this.loadSubscribedStatus()
  }

  ngOnChanges () {
    this.ngOnInit()
  }

  subscribe () {
    if (this.isUserLoggedIn()) {
      return this.localSubscribe()
    }

    return this.gotoLogin()
  }

  localSubscribe () {
    const subscribedStatus = this.subscribeStatus(false)

    const observableBatch = this.videoChannels
      .map(videoChannel => this.getChannelHandler(videoChannel))
      .filter(handle => subscribedStatus.includes(handle))
      .map(handle => this.userSubscriptionService.addSubscription(handle))

    forkJoin(observableBatch)
      .subscribe(
        () => {
          this.notifier.success(
            this.account
              ? $localize`Subscribed to all current channels of ${this.account.displayName}. You will be notified of all their new videos.`
              : $localize`Subscribed to ${this.videoChannels[0].displayName}. You will be notified of all their new videos.`,

            $localize`Subscribed`
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
    const subscribeStatus = this.subscribeStatus(true)

    const observableBatch = this.videoChannels
                                .map(videoChannel => this.getChannelHandler(videoChannel))
                                .filter(handle => subscribeStatus.includes(handle))
                                .map(handle => this.userSubscriptionService.deleteSubscription(handle))

    concat(...observableBatch)
      .subscribe({
        complete: () => {
          this.notifier.success(
            this.account
              ? $localize`Unsubscribed from all channels of ${this.account.nameWithHost}`
              : $localize`Unsubscribed from ${this.videoChannels[ 0 ].nameWithHost}`,

            $localize`Unsubscribed`
          )
        },

        error: err => this.notifier.error(err.message)
      })
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
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

  isSubscribedToAll () {
    return Array.from(this.subscribed.values()).every(v => v === true)
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
      ).subscribe(
        res => this.subscribed.set(handle, res),

        err => this.notifier.error(err.message)
      )
    }
  }
}
