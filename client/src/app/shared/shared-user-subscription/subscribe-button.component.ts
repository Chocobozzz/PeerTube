import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, Input, OnChanges, ViewChild } from '@angular/core'
import { AuthService, Notifier, RedirectService } from '@app/core'
import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap'
import { FeedFormat } from '@peertube/peertube-models'
import { concat, forkJoin, merge } from 'rxjs'
import { Account } from '../shared-main/account/account.model'
import { VideoChannel } from '../shared-main/channel/video-channel.model'
import { NumberFormatterPipe } from '../shared-main/common/number-formatter.pipe'
import { VideoService } from '../shared-main/video/video.service'
import { RemoteSubscribeComponent } from './remote-subscribe.component'
import { UserSubscriptionService } from './user-subscription.service'

@Component({
  selector: 'my-subscribe-button',
  templateUrl: './subscribe-button.component.html',
  styleUrls: [ './subscribe-button.component.scss' ],
  imports: [
    NgClass,
    NgIf,
    NgTemplateOutlet,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownItem,
    RemoteSubscribeComponent,
    NumberFormatterPipe
  ]
})
export class SubscribeButtonComponent implements OnChanges {
  /**
   * SubscribeButtonComponent can be used with a single VideoChannel passed as [VideoChannel],
   * or with an account and a full list of that account's videoChannels. The latter is intended
   * to allow mass un/subscription from an account's page, while keeping the channel-centric
   * subscription model.
   */
  @Input() account: Account
  @Input() videoChannels: VideoChannel[]
  @Input() size: 'small' | 'normal' = 'normal'

  @ViewChild('dropdown') dropdown: NgbDropdown

  subscribed = new Map<string, boolean>()

  buttonClasses: Record<string, boolean> = {}

  constructor (
    private authService: AuthService,
    private redirectService: RedirectService,
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

  get isSingleSubscribe () {
    return !this.account
  }

  ngOnChanges () {
    this.loadSubscribedStatus()
    this.buildClasses()
  }

  // ---------------------------------------------------------------------------

  subscribe () {
    if (this.dropdown) this.dropdown.close()

    if (this.isUserLoggedIn()) {
      return this.localSubscribe()
    }

    return this.gotoLogin()
  }

  private localSubscribe () {
    const subscribedStatus = this.subscribeStatus(false)

    const observableBatch = this.videoChannels
      .map(videoChannel => this.getChannelHandler(videoChannel))
      .filter(handle => subscribedStatus.includes(handle))
      .map(handle => this.userSubscriptionService.addSubscription(handle))

    forkJoin(observableBatch)
      .subscribe({
        next: () => {
          this.buildClasses()

          this.notifier.success(
            this.account
              ? $localize`Subscribed to all current channels of ${this.account.displayName}. You will be notified of all their new videos.`
              : $localize`Subscribed to ${this.videoChannels[0].displayName}. You will be notified of all their new videos.`,

            $localize`Subscribed`
          )
        },

        error: err => this.notifier.error(err.message)
      })
  }

  // ---------------------------------------------------------------------------

  unsubscribe () {
    if (this.dropdown) this.dropdown.close()

    if (this.isUserLoggedIn()) {
      this.localUnsubscribe()
    }
  }

  private localUnsubscribe () {
    const subscribeStatus = this.subscribeStatus(true)

    const observableBatch = this.videoChannels
                                .map(videoChannel => this.getChannelHandler(videoChannel))
                                .filter(handle => subscribeStatus.includes(handle))
                                .map(handle => this.userSubscriptionService.deleteSubscription(handle))

    concat(...observableBatch)
      .subscribe({
        complete: () => {
          this.buildClasses()

          this.notifier.success(
            this.account
              ? $localize`Unsubscribed from all channels of ${this.account.nameWithHost}`
              : $localize`Unsubscribed from ${this.videoChannels[0].nameWithHost}`,

            $localize`Unsubscribed`
          )
        },

        error: err => this.notifier.error(err.message)
      })
  }

  // ---------------------------------------------------------------------------

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  gotoLogin () {
    this.redirectService.redirectToLogin()
  }

  subscribeStatus (subscribed: boolean) {
    const accumulator: string[] = []
    for (const [ key, value ] of this.subscribed.entries()) {
      if (value === subscribed) accumulator.push(key)
    }

    return accumulator
  }

  isSubscribedToAll () {
    return Array.from(this.subscribed.values()).every(v => v === true)
  }

  isRemoteSubscribeAvailable () {
    return this.isSingleSubscribe && !this.isUserLoggedIn()
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
      ).subscribe({
        next: res => {
          this.subscribed.set(handle, res)

          this.buildClasses()
        },

        error: err => this.notifier.error(err.message)
      })
    }
  }

  private buildClasses () {
    this.buttonClasses = {
      'peertube-button': true,
      'primary-button': !this.isAllChannelsSubscribed,
      'secondary-button': this.isAllChannelsSubscribed
    }
  }
}
