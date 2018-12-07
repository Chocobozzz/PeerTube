import { ChangeDetectionStrategy, Component, Input, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core'
import { Router } from '@angular/router'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { UserSubscriptionService } from '@app/shared/user-subscription/user-subscription.service'
import { NotificationsService } from 'angular2-notifications'
import { ServerService } from '@app/core'
import { AuthService, AuthUser } from '@app/core/auth'
import { ConfirmService } from '@app/core/confirm'
import { VideoDetails } from '@app/shared/video/video-details.model'
import { VideoBlacklistService } from '@app/shared/video-blacklist'
import { BlocklistService } from '@app/shared/blocklist'
import { VideoService } from './video.service'
import { Video } from './video.model'
import { VideoPrivacy } from '../../../../../shared/models/videos'
import { UserRight } from '../../../../../shared/models/users'
import { forkJoin, of } from 'rxjs'

export type OwnerDisplayType = 'account' | 'videoChannel' | 'auto'

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ './video-miniature.component.scss' ],
  templateUrl: './video-miniature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoMiniatureComponent implements OnInit {
  @Input() user: AuthUser
  @Input() video: Video
  @Input() ownerDisplayType: OwnerDisplayType = 'account'

  subscribed: boolean = null
  displayModerationBlock = false
  videoDetails: VideoDetails = null

  private ownerDisplayTypeChosen: 'account' | 'videoChannel'

  constructor (
    protected authService: AuthService,
    private router: Router,
    private notificationsService: NotificationsService,
    private userSubscriptionService: UserSubscriptionService,
    private i18n: I18n,
    private serverService: ServerService,
    private videoService: VideoService,
    private confirmService: ConfirmService,
    private videoBlacklistService: VideoBlacklistService,
    private cdr: ChangeDetectorRef,
    private blocklistService: BlocklistService
  ) { }

  get isVideoBlur () {
    return this.video.isVideoNSFWForUser(this.user, this.serverService.getConfig())
  }

  ngOnInit () {
    if (this.authService.isLoggedIn()) {
      const user = this.authService.getUser()
      this.displayModerationBlock = user.hasRight(UserRight.MANAGE_VIDEO_ABUSES)
    }

    if (this.ownerDisplayType === 'account' || this.ownerDisplayType === 'videoChannel') {
      this.ownerDisplayTypeChosen = this.ownerDisplayType
      return
    }

    // If the video channel name an UUID (not really displayable, we changed this behaviour in v1.0.0-beta.12)
    // -> Use the account name
    if (
      this.video.channel.name === `${this.video.account.name}_channel` ||
      this.video.channel.name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    ) {
      this.ownerDisplayTypeChosen = 'account'
    } else {
      this.ownerDisplayTypeChosen = 'videoChannel'
    }
  }

  displayOwnerAccount () {
    return this.ownerDisplayTypeChosen === 'account'
  }

  displayOwnerVideoChannel () {
    return this.ownerDisplayTypeChosen === 'videoChannel'
  }

  isUnlistedVideo () {
    return this.video.privacy.id === VideoPrivacy.UNLISTED
  }

  isPrivateVideo () {
    return this.video.privacy.id === VideoPrivacy.PRIVATE
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  // Functions related to the dropdown user part
  get uri () {
    return this.video.channel.name + '@' + this.video.channel.host
  }

  subscribe () {
    if (this.isUserLoggedIn()) {
      return this.localSubscribe()
    }

    return this.gotoLogin()
  }

  localSubscribe () {
    this.userSubscriptionService.addSubscription(this.uri)
      .subscribe(
        () => {
          this.subscribed = true

          this.notificationsService.success(
            this.i18n('Subscribed'),
            this.i18n('Subscribed to {{nameWithHost}}', { nameWithHost: this.video.channel.displayName })
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
              this.i18n('Unsubscribed from {{nameWithHost}}', { nameWithHost: this.video.channel.displayName })
            )
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  gotoLogin () {
    this.router.navigate([ '/login' ])
  }

  // function related to the dropdown owner/moderator part
  loadDropdownInformations () {
    if (!this.isUserLoggedIn()) return

    let requests = [
      (this.subscribed === null) ?
        this.userSubscriptionService.isSubscriptionExists(this.uri)
        : of(null),
      (!this.videoDetails) ?
        this.videoService.getVideo(this.video.uuid)
        : of(null)
    ]

    forkJoin(requests)
      .subscribe(([ subscription, videoDetails ]) => {
        if (subscription) {
          this.subscribed = subscription[this.uri]
        }
        if (videoDetails) {
          this.videoDetails = videoDetails
        }

        this.cdr.detectChanges()
      })
  }

  toggleSubscription () {
    this.isUserLoggedIn() ?
      this.subscribed ? this.unsubscribe() : this.subscribe()
      : this.gotoLogin()
  }

  isVideoUpdatable () {
    return this.videoDetails ? this.videoDetails.isUpdatableBy(this.user) : false
  }

  isVideoRemovable () {
    return this.videoDetails ? this.videoDetails.isRemovableBy(this.authService.getUser()) : false
  }

  isVideoBlacklistable () {
    return this.videoDetails ? this.videoDetails.isBlackistableBy(this.user) : false
  }

  isVideoUnblacklistable () {
    return this.videoDetails ? this.videoDetails.isUnblacklistableBy(this.user) : false
  }

  isAccountBlockable () {
    return this.videoDetails ?
      (this.user && this.videoDetails.isLocal !== true) || (this.video.account.name !== this.user.username)
      : false
  }

  async removeVideo (event: Event) {
    event.preventDefault()

    const res = await this.confirmService.confirm(this.i18n('Do you really want to delete this video?'), this.i18n('Delete'))
    if (res === false) return

    this.videoService.removeVideo(this.video.id)
        .subscribe(
          status => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Video {{videoName}} deleted.', { videoName: this.video.name })
            )
          },

          error => this.notificationsService.error(this.i18n('Error'), error.message)
        )
  }

  async blacklistVideo (event: Event) {
    event.preventDefault()

    const confirmMessage = this.i18n(
      'Do you really want to add this video to the blacklist? It will be disabled from the videos lists.'
    )

    const res = await this.confirmService.confirm(confirmMessage, this.i18n('Blacklist'))
    if (res === false) return

    this.videoBlacklistService.removeVideoFromBlacklist(this.video.id).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('Video {{name}} added to the blacklist.', { name: this.video.name })
        )

        this.video.blacklisted = false
        this.video.blacklistedReason = null
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }

  async unblacklistVideo (event: Event) {
    event.preventDefault()

    const confirmMessage = this.i18n(
      'Do you really want to remove this video from the blacklist? It will be available again in the videos list.'
    )

    const res = await this.confirmService.confirm(confirmMessage, this.i18n('Unblacklist'))
    if (res === false) return

    this.videoBlacklistService.removeVideoFromBlacklist(this.video.id).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('Video {{name}} removed from the blacklist.', { name: this.video.name })
        )

        this.video.blacklisted = false
        this.video.blacklistedReason = null
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }

  muteAccountByUser (account: Account) {
    this.blocklistService.blockAccountByUser(this.videoDetails.account)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Account {{nameWithHost}} muted.', { nameWithHost: this.videoDetails.account.nameWithHost })
            )
          },

          (err: any) => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  unmuteAccountByUser (account: Account) {
    this.blocklistService.unblockAccountByUser(this.videoDetails.account)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Account {{nameWithHost}} unmuted.', { nameWithHost: this.videoDetails.account.nameWithHost })
            )
          },

          (err: any) => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  blockAccountByInstance () {
    this.blocklistService.blockAccountByInstance(this.videoDetails.account)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Account {{nameWithHost}} muted by the instance.', { nameWithHost: this.videoDetails.account.nameWithHost })
            )
          },

          (err: any) => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }

  unblockAccountByInstance () {
    this.blocklistService.unblockAccountByInstance(this.videoDetails.account)
        .subscribe(
          () => {
            this.notificationsService.success(
              this.i18n('Success'),
              this.i18n('Account {{nameWithHost}} unmuted by the instance.', { nameWithHost: this.videoDetails.account.nameWithHost })
            )
          },

          (err: any) => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }
}
