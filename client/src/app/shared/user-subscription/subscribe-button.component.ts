import { Component, Input, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { UserSubscriptionService } from '@app/shared/user-subscription/user-subscription.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoService } from '@app/shared/video/video.service'
import { FeedFormat } from '../../../../../shared/models/feeds'
import { Account } from '@app/shared/account/account.model'
import { forkJoin } from 'rxjs'

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

  subscribed: Map<string, boolean>

  constructor (
    private authService: AuthService,
    private router: Router,
    private notifier: Notifier,
    private userSubscriptionService: UserSubscriptionService,
    private i18n: I18n,
    private videoService: VideoService
  ) {
    this.subscribed = new Map<string, boolean>()
  }

  get handle () {
    return this.account
      ? this.account.nameWithHost
      : this.videoChannels[0].name + '@' + this.videoChannels[0].host
  }

  get channelHandle () {
    return this.getChannelHandler(this.videoChannels[0])
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

  ngOnInit () {
    if (this.isUserLoggedIn()) {

      forkJoin(this.videoChannels.map(videoChannel => {
        const handle = this.getChannelHandler(videoChannel)
        this.subscribed.set(handle, false)
        this.userSubscriptionService.doesSubscriptionExist(handle)
          .subscribe(
            res => this.subscribed.set(handle, res[handle]),

            err => this.notifier.error(err.message)
          )
      }))
    }
  }

  subscribe () {
    if (this.isUserLoggedIn()) {
      return this.localSubscribe()
    }

    return this.gotoLogin()
  }

  localSubscribe () {
    const observableBatch: any = []

    this.videoChannels
      .filter(videoChannel => this.subscribeStatus(false).includes(this.getChannelHandler(videoChannel)))
      .forEach(videoChannel => observableBatch.push(
        this.userSubscriptionService.addSubscription(this.getChannelHandler(videoChannel))
      ))

    forkJoin(observableBatch)
      .subscribe(
        () => {
          [...this.subscribed.keys()].forEach((key) => {
            this.subscribed.set(key, true)
          })

          this.notifier.success(
            this.account
              ? this.i18n(
                  'Subscribed to all current channels of {{nameWithHost}}. ' +
                  'You will be notified of all their new videos.',
                  { nameWithHost: this.account.displayName }
                )
              : this.i18n(
                  'Subscribed to {{nameWithHost}}. ' +
                  'You will be notified of all their new videos.',
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
    const observableBatch: any = []

    this.videoChannels
      .filter(videoChannel => this.subscribeStatus(true).includes(this.getChannelHandler(videoChannel)))
      .forEach(videoChannel => observableBatch.push(
        this.userSubscriptionService.deleteSubscription(this.getChannelHandler(videoChannel))
      ))

    forkJoin(observableBatch)
        .subscribe(
          () => {
            [...this.subscribed.keys()].forEach((key) => {
              this.subscribed.set(key, false)
            })

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

  gotoLogin () {
    this.router.navigate([ '/login' ])
  }

  private getChannelHandler (videoChannel: VideoChannel) {
    return videoChannel.name + '@' + videoChannel.host
  }

  private subscribeStatus (subscribed: boolean) {
    const accumulator = []
    for (const [key, value] of this.subscribed.entries()) {
      if (value === subscribed) accumulator.push(key)
    }
    return accumulator
  }
}
